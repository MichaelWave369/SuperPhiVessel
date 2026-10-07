from __future__ import annotations

import base64
import copy
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P1 = ROOT / "packages" / "dlam-p1-v0.1"
P2 = ROOT / "packages" / "dlam-p2-v0.1"
sys.path.insert(0, str(P1))
sys.path.insert(0, str(P2))

from dlam_store import DlamStore, canonical, sha256_text
from p2_sync import (
    ENVELOPE_DOMAIN,
    P2SyncNode,
    SignatureError,
    SyncDenied,
    peer_id_from_public_key,
)

CRYPTO = P2 / "ed25519_helper.mjs"
SCOPE = "shared:lab"

passed = 0
total = 0


def case(name, fn):
    global passed, total
    total += 1
    try:
        fn()
        passed += 1
        print(f"PASS {name}")
    except Exception as exc:
        print(f"FAIL {name}: {type(exc).__name__}: {exc}")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


class FixedClock:
    def __init__(self, minute):
        self.minute = minute
        self.i = 0

    def __call__(self):
        self.i += 1
        return f"2026-10-07T21:{self.minute:02d}:{self.i:02d}Z"


def crypto_call(payload):
    proc = subprocess.run(
        ["node", str(CRYPTO)],
        input=json.dumps(payload),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or "crypto helper failed")
    return json.loads(proc.stdout)


def keypair():
    return crypto_call({"op": "keygen"})


def signer(private_key_b64):
    def sign(payload: bytes) -> str:
        return crypto_call({
            "op": "sign",
            "private_key_b64": private_key_b64,
            "payload_b64": base64.b64encode(payload).decode("ascii"),
        })["signature_b64"]
    return sign


def verifier(public_key_b64, payload: bytes, signature_b64: str) -> bool:
    return bool(crypto_call({
        "op": "verify",
        "public_key_b64": public_key_b64,
        "payload_b64": base64.b64encode(payload).decode("ascii"),
        "signature_b64": signature_b64,
    })["ok"])


def capsule(mid, content, **kw):
    return {
        "memory_id": mid,
        "namespace_id": kw.pop("namespace_id", "local:vessie"),
        "agent_id": kw.pop("agent_id", "vessie"),
        "genius_id": kw.pop("genius_id", "ga108:032"),
        "kind": kw.pop("kind", "fact"),
        "content": content,
        "origin": kw.pop("origin", "OBSERVED"),
        "source_status": kw.pop("source_status", "CAPTURED"),
        "sensitivity": kw.pop("sensitivity", "SHARED"),
        "allowed_targets": kw.pop("allowed_targets", ["local_model"]),
        "allowed_purposes": kw.pop("allowed_purposes", ["analysis"]),
        "retention_rule": kw.pop("retention_rule", "retain_until_tombstoned"),
        **kw,
    }


def make_node(root: Path, name: str, minute: int):
    keys = keypair()
    store = DlamStore(root / f"{name}.db", clock=FixedClock(minute))
    node = P2SyncNode(
        store,
        local_public_key_b64=keys["public_key_b64"],
        signer=signer(keys["private_key_b64"]),
        verifier=verifier,
    )
    return {"keys": keys, "store": store, "node": node}


def expect(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")


def manual_object(body):
    object_hash = sha256_text("PV-DLAM-P2-OBJECT|" + canonical(body))
    return {**body, "object_hash": object_hash}


def manual_envelope(source, recipient_peer_id, *, epoch, scope, sequence, obj):
    body = {
        "schema": "superphivessel.dlam.p2.envelope.v0.1",
        "protocol": "PV-DLAM-P2-0.1",
        "source_peer_id": source["node"].node_id,
        "recipient_peer_id": recipient_peer_id,
        "authority_epoch": epoch,
        "scope": scope,
        "sequence": sequence,
        "created_at": f"2026-10-07T22:00:{sequence % 60:02d}Z",
        "object": obj,
        "authority_granted": False,
    }
    encoded = ENVELOPE_DOMAIN + canonical(body).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()
    return {
        "envelope_id": "p2env_" + digest[:32],
        "envelope_hash": digest,
        "body": body,
        "signature_b64": signer(source["keys"]["private_key_b64"])(encoded),
    }


def main():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        a = make_node(root, "a", 1)
        b = make_node(root, "b", 2)
        c = make_node(root, "c", 3)

        a_id = a["node"].node_id
        b_id = b["node"].node_id
        c_id = c["node"].node_id

        case("P201 asymmetric-peer-identities", lambda: (
            require(a_id == peer_id_from_public_key(a["keys"]["public_key_b64"]), "A peer id mismatch"),
            require(len({a_id, b_id, c_id}) == 3, "peer identities collided"),
        ))

        a["node"].pair_peer(b["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
        b["node"].pair_peer(a["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
        b["node"].pair_peer(c["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
        c["node"].pair_peer(b["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)

        a["store"].admit(capsule("m1", "alpha signed synchronization anchor"))
        q1 = a["node"].queue_memory(b_id, "m1", scope=SCOPE)
        r1 = b["node"].receive(q1["envelope"])
        case("P202 signed-two-node-import", lambda: (
            require(r1["body"]["status"] == "IMPORTED", "remote object not imported"),
            require(len(r1["body"]["imported_local_ids"]) == 1, "local replica id missing"),
            require(len(b["store"].recall(
                "alpha signed",
                namespace_id=SCOPE,
                purpose="analysis",
                target="local_model",
            )) == 1, "replica not recallable"),
        ))

        ack = a["node"].acknowledge(q1["outbox_id"], r1)
        case("P203 signed-receipt-acks-outbox", lambda: (
            require(ack["status"] == "ACKED", "outbox not acked"),
            require(a["node"].sync_status()["acked_outbox"] == 1, "acked count wrong"),
        ))

        a["store"].admit(capsule("m2", "tamper proof payload"))
        q2 = a["node"].queue_memory(b_id, "m2", scope=SCOPE)
        tampered = copy.deepcopy(q2["envelope"])
        tampered["body"]["object"]["content"] = "attacker changed content"
        case("P204 tampered-envelope-rejected", lambda:
            expect(SignatureError, lambda: b["node"].receive(tampered)))

        case("P205 wrong-recipient-rejected", lambda:
            expect(SyncDenied, lambda: c["node"].receive(q2["envelope"])))

        case("P206 unauthorized-scope-rejected-before-send", lambda:
            expect(SyncDenied, lambda: a["node"].queue_memory(b_id, "m2", scope="shared:other")))

        a["store"].admit(capsule("partitioned", "partition local capture survives"))
        qp = a["node"].queue_memory(b_id, "partitioned", scope=SCOPE)
        case("P207 partition-keeps-local-capture-and-outbox", lambda: (
            require(a["store"].get_memory("partitioned") is not None, "local capture lost"),
            require(any(x["outbox_id"] == qp["outbox_id"] for x in a["node"].pending_outbox(b_id)), "outbox not durable"),
            require(len(b["store"].recall(
                "partition local",
                namespace_id=SCOPE,
                purpose="analysis",
                target="local_model",
            )) == 0, "receiver changed during partition"),
        ))

        rp = b["node"].receive(qp["envelope"])
        a["node"].acknowledge(qp["outbox_id"], rp)
        case("P208 catch-up-after-partition", lambda:
            require(len(b["store"].recall(
                "partition local",
                namespace_id=SCOPE,
                purpose="analysis",
                target="local_model",
            )) == 1, "catch-up import failed"))

        replay = b["node"].receive(qp["envelope"])
        case("P209 replay-is-idempotent", lambda: (
            require(replay["receipt_id"] == rp["receipt_id"], "replay minted new receipt"),
            require(b["node"].sync_status()["remote_objects"] == 2, "replay duplicated object"),
        ))

        a["store"].admit(capsule("queued-before-revoke", "old epoch queued payload"))
        old = a["node"].queue_memory(b_id, "queued-before-revoke", scope=SCOPE)
        rev = b["node"].revoke_peer(a_id)
        case("P210 revocation-blocks-queued-old-epoch", lambda: (
            require(rev["authority_epoch"] == 2, "epoch did not advance"),
            expect(SyncDenied, lambda: b["node"].receive(old["envelope"])),
        ))

        # Re-pair explicitly at the new epoch for later cases.
        b["node"].pair_peer(a["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=2)
        a["node"].pair_peer(b["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=2)

        a["store"].admit(capsule("late", "late stale memory must never resurrect"))
        late_admit = a["node"].queue_memory(b_id, "late", scope=SCOPE)
        a["store"].forget("late", reason="owner deletion", actor="operator")
        late_tomb = a["node"].queue_tombstone(b_id, "late", scope=SCOPE)
        rt = b["node"].receive(late_tomb["envelope"])
        ra = b["node"].receive(late_admit["envelope"])
        case("P211 tombstone-before-admit-blocks-stale-resurrection", lambda: (
            require(rt["body"]["status"] == "TOMBSTONE_FRONTIER_RECORDED", "tombstone frontier absent"),
            require(ra["body"]["status"] == "STALE_SUPPRESSED", "stale admit not suppressed"),
            require(len(b["store"].recall(
                "late stale",
                namespace_id=SCOPE,
                purpose="analysis",
                target="local_model",
            )) == 0, "stale memory resurrected"),
        ))

        case("P212 no-transitive-forwarding-or-authority", lambda: (
            require(len(b["node"].pending_outbox(c_id)) == 0, "B auto-forwarded A data to C"),
            require(c["node"].sync_status()["remote_objects"] == 0, "C received transitive data"),
        ))

        # C and A can use the same source-local ID with incompatible content.
        c["node"].pair_peer(b["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
        b["node"].pair_peer(c["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
        a["store"].admit(capsule("shared-claim", "reactor status stable from peer A"))
        c["store"].admit(capsule("shared-claim", "reactor status unstable from peer C"))
        qa = a["node"].queue_memory(b_id, "shared-claim", scope=SCOPE)
        qc = c["node"].queue_memory(b_id, "shared-claim", scope=SCOPE)
        b["node"].receive(qa["envelope"])
        b["node"].receive(qc["envelope"])
        conflicts = b["store"].recall(
            "reactor status",
            namespace_id=SCOPE,
            purpose="analysis",
            target="local_model",
        )
        case("P213 concurrent-peer-conflicts-remain-visible", lambda: (
            require(len(conflicts) == 2, "peer claims collapsed"),
            require(len({x["memory_id"] for x in conflicts}) == 2, "replica IDs collided"),
        ))

        # Same peer + same source ID + changed signed content is quarantined.
        base_obj = a["node"]._memory_object("shared-claim")
        rewrite_body = {k: v for k, v in base_obj.items() if k != "object_hash"}
        rewrite_body["content"] = "peer A rewrote prior source identity"
        rewrite_body["content_sha256"] = sha256_text(rewrite_body["content"])
        rewrite = manual_object(rewrite_body)
        forged_rewrite = manual_envelope(
            a, b_id, epoch=2, scope=SCOPE, sequence=90, obj=rewrite
        )
        rr = b["node"].receive(forged_rewrite)
        case("P214 same-peer-source-id-rewrite-quarantined", lambda:
            require(rr["body"]["status"] == "QUARANTINED_CONFLICTING_SOURCE_ID", "rewrite replaced prior object"))

        malicious_body = {k: v for k, v in base_obj.items() if k != "object_hash"}
        malicious_body["source_memory_id"] = "malicious-authority"
        malicious_body["authority_granted"] = True
        malicious = manual_object(malicious_body)
        malicious_env = manual_envelope(
            a, b_id, epoch=2, scope=SCOPE, sequence=91, obj=malicious
        )
        case("P215 valid-signature-cannot-transport-authority", lambda:
            expect(SyncDenied, lambda: b["node"].receive(malicious_env)))

        a["store"].admit(capsule("dream", "dreamed silver city", origin="DREAMED"))
        qd = a["node"].queue_memory(b_id, "dream", scope=SCOPE)
        rd = b["node"].receive(qd["envelope"])
        dream_local = rd["body"]["imported_local_ids"][0]
        case("P216 signature-does-not-promote-epistemic-origin", lambda:
            require(b["store"].get_memory(dream_local)["origin"] == "DREAMED", "signature promoted DREAMED content"))

        vector_body = {
            "object_type": "VECTOR_CACHE",
            "source_memory_id": "vector-1",
            "source_sequence": 100,
            "embedding_model": "fixture",
            "vector": [0.1, 0.2],
        }
        vector_obj = manual_object(vector_body)
        vector_env = manual_envelope(
            a, b_id, epoch=2, scope=SCOPE, sequence=92, obj=vector_obj
        )
        case("P217 vector-cache-object-rejected-even-when-signed", lambda:
            expect(SyncDenied, lambda: b["node"].receive(vector_env)))

        a["store"].admit(capsule("rel-base", "relation source evidence"))
        a["store"].admit(capsule(
            "rel-claim",
            "relation claim contradiction",
            conflict_refs=["rel-base"],
        ))
        qclaim = a["node"].queue_memory(b_id, "rel-claim", scope=SCOPE)
        qbase = a["node"].queue_memory(b_id, "rel-base", scope=SCOPE)
        rclaim = b["node"].receive(qclaim["envelope"])
        rbase = b["node"].receive(qbase["envelope"])
        claim_local = rclaim["body"]["imported_local_ids"][0]
        base_local = rbase["body"]["imported_local_ids"][0]
        case("P218 pending-remote-relation-resolves-when-endpoint-arrives", lambda:
            require(b["store"].relation_exists(claim_local, "CONTRADICTS", base_local), "remote relation not materialized"))

        case("P219 receipts-never-grant-authority", lambda: (
            require(r1["body"]["authority_granted"] is False, "receive receipt authority leak"),
            require(ack["authority_granted"] is False, "ack authority leak"),
            require(rev["authority_granted"] is False, "revocation authority leak"),
        ))

        status = b["node"].sync_status()
        case("P220 sync-status-is-auditable-and-non-authoritative", lambda: (
            require(status["inbox_receipts"] >= 1, "inbox audit count missing"),
            require(status["remote_objects"] >= 1, "remote object count missing"),
            require(status["authority_granted"] is False, "status granted authority"),
        ))

        a["store"].admit(capsule("sealed", "never export this", sensitivity="SEALED"))
        case("P221 sealed-memory-export-fails-closed", lambda:
            expect(SyncDenied, lambda: a["node"].queue_memory(b_id, "sealed", scope=SCOPE)))

        for node in (a, b, c):
            node["store"].close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
