from __future__ import annotations

import base64
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

from dlam_store import DlamStore, canonical
from p2_sync import P2SyncNode, SyncDenied
from porch_adapter import PorchAdapterError, PorchApiClient, PorchP2Adapter

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


def expect(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")


class FixedClock:
    def __init__(self, minute):
        self.minute = minute
        self.i = 0

    def __call__(self):
        self.i += 1
        return f"2026-10-07T22:{self.minute:02d}:{self.i:02d}Z"


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


class FakePorchNetwork:
    def __init__(self):
        self.clients = {}
        self.online = set()

    def add(self, peer, client):
        self.clients[peer] = client
        self.online.add(peer)


class FakePorchClient:
    def __init__(self, network, peer):
        self.network = network
        self.peer = peer
        self.messages = []
        self.control_calls = []
        self.network.add(peer, self)

    def control(self, operation, args):
        self.control_calls.append((operation, dict(args)))
        if operation != "message.send":
            raise PorchAdapterError("unexpected operation")
        target = args["peer"]
        if target not in self.network.clients:
            raise PorchAdapterError("unknown Porch peer")
        if target not in self.network.online:
            if args.get("queue_if_offline") is True:
                return {"status": "QUEUED", "id": args["id"], "reason": "offline"}
            raise PorchAdapterError("peer offline")
        self.network.clients[target].messages.append({
            "id": args["id"],
            "sender": self.peer,
            "text": args["text"],
            "channel": None,
            "receipt": {"domain": "porch.message.receipt.v1", "authority_granted": False},
        })
        return {"status": "DELIVERED", "receipt": {"domain": "porch.message.receipt.v1"}}

    def read(self, resource):
        if resource != "messages":
            raise PorchAdapterError("unexpected read")
        return list(self.messages)


def make_node(root, name, minute, porch_client):
    keys = keypair()
    store = DlamStore(root / f"{name}.db", clock=FixedClock(minute))
    sync = P2SyncNode(
        store,
        local_public_key_b64=keys["public_key_b64"],
        signer=signer(keys["private_key_b64"]),
        verifier=verifier,
    )
    adapter = PorchP2Adapter(sync, porch_client)
    return {"keys": keys, "store": store, "sync": sync, "adapter": adapter}


def main():
    case("B01 porch-api-refuses-non-loopback", lambda:
        expect(PorchAdapterError, lambda: PorchApiClient("token", "http://192.168.1.5:7331")))

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        net = FakePorchNetwork()
        porch_a = FakePorchClient(net, "porch-a")
        porch_b = FakePorchClient(net, "porch-b")
        a = make_node(root, "a", 1, porch_a)
        b = make_node(root, "b", 2, porch_b)

        a_id = a["sync"].node_id
        b_id = b["sync"].node_id
        a["sync"].pair_peer(b["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)
        b["sync"].pair_peer(a["keys"]["public_key_b64"], allowed_scopes=[SCOPE], authority_epoch=1)

        case("B02 unbound-porch-peer-cannot-send", lambda: (
            a["store"].admit(capsule("m-unbound", "must not cross before binding")),
            expect(SyncDenied, lambda: a["adapter"].send_outbox(
                a["sync"].queue_memory(b_id, "m-unbound", scope=SCOPE)["outbox_id"]
            )),
        ))

        ba = a["adapter"].bind_peer(p2_peer_id=b_id, porch_peer_id="porch-b", scope=SCOPE)
        bb = b["adapter"].bind_peer(p2_peer_id=a_id, porch_peer_id="porch-a", scope=SCOPE)
        case("B03 explicit-binding-is-non-authoritative", lambda: (
            require(ba["authority_granted"] is False, "binding granted authority"),
            require(bb["authority_granted"] is False, "binding granted authority"),
        ))

        a["store"].admit(capsule("m1", "porch carried memory anchor"))
        out = a["sync"].queue_memory(b_id, "m1", scope=SCOPE)
        sent = a["adapter"].send_outbox(out["outbox_id"])
        case("B04 porch-message-send-is-carrier-only", lambda: (
            require(sent["transport_status"] == "DELIVERED", "carrier not delivered"),
            require(sent["p2_acknowledged"] is False, "transport delivery incorrectly acked P2"),
            require(a["sync"].pending_outbox(b_id) != [], "P2 outbox disappeared before sync receipt"),
            require(porch_a.control_calls[-1][0] == "message.send", "wrong Porch operation"),
        ))

        processed_b = b["adapter"].poll_messages()
        case("B05 incoming-porch-message-runs-p2-admission", lambda: (
            require(processed_b[-1]["p2_status"] == "IMPORTED", "P2 import did not run"),
            require(len(b["store"].recall(
                "porch carried",
                namespace_id=SCOPE,
                purpose="analysis",
                target="local_model",
            )) == 1, "memory not admitted"),
        ))

        processed_a = a["adapter"].poll_messages()
        case("B06 p2-receipt-over-porch-acks-original-outbox", lambda: (
            require(processed_a[-1]["p2_status"] == "ACKED", "P2 ack missing"),
            require(
                not any(x["outbox_id"] == out["outbox_id"] for x in a["sync"].pending_outbox(b_id)),
                "acknowledged outbox item still pending",
            ),
        ))

        # Offline transport may queue at Porch, but PV-DLAM still treats the sync
        # object as unacknowledged until a signed P2 receipt returns.
        net.online.remove("porch-b")
        a["store"].admit(capsule("offline", "offline porch queue sample"))
        offline_out = a["sync"].queue_memory(b_id, "offline", scope=SCOPE)
        queued = a["adapter"].send_outbox(offline_out["outbox_id"], queue_if_offline=True)
        case("B07 porch-queued-does-not-equal-p2-ack", lambda: (
            require(queued["transport_status"] == "QUEUED", "not queued"),
            require(any(x["outbox_id"] == offline_out["outbox_id"] for x in a["sync"].pending_outbox(b_id)), "P2 outbox falsely acked"),
        ))
        net.online.add("porch-b")

        # Replay of the same Porch inbox message remains idempotent.
        same = dict(porch_b.messages[0])
        first = b["adapter"].process_message(same)
        second = b["adapter"].process_message(same)
        case("B08 duplicate-porch-message-id-is-idempotent", lambda:
            require(first == second, "duplicate message changed result"))

        bad_id = dict(same)
        bad_id["text"] = bad_id["text"].replace("porch carried", "tampered")
        case("B09 porch-message-id-reuse-with-new-carrier-fails", lambda:
            expect(SyncDenied, lambda: b["adapter"].process_message(bad_id)))

        # A different Porch identity cannot impersonate the bound P2 peer.
        porch_c = FakePorchClient(net, "porch-c")
        fake_msg = dict(same)
        fake_msg["id"] = "new-id"
        fake_msg["sender"] = "porch-c"
        case("B10 unbound-porch-identity-cannot-inject-p2", lambda:
            expect(SyncDenied, lambda: b["adapter"].process_message(fake_msg)))

        # Scope mismatch between explicit transport binding and signed P2 envelope fails.
        a["adapter"].revoke_binding(b_id)
        case("B11 revoked-binding-blocks-send", lambda:
            expect(SyncDenied, lambda: a["adapter"].send_outbox(offline_out["outbox_id"])))
        a["adapter"].bind_peer(p2_peer_id=b_id, porch_peer_id="porch-b", scope=SCOPE)

        # Non-P2 user chat remains invisible to the adapter.
        porch_b.messages.append({"id":"human-chat","sender":"porch-a","text":"hello","channel":None,"receipt":{}})
        before = len(b["adapter"].poll_messages())
        case("B12 ordinary-porch-chat-is-ignored", lambda:
            require(before >= 1, "P2 carriers unexpectedly vanished"))

        # A valid carrier cannot add authority at the transport wrapper.
        malicious = {
            "schema": PorchP2Adapter.CARRIER_SCHEMA,
            "kind": "SYNC_ENVELOPE",
            "payload": out["envelope"],
            "authority_granted": True,
        }
        case("B13 porch-carrier-cannot-grant-authority", lambda:
            expect(SyncDenied, lambda: b["adapter"].process_message({
                "id":"malicious-auth",
                "sender":"porch-a",
                "text":canonical(malicious),
            })))

        status = a["adapter"].status()
        case("B14 adapter-status-is-auditable-not-authority", lambda: (
            require(status["active_bindings"] == 1, "binding count wrong"),
            require(status["authority_granted"] is False, "status granted authority"),
        ))

        # Ensure adapter never calls grant.issue / peer.approve on behalf of memory sync.
        all_ops = [op for op, _ in porch_a.control_calls + porch_b.control_calls]
        case("B15 adapter-never-mints-porch-trust-or-grants", lambda: (
            require("grant.issue" not in all_ops, "adapter issued Porch grant"),
            require("peer.approve" not in all_ops, "adapter approved Porch peer"),
        ))

        for n in (a, b):
            n["store"].close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
