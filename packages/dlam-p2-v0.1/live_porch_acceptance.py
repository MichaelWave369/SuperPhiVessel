from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P1 = ROOT / "packages" / "dlam-p1-v0.1"
P2 = ROOT / "packages" / "dlam-p2-v0.1"
PORCH_ROOT = Path(os.environ.get("PORCH_ROOT", ROOT / "_porch")).resolve()
PORCH_TESTS = PORCH_ROOT / "tests"

sys.path.insert(0, str(P1))
sys.path.insert(0, str(P2))
sys.path.insert(0, str(PORCH_TESTS))

from acceptance import TestNode
from dlam_store import DlamStore
from p2_sync import P2SyncNode, SyncDenied
from porch_adapter import PorchApiClient, PorchP2Adapter

CRYPTO = P2 / "ed25519_helper.mjs"
PORCH_BINARY = PORCH_ROOT / "target" / "debug" / ("porch-node.exe" if os.name == "nt" else "porch-node")
SCOPE = "shared:live-porch"

passed = 0
total = 0


def case(name, fn):
    global passed, total
    total += 1
    try:
        fn()
        passed += 1
        print(f"PASS {name}", flush=True)
    except Exception as exc:
        print(f"FAIL {name}: {type(exc).__name__}: {exc}", flush=True)


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def expect(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")


def crypto_call(payload):
    proc = subprocess.run(
        ["node", str(CRYPTO)],
        input=json.dumps(payload),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=20,
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


class FixedClock:
    def __init__(self, minute):
        self.minute = minute
        self.i = 0

    def __call__(self):
        self.i += 1
        return f"2026-10-07T23:{self.minute:02d}:{self.i:02d}Z"


def capsule(mid, content):
    return {
        "memory_id": mid,
        "namespace_id": "local:vessie",
        "agent_id": "vessie",
        "genius_id": "ga108:032",
        "kind": "fact",
        "content": content,
        "origin": "OBSERVED",
        "source_status": "CAPTURED",
        "sensitivity": "SHARED",
        "allowed_targets": ["local_model"],
        "allowed_purposes": ["analysis"],
        "retention_rule": "retain_until_tombstoned",
    }


def message_grant(provider, requester):
    grant = provider.call(
        "grant.issue",
        {
            "recipient": requester.id,
            "capability": "message.direct",
            "resource": "inbox",
            "action": "send",
            "ttl_seconds": 3600,
            "limits": {
                "max_calls": 20,
                "calls_per_hour": 20,
                "max_input_bytes": 65536,
                "max_output_tokens": 16,
                "max_duration_ms": 30000,
                "max_storage_bytes": 0,
            },
        },
    )
    requester.call("grant.import", {"grant": grant})
    return grant


def connect(requester, provider):
    addresses = provider.read("network")["addresses"]
    address = next(x for x in addresses if "/tcp/" in x)
    requester.call("peer.connect", {"address": address, "expected_peer": provider.id})
    for _ in range(100):
        peers = requester.read("network").get("peers", {})
        if provider.id in peers and peers[provider.id].get("connections"):
            return
        time.sleep(0.05)
    raise AssertionError("Porch peer connection did not become ready")


def make_p2(db_path, minute, keys, porch_node):
    store = DlamStore(db_path, clock=FixedClock(minute))
    sync = P2SyncNode(
        store,
        local_public_key_b64=keys["public_key_b64"],
        signer=signer(keys["private_key_b64"]),
        verifier=verifier,
    )
    client = PorchApiClient(porch_node.token, porch_node.api)
    adapter = PorchP2Adapter(sync, client)
    return store, sync, adapter


def newest_p2_message(node, schema):
    for message in node.read("messages"):
        try:
            carrier = json.loads(message.get("text", ""))
        except Exception:
            continue
        if isinstance(carrier, dict) and carrier.get("schema") == schema:
            return message
    raise AssertionError("no P2 Porch carrier found")


def main():
    if not PORCH_BINARY.exists():
        raise SystemExit(f"missing live Porch binary: {PORCH_BINARY}")

    with tempfile.TemporaryDirectory(prefix="pv-dlam-p2c-") as td:
        root = Path(td)
        porch_nodes = []
        p2_stores = []

        try:
            porch_a = TestNode("PORCH-A", root / "porch", PORCH_BINARY, transport="tcp")
            porch_b = TestNode("PORCH-B", root / "porch", PORCH_BINARY, transport="tcp")
            porch_nodes.extend([porch_a, porch_b])

            original_a_porch_id = porch_a.id
            original_b_porch_id = porch_b.id

            porch = porch_a.call("porch.create", {"name": "PV-DLAM P2 live loopback"})
            invite = porch_a.call(
                "porch.invite",
                {"recipient": porch_b.id, "ttl_seconds": 600},
            )
            porch_b.call("porch.join", {"invite": invite})
            connect(porch_b, porch_a)

            # Bidirectional direct-message authority is explicit and provider-issued.
            grant_b_to_a = message_grant(porch_b, porch_a)
            grant_a_to_b = message_grant(porch_a, porch_b)

            keys_a = keypair()
            keys_b = keypair()
            db_a = root / "p2-a.db"
            db_b = root / "p2-b.db"
            store_a, sync_a, adapter_a = make_p2(db_a, 1, keys_a, porch_a)
            store_b, sync_b, adapter_b = make_p2(db_b, 2, keys_b, porch_b)
            p2_stores.extend([store_a, store_b])

            a_p2 = sync_a.node_id
            b_p2 = sync_b.node_id
            sync_a.pair_peer(keys_b["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
            sync_b.pair_peer(keys_a["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
            adapter_a.bind_peer(p2_peer_id=b_p2, porch_peer_id=porch_b.id, scope=SCOPE)
            adapter_b.bind_peer(p2_peer_id=a_p2, porch_peer_id=porch_a.id, scope=SCOPE)

            case("C01 live-porch-identities-and-encrypted-loopback", lambda: (
                require(porch_a.id != porch_b.id, "Porch identities collided"),
                require(
                    porch_a.read("network")["peers"][porch_b.id]["encrypted"] is True
                    or porch_b.read("network")["peers"][porch_a.id]["encrypted"] is True,
                    "encrypted Porch path not observed",
                ),
            ))

            store_a.admit(capsule("live-1", "live porch memory continuity anchor"))
            out = sync_a.queue_memory(b_p2, "live-1", scope=SCOPE)
            transport = adapter_a.send_outbox(out["outbox_id"])
            case("C02 live-porch-carries-p2-envelope", lambda: (
                require(transport["transport_status"] == "DELIVERED", "Porch did not deliver"),
                require(transport["p2_acknowledged"] is False, "transport falsely acknowledged memory"),
            ))

            imported = adapter_b.poll_messages()
            case("C03 remote-pv-dlam-admits-over-real-porch", lambda: (
                require(any(x.get("p2_status") == "IMPORTED" for x in imported), "P2 import missing"),
                require(len(store_b.recall(
                    "live porch memory",
                    namespace_id=SCOPE,
                    purpose="analysis",
                    target="local_model",
                )) == 1, "replica not recallable"),
            ))

            returned = adapter_a.poll_messages()
            case("C04 signed-p2-receipt-closes-live-outbox", lambda: (
                require(any(x.get("p2_status") == "ACKED" for x in returned), "P2 receipt missing"),
                require(not any(x["outbox_id"] == out["outbox_id"] for x in sync_a.pending_outbox(b_p2)), "outbox not ACKED"),
            ))

            # Restart both the Porch daemon and PV-DLAM process-local objects.
            porch_b.stop()
            porch_b.start()
            case("C05 porch-restart-preserves-peer-identity", lambda:
                require(porch_b.id == original_b_porch_id, "Porch identity changed after restart"))

            # Reconnect after restart.
            connect(porch_a, porch_b)

            store_b.close()
            p2_stores.remove(store_b)
            store_b2, sync_b2, adapter_b2 = make_p2(db_b, 3, keys_b, porch_b)
            p2_stores.append(store_b2)
            case("C06 p2-restart-preserves-pairing-binding-and-replica", lambda: (
                require(sync_b2._link(a_p2)["status"] == "ACTIVE", "P2 pairing lost"),
                require(adapter_b2.status()["active_bindings"] == 1, "Porch binding lost"),
                require(len(store_b2.recall(
                    "live porch memory",
                    namespace_id=SCOPE,
                    purpose="analysis",
                    target="local_model",
                )) == 1, "replica lost"),
            ))
            sync_b, adapter_b, store_b = sync_b2, adapter_b2, store_b2

            store_a.admit(capsule("restart-2", "post restart live transport"))
            out2 = sync_a.queue_memory(b_p2, "restart-2", scope=SCOPE)
            adapter_a.send_outbox(out2["outbox_id"])
            adapter_b.poll_messages()
            adapter_a.poll_messages()
            case("C07 sync-resumes-after-live-porch-and-p2-restart", lambda:
                require(not any(x["outbox_id"] == out2["outbox_id"] for x in sync_a.pending_outbox(b_p2)), "post-restart sync not acknowledged"))

            # Create a real transport outage: provider Porch B is stopped.
            porch_b.stop()
            store_a.admit(capsule("offline-3", "queued during real porch outage"))
            out3 = sync_a.queue_memory(b_p2, "offline-3", scope=SCOPE)
            queued = adapter_a.send_outbox(out3["outbox_id"], queue_if_offline=True)
            case("C08 outage-keeps-p2-pending-while-porch-queues", lambda: (
                require(queued["transport_status"] == "QUEUED", "Porch did not queue during outage"),
                require(any(x["outbox_id"] == out3["outbox_id"] for x in sync_a.pending_outbox(b_p2)), "P2 outbox falsely ACKED"),
            ))

            # Provider returns but revokes the old message grant before reconnection.
            porch_b.start()
            require(porch_b.id == original_b_porch_id, "Porch B identity changed")
            porch_b.call("grant.revoke", {"nonce": grant_b_to_a["payload"]["nonce"]})

            # P2 current-authority frontier advances independently too. Re-pair at
            # epoch 2 only after the old epoch-1 envelope has already been created.
            sync_b.revoke_peer(a_p2)
            sync_b.pair_peer(keys_a["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=2)

            connect(porch_a, porch_b)
            retried = porch_a.call("message.retry", {})
            case("C09 revoked-porch-grant-refuses-queued-retry", lambda: (
                require(any(x["id"] == out3["envelope"]["envelope_id"] and x["status"] == "REFUSED" for x in retried), "revoked queued message not refused"),
                require(len(store_b.recall(
                    "queued during real porch outage",
                    namespace_id=SCOPE,
                    purpose="analysis",
                    target="local_model",
                )) == 0, "revoked transport delivered memory"),
            ))

            # Fresh Porch transport authority is issued, but the old signed P2
            # envelope remains epoch 1. Transport can carry it; PV-DLAM must reject it.
            fresh_grant_b_to_a = message_grant(porch_b, porch_a)
            resent = adapter_a.send_outbox(out3["outbox_id"], queue_if_offline=False)
            require(resent["transport_status"] == "DELIVERED", "fresh Porch grant did not carry old envelope")
            stale_message = newest_p2_message(porch_b, PorchP2Adapter.CARRIER_SCHEMA)
            case("C10 fresh-transport-cannot-revive-stale-p2-authority", lambda:
                expect(SyncDenied, lambda: adapter_b.process_message(stale_message)))
            case("C11 stale-epoch-envelope-does-not-admit-memory", lambda:
                require(len(store_b.recall(
                    "queued during real porch outage",
                    namespace_id=SCOPE,
                    purpose="analysis",
                    target="local_model",
                )) == 0, "stale epoch admitted memory"))

            # Refresh P2 authority on the sender and create a new envelope.
            sync_a.pair_peer(keys_b["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=2)
            store_a.admit(capsule("fresh-4", "fresh epoch after revocation"))
            out4 = sync_a.queue_memory(b_p2, "fresh-4", scope=SCOPE)
            adapter_a.send_outbox(out4["outbox_id"], queue_if_offline=False)
            adapter_b.poll_messages()
            adapter_a.poll_messages()
            case("C12 refreshed-p2-epoch-restores-sync", lambda: (
                require(len(store_b.recall(
                    "fresh epoch after revocation",
                    namespace_id=SCOPE,
                    purpose="analysis",
                    target="local_model",
                )) == 1, "fresh epoch memory missing"),
                require(not any(x["outbox_id"] == out4["outbox_id"] for x in sync_a.pending_outbox(b_p2)), "fresh outbox not ACKED"),
            ))

            case("C13 revocation-and-restart-remain-auditable", lambda: (
                require(any(x["revoked"] for x in porch_b.read("grants")), "Porch grant revocation not durable"),
                require(porch_b.read("doctor")["ledger_chain"] == "VERIFIED", "Porch B ledger failed"),
                require(porch_a.read("doctor")["ledger_chain"] == "VERIFIED", "Porch A ledger failed"),
                require(adapter_a.status()["authority_granted"] is False, "adapter authority leak"),
                require(adapter_b.status()["authority_granted"] is False, "adapter authority leak"),
            ))

            case("C14 live-qualification-is-loopback-not-physical", lambda: (
                require(os.environ.get("GITHUB_ACTIONS") == "true", "expected hosted qualification environment"),
                require(PORCH_ROOT.exists(), "pinned Porch source missing"),
            ))

            # The opposite direction still works using A's provider-issued grant
            # for B, proving bidirectional receipt transport survived the scenario.
            store_b.admit(capsule("reverse-5", "reverse direction final receipt"))
            reverse = sync_b.queue_memory(a_p2, "reverse-5", scope=SCOPE)
            sent_reverse = adapter_b.send_outbox(reverse["outbox_id"])
            require(sent_reverse["transport_status"] == "DELIVERED", "reverse transport failed")
            adapter_a.poll_messages()
            adapter_b.poll_messages()
            case("C15 bidirectional-sync-survives-closeout", lambda:
                require(len(store_a.recall(
                    "reverse direction final",
                    namespace_id=SCOPE,
                    purpose="analysis",
                    target="local_model",
                )) == 1, "reverse replica missing"))

            # Preserve references so the test records that both provider grants
            # existed as explicit authority, not adapter-created state.
            case("C16 adapter-never-owned-porch-authority", lambda: (
                require(grant_a_to_b["payload"]["capability"] == "message.direct", "A->B grant malformed"),
                require(fresh_grant_b_to_a["payload"]["capability"] == "message.direct", "fresh B->A grant malformed"),
            ))

        finally:
            for store in list(p2_stores):
                try:
                    store.close()
                except Exception:
                    pass
            for node in reversed(porch_nodes):
                try:
                    node.stop()
                except Exception:
                    pass

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
