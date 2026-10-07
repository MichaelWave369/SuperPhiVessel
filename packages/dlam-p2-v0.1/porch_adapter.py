from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from dlam_store import ValidationError, canonical
from p2_sync import P2SyncNode, SignatureError, SyncDenied


class PorchAdapterError(ValidationError):
    pass


class PorchApiClient:
    """Minimal loopback-only Infinite Porch control client.

    Matches the documented v1 control boundary:
      GET  /v1/<resource>
      POST /v1/control {"operation": ..., "args": ...}
    """

    def __init__(self, token: str, base_url: str = "http://127.0.0.1:7331") -> None:
        if not isinstance(token, str) or not token:
            raise PorchAdapterError("Porch bearer token is required")
        parsed = urllib.parse.urlparse(base_url)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "::1"}:
            raise PorchAdapterError("Porch control API must be loopback HTTP")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise PorchAdapterError("Porch control API URL contains forbidden components")
        self.token = token
        self.base = base_url.rstrip("/")
        # Never let environment proxy settings intercept the privileged local
        # Porch control plane.
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def _request(self, path: str, body: dict[str, Any] | None = None) -> Any:
        url = self.base + path
        headers = {
            "Authorization": "Bearer " + self.token,
            "Accept": "application/json",
        }
        data = None
        method = "GET"
        if body is not None:
            method = "POST"
            headers["Content-Type"] = "application/json"
            data = canonical(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.http.open(req, timeout=30) as resp:
                payload = resp.read(32 * 1024 * 1024 + 1)
                if len(payload) > 32 * 1024 * 1024:
                    raise PorchAdapterError("Porch API response too large")
                return json.loads(payload.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read(4096).decode("utf-8", errors="replace")
            raise PorchAdapterError(f"Porch API refused: {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise PorchAdapterError("Porch API unavailable") from exc

    def read(self, resource: str) -> Any:
        if not isinstance(resource, str) or not resource.isalpha():
            raise PorchAdapterError("invalid Porch API resource")
        return self._request("/v1/" + resource)

    def control(self, operation: str, args: dict[str, Any]) -> Any:
        if not isinstance(operation, str) or not operation:
            raise PorchAdapterError("operation is required")
        if not isinstance(args, dict):
            raise PorchAdapterError("args must be an object")
        return self._request("/v1/control", {"operation": operation, "args": args})


class PorchP2Adapter:
    """Thin transport adapter from PV-DLAM P2 envelopes to Infinite Porch messages.

    Porch owns peer trust, grants, encrypted transport and message delivery.
    PV-DLAM owns memory admission, tombstones and sync receipts.
    """

    CARRIER_SCHEMA = "superphivessel.dlam.p2.porch-carrier.v0.1"
    MAX_CARRIER_BYTES = 60 * 1024

    def __init__(self, sync: P2SyncNode, porch_client: Any) -> None:
        if not hasattr(porch_client, "control") or not hasattr(porch_client, "read"):
            raise PorchAdapterError("Porch client must expose control() and read()")
        self.sync = sync
        self.conn = sync.conn
        self.porch = porch_client
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS p2b_porch_bindings(
              p2_peer_id TEXT PRIMARY KEY,
              porch_peer_id TEXT NOT NULL UNIQUE,
              scope TEXT NOT NULL,
              status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVOKED'))
            );

            CREATE TABLE IF NOT EXISTS p2b_transport_receipts(
              message_id TEXT PRIMARY KEY,
              porch_peer_id TEXT NOT NULL,
              direction TEXT NOT NULL CHECK(direction IN ('OUTBOUND','INBOUND')),
              carrier_hash TEXT NOT NULL,
              transport_status TEXT NOT NULL,
              receipt_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS p2b_seen_messages(
              porch_peer_id TEXT NOT NULL,
              message_id TEXT NOT NULL,
              carrier_hash TEXT NOT NULL,
              result_json TEXT NOT NULL,
              PRIMARY KEY(porch_peer_id,message_id)
            );
            """
        )
        self.conn.commit()

    def bind_peer(self, *, p2_peer_id: str, porch_peer_id: str, scope: str) -> dict[str, Any]:
        if not all(isinstance(x, str) and x for x in (p2_peer_id, porch_peer_id, scope)):
            raise PorchAdapterError("binding fields must be non-empty strings")
        # Require an already-paired P2 identity. The adapter cannot manufacture trust.
        link = self.sync._link(p2_peer_id)
        if link["status"] != "ACTIVE":
            raise SyncDenied("P2 peer is not active")
        if scope not in link["scopes"]:
            raise SyncDenied("binding scope is not authorized in P2")
        self.conn.execute(
            """
            INSERT INTO p2b_porch_bindings(p2_peer_id,porch_peer_id,scope,status)
            VALUES(?,?,?,'ACTIVE')
            ON CONFLICT(p2_peer_id) DO UPDATE SET
              porch_peer_id=excluded.porch_peer_id,
              scope=excluded.scope,
              status='ACTIVE'
            """,
            (p2_peer_id, porch_peer_id, scope),
        )
        self.conn.commit()
        return {
            "p2_peer_id": p2_peer_id,
            "porch_peer_id": porch_peer_id,
            "scope": scope,
            "status": "ACTIVE",
            "authority_granted": False,
        }

    def revoke_binding(self, p2_peer_id: str) -> dict[str, Any]:
        changed = self.conn.execute(
            "UPDATE p2b_porch_bindings SET status='REVOKED' WHERE p2_peer_id=?",
            (p2_peer_id,),
        ).rowcount
        if changed != 1:
            raise PorchAdapterError("unknown P2/Porch binding")
        self.conn.commit()
        return {"p2_peer_id": p2_peer_id, "status": "REVOKED", "authority_granted": False}

    def _binding_by_p2(self, p2_peer_id: str) -> dict[str, str]:
        row = self.conn.execute(
            "SELECT * FROM p2b_porch_bindings WHERE p2_peer_id=?",
            (p2_peer_id,),
        ).fetchone()
        if row is None or row["status"] != "ACTIVE":
            raise SyncDenied("active P2/Porch binding required")
        return dict(row)

    def _binding_by_porch(self, porch_peer_id: str) -> dict[str, str]:
        row = self.conn.execute(
            "SELECT * FROM p2b_porch_bindings WHERE porch_peer_id=?",
            (porch_peer_id,),
        ).fetchone()
        if row is None or row["status"] != "ACTIVE":
            raise SyncDenied("unbound or revoked Porch peer")
        return dict(row)

    @staticmethod
    def _carrier_hash(carrier: dict[str, Any]) -> str:
        return hashlib.sha256(("PV-DLAM-P2-PORCH|" + canonical(carrier)).encode("utf-8")).hexdigest()

    def _encode_carrier(self, kind: str, payload: dict[str, Any]) -> tuple[str, str]:
        carrier = {
            "schema": self.CARRIER_SCHEMA,
            "kind": kind,
            "payload": payload,
            "authority_granted": False,
        }
        text = canonical(carrier)
        if len(text.encode("utf-8")) > self.MAX_CARRIER_BYTES:
            raise PorchAdapterError("P2 Porch carrier exceeds bounded message size")
        return text, self._carrier_hash(carrier)

    def _decode_carrier(self, text: str) -> tuple[dict[str, Any], str]:
        if not isinstance(text, str) or not text:
            raise PorchAdapterError("Porch message text is empty")
        if len(text.encode("utf-8")) > self.MAX_CARRIER_BYTES:
            raise PorchAdapterError("P2 Porch carrier exceeds bounded message size")
        try:
            carrier = json.loads(text)
        except json.JSONDecodeError as exc:
            raise PorchAdapterError("Porch message is not a P2 carrier") from exc
        if not isinstance(carrier, dict) or carrier.get("schema") != self.CARRIER_SCHEMA:
            raise PorchAdapterError("unsupported Porch carrier schema")
        if carrier.get("kind") not in {"SYNC_ENVELOPE", "SYNC_RECEIPT"}:
            raise PorchAdapterError("unsupported Porch carrier kind")
        if carrier.get("authority_granted") is not False:
            raise SyncDenied("Porch carrier attempted authority grant")
        if not isinstance(carrier.get("payload"), dict):
            raise PorchAdapterError("carrier payload missing")
        return carrier, self._carrier_hash(carrier)

    def _outbox_row(self, outbox_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM p2_outbox WHERE outbox_id=?",
            (outbox_id,),
        ).fetchone()
        if row is None:
            raise PorchAdapterError("unknown P2 outbox ID")
        return dict(row)

    def send_outbox(self, outbox_id: str, *, queue_if_offline: bool = True) -> dict[str, Any]:
        row = self._outbox_row(outbox_id)
        binding = self._binding_by_p2(row["recipient_peer_id"])
        envelope = json.loads(row["envelope_json"])
        scope = envelope["body"]["scope"]
        if binding["scope"] != scope:
            raise SyncDenied("Porch binding scope does not match P2 envelope scope")

        text, carrier_hash = self._encode_carrier("SYNC_ENVELOPE", envelope)
        result = self.porch.control(
            "message.send",
            {
                "peer": binding["porch_peer_id"],
                "text": text,
                "id": envelope["envelope_id"],
                "queue_if_offline": bool(queue_if_offline),
            },
        )
        status = result.get("status")
        if status not in {"DELIVERED", "QUEUED"}:
            raise PorchAdapterError("unexpected Porch message status")
        receipt = {
            "schema": "superphivessel.dlam.p2.porch-transport-receipt.v0.1",
            "outbox_id": outbox_id,
            "envelope_id": envelope["envelope_id"],
            "porch_peer_id": binding["porch_peer_id"],
            "transport_status": status,
            "carrier_hash": carrier_hash,
            "porch_result": result,
            "p2_acknowledged": False,
            "authority_granted": False,
        }
        self.conn.execute(
            """
            INSERT OR REPLACE INTO p2b_transport_receipts(
              message_id,porch_peer_id,direction,carrier_hash,transport_status,receipt_json
            ) VALUES(?,?,'OUTBOUND',?,?,?)
            """,
            (envelope["envelope_id"], binding["porch_peer_id"], carrier_hash, status, canonical(receipt)),
        )
        self.conn.commit()
        return receipt

    def _send_receipt(self, *, binding: dict[str, str], receipt: dict[str, Any]) -> dict[str, Any]:
        text, carrier_hash = self._encode_carrier("SYNC_RECEIPT", receipt)
        message_id = receipt["receipt_id"]
        result = self.porch.control(
            "message.send",
            {
                "peer": binding["porch_peer_id"],
                "text": text,
                "id": message_id,
                "queue_if_offline": True,
            },
        )
        if result.get("status") not in {"DELIVERED", "QUEUED"}:
            raise PorchAdapterError("unexpected Porch receipt transport status")
        self.conn.execute(
            """
            INSERT OR REPLACE INTO p2b_transport_receipts(
              message_id,porch_peer_id,direction,carrier_hash,transport_status,receipt_json
            ) VALUES(?,?,'OUTBOUND',?,?,?)
            """,
            (message_id, binding["porch_peer_id"], carrier_hash, result["status"], canonical(result)),
        )
        self.conn.commit()
        return result

    def process_message(self, message: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(message, dict):
            raise PorchAdapterError("Porch inbox record must be an object")
        message_id = message.get("id")
        sender = message.get("sender")
        text = message.get("text")
        if not all(isinstance(x, str) and x for x in (message_id, sender, text)):
            raise PorchAdapterError("Porch inbox record missing id/sender/text")

        binding = self._binding_by_porch(sender)
        carrier, carrier_hash = self._decode_carrier(text)

        seen = self.conn.execute(
            "SELECT carrier_hash,result_json FROM p2b_seen_messages WHERE porch_peer_id=? AND message_id=?",
            (sender, message_id),
        ).fetchone()
        if seen is not None:
            if seen["carrier_hash"] != carrier_hash:
                raise SyncDenied("Porch message ID reused with different carrier")
            return json.loads(seen["result_json"])

        if carrier["kind"] == "SYNC_ENVELOPE":
            envelope = carrier["payload"]
            body = envelope.get("body", {})
            if body.get("source_peer_id") != binding["p2_peer_id"]:
                raise SyncDenied("Porch sender is not bound to P2 envelope source")
            if body.get("scope") != binding["scope"]:
                raise SyncDenied("Porch binding scope does not match incoming P2 scope")
            receipt = self.sync.receive(envelope)
            porch_result = self._send_receipt(binding=binding, receipt=receipt)
            result = {
                "kind": "SYNC_ENVELOPE",
                "p2_status": receipt["body"]["status"],
                "receipt_id": receipt["receipt_id"],
                "reply_transport_status": porch_result["status"],
                "authority_granted": False,
            }
        else:
            receipt = carrier["payload"]
            body = receipt.get("body", {})
            if body.get("source_peer_id") != binding["p2_peer_id"]:
                raise SyncDenied("Porch sender is not bound to P2 receipt source")
            envelope_id = body.get("envelope_id")
            row = self.conn.execute(
                "SELECT outbox_id FROM p2_outbox WHERE envelope_id=?",
                (envelope_id,),
            ).fetchone()
            if row is None:
                raise PorchAdapterError("receipt references unknown P2 envelope")
            ack = self.sync.acknowledge(row["outbox_id"], receipt)
            result = {
                "kind": "SYNC_RECEIPT",
                "p2_status": ack["status"],
                "outbox_id": row["outbox_id"],
                "receipt_id": receipt["receipt_id"],
                "authority_granted": False,
            }

        self.conn.execute(
            """
            INSERT INTO p2b_seen_messages(
              porch_peer_id,message_id,carrier_hash,result_json
            ) VALUES(?,?,?,?)
            """,
            (sender, message_id, carrier_hash, canonical(result)),
        )
        self.conn.execute(
            """
            INSERT OR REPLACE INTO p2b_transport_receipts(
              message_id,porch_peer_id,direction,carrier_hash,transport_status,receipt_json
            ) VALUES(?,?,'INBOUND',?,'PROCESSED',?)
            """,
            (message_id, sender, carrier_hash, canonical(result)),
        )
        self.conn.commit()
        return result

    def poll_messages(self) -> list[dict[str, Any]]:
        records = self.porch.read("messages")
        if not isinstance(records, list):
            raise PorchAdapterError("Porch messages response must be a list")
        results = []
        # Porch returns newest first. Processing oldest first preserves a more
        # natural causal order while P2 itself remains replay/idempotency-safe.
        for message in reversed(records):
            try:
                carrier = json.loads(message.get("text", ""))
            except Exception:
                continue
            if not isinstance(carrier, dict) or carrier.get("schema") != self.CARRIER_SCHEMA:
                continue
            results.append(self.process_message(message))
        return results

    def status(self) -> dict[str, Any]:
        return {
            "schema": "superphivessel.dlam.p2.porch-adapter-status.v0.1",
            "active_bindings": int(self.conn.execute(
                "SELECT COUNT(*) FROM p2b_porch_bindings WHERE status='ACTIVE'"
            ).fetchone()[0]),
            "revoked_bindings": int(self.conn.execute(
                "SELECT COUNT(*) FROM p2b_porch_bindings WHERE status='REVOKED'"
            ).fetchone()[0]),
            "processed_messages": int(self.conn.execute(
                "SELECT COUNT(*) FROM p2b_seen_messages"
            ).fetchone()[0]),
            "authority_granted": False,
        }
