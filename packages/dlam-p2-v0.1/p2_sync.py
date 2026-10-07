from __future__ import annotations

import base64
import hashlib
import json
from typing import Any, Callable

from dlam_store import DlamStore, ValidationError, canonical, sha256_text


class SyncError(ValidationError):
    pass


class SyncDenied(SyncError):
    pass


class SignatureError(SyncError):
    pass


ALLOWED_OBJECT_TYPES = {"MEMORY_ADMIT", "MEMORY_TOMBSTONE"}
ENVELOPE_DOMAIN = b"PV-DLAM-P2-ENVELOPE\\0"
RECEIPT_DOMAIN = b"PV-DLAM-P2-RECEIPT\\0"


def peer_id_from_public_key(public_key_b64: str) -> str:
    try:
        raw = base64.b64decode(public_key_b64, validate=True)
    except Exception as exc:
        raise ValidationError("invalid peer public key encoding") from exc
    if not raw:
        raise ValidationError("empty peer public key")
    return "peer:" + hashlib.sha256(raw).hexdigest()[:32]


def _scan_authority_fields(value: Any, *, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            lower = str(key).lower()
            if lower == "authority_granted" and child is not False:
                raise SyncDenied(f"transport object attempted authority grant at {path}.{key}")
            if lower == "action_authority" and child not in (None, "NONE"):
                raise SyncDenied(f"transport object attempted action authority at {path}.{key}")
            _scan_authority_fields(child, path=f"{path}.{key}")
    elif isinstance(value, list):
        for idx, child in enumerate(value):
            _scan_authority_fields(child, path=f"{path}[{idx}]")


class P2SyncNode:
    SCHEMA = "superphivessel.dlam.p2.v0.1"

    def __init__(
        self,
        store: DlamStore,
        *,
        local_public_key_b64: str,
        signer: Callable[[bytes], str],
        verifier: Callable[[str, bytes, str], bool],
    ) -> None:
        if not callable(signer) or not callable(verifier):
            raise ValidationError("signer and verifier callbacks are required")
        self.store = store
        self.conn = store.conn
        self.local_public_key_b64 = local_public_key_b64
        self.node_id = peer_id_from_public_key(local_public_key_b64)
        self.signer = signer
        self.verifier = verifier
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS p2_peer_links(
              peer_id TEXT PRIMARY KEY,
              public_key_b64 TEXT NOT NULL,
              status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
              authority_epoch INTEGER NOT NULL,
              scopes_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS p2_outbox(
              outbox_id TEXT PRIMARY KEY,
              recipient_peer_id TEXT NOT NULL,
              sequence INTEGER NOT NULL,
              envelope_id TEXT NOT NULL UNIQUE,
              envelope_json TEXT NOT NULL,
              status TEXT NOT NULL CHECK(status IN ('QUEUED','ACKED')),
              ack_receipt_json TEXT,
              created_at TEXT NOT NULL,
              UNIQUE(recipient_peer_id, sequence)
            );

            CREATE TABLE IF NOT EXISTS p2_inbox_receipts(
              envelope_id TEXT PRIMARY KEY,
              source_peer_id TEXT NOT NULL,
              receipt_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS p2_remote_objects(
              source_peer_id TEXT NOT NULL,
              source_memory_id TEXT NOT NULL,
              object_hash TEXT NOT NULL,
              local_memory_id TEXT,
              source_sequence INTEGER NOT NULL,
              scope TEXT NOT NULL,
              status TEXT NOT NULL,
              object_json TEXT NOT NULL,
              PRIMARY KEY(source_peer_id, source_memory_id)
            );

            CREATE TABLE IF NOT EXISTS p2_remote_tombstones(
              source_peer_id TEXT NOT NULL,
              source_memory_id TEXT NOT NULL,
              source_sequence INTEGER NOT NULL,
              object_hash TEXT NOT NULL,
              PRIMARY KEY(source_peer_id, source_memory_id)
            );

            CREATE TABLE IF NOT EXISTS p2_remote_relations(
              source_peer_id TEXT NOT NULL,
              from_source_memory_id TEXT NOT NULL,
              relation TEXT NOT NULL,
              to_source_memory_id TEXT NOT NULL,
              PRIMARY KEY(source_peer_id, from_source_memory_id, relation, to_source_memory_id)
            );

            CREATE INDEX IF NOT EXISTS idx_p2_outbox_peer_status
              ON p2_outbox(recipient_peer_id,status,sequence);
            CREATE INDEX IF NOT EXISTS idx_p2_remote_local
              ON p2_remote_objects(local_memory_id);
            """
        )
        self.conn.commit()

    def pair_peer(
        self,
        public_key_b64: str,
        *,
        allowed_scopes: list[str],
        authority_epoch: int = 1,
    ) -> str:
        peer_id = peer_id_from_public_key(public_key_b64)
        if peer_id == self.node_id:
            raise ValidationError("cannot pair local identity with itself")
        scopes = sorted(set(allowed_scopes))
        if not scopes or len(scopes) > 32 or not all(isinstance(x, str) and x for x in scopes):
            raise ValidationError("allowed_scopes must contain 1..32 non-empty strings")
        if not isinstance(authority_epoch, int) or isinstance(authority_epoch, bool) or authority_epoch < 1:
            raise ValidationError("authority_epoch must be a positive integer")

        row = self.conn.execute(
            "SELECT public_key_b64 FROM p2_peer_links WHERE peer_id=?",
            (peer_id,),
        ).fetchone()
        if row is not None and row["public_key_b64"] != public_key_b64:
            raise ValidationError("peer identity collision")
        self.conn.execute(
            """
            INSERT INTO p2_peer_links(peer_id,public_key_b64,status,authority_epoch,scopes_json)
            VALUES(?,?,'ACTIVE',?,?)
            ON CONFLICT(peer_id) DO UPDATE SET
              public_key_b64=excluded.public_key_b64,
              status='ACTIVE',
              authority_epoch=excluded.authority_epoch,
              scopes_json=excluded.scopes_json
            """,
            (peer_id, public_key_b64, authority_epoch, canonical(scopes)),
        )
        self.conn.commit()
        return peer_id

    def revoke_peer(self, peer_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT authority_epoch FROM p2_peer_links WHERE peer_id=?",
            (peer_id,),
        ).fetchone()
        if row is None:
            raise ValidationError("unknown peer")
        new_epoch = int(row["authority_epoch"]) + 1
        self.conn.execute(
            "UPDATE p2_peer_links SET status='REVOKED',authority_epoch=? WHERE peer_id=?",
            (new_epoch, peer_id),
        )
        self.conn.commit()
        return {
            "peer_id": peer_id,
            "status": "REVOKED",
            "authority_epoch": new_epoch,
            "authority_granted": False,
        }

    def _link(self, peer_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM p2_peer_links WHERE peer_id=?",
            (peer_id,),
        ).fetchone()
        if row is None:
            raise SyncDenied("peer is not paired")
        return {
            "peer_id": row["peer_id"],
            "public_key_b64": row["public_key_b64"],
            "status": row["status"],
            "authority_epoch": int(row["authority_epoch"]),
            "scopes": json.loads(row["scopes_json"]),
        }

    @staticmethod
    def _require_scope(link: dict[str, Any], scope: str) -> None:
        if link["status"] != "ACTIVE":
            raise SyncDenied("peer is revoked")
        if scope not in link["scopes"]:
            raise SyncDenied("scope is not authorized")

    def _next_outbox_sequence(self, recipient_peer_id: str) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(MAX(sequence),0)+1 FROM p2_outbox WHERE recipient_peer_id=?",
            (recipient_peer_id,),
        ).fetchone()
        return int(row[0])

    def _memory_object(self, memory_id: str) -> dict[str, Any]:
        row = self.store.get_memory(memory_id)
        if row is None:
            raise ValidationError("unknown memory_id")
        if row["tombstoned"]:
            raise ValidationError("memory is tombstoned; export its tombstone state instead")
        if str(row["sensitivity"]).upper() == "SEALED":
            raise SyncDenied("sealed memory cannot be exported")

        targets = [r[0] for r in self.conn.execute(
            "SELECT target FROM memory_targets WHERE memory_id=? ORDER BY target",
            (memory_id,),
        ).fetchall()]
        purposes = [r[0] for r in self.conn.execute(
            "SELECT purpose FROM memory_purposes WHERE memory_id=? ORDER BY purpose",
            (memory_id,),
        ).fetchall()]
        object_body = {
            "object_type": "MEMORY_ADMIT",
            "source_memory_id": memory_id,
            "source_namespace_id": row["namespace_id"],
            "source_sequence": int(row["admitted_sequence"]),
            "agent_id": row["agent_id"],
            "genius_id": row["genius_id"],
            "kind": row["kind"],
            "content": row["content"],
            "content_sha256": row["content_sha256"],
            "origin": row["origin"],
            "source_status": row["source_status"],
            "sensitivity": row["sensitivity"],
            "retention_rule": row["retention_rule"],
            "allowed_targets": targets,
            "allowed_purposes": purposes,
            "evidence_refs": self.store.relation_refs(memory_id, "EVIDENCE"),
            "conflict_refs": self.store.relation_refs(memory_id, "CONTRADICTS"),
            "supersedes_refs": self.store.relation_refs(memory_id, "SUPERSEDES"),
            "derivation_parents": self.store.derivation_parent_refs(memory_id),
        }
        object_hash = sha256_text("PV-DLAM-P2-OBJECT|" + canonical(object_body))
        return {**object_body, "object_hash": object_hash}

    def _tombstone_object(self, memory_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            """
            SELECT t.reason,e.sequence,e.event_hash
            FROM tombstones t
            JOIN ledger_events e ON e.event_id=t.tombstone_event_id
            WHERE t.memory_id=?
            """,
            (memory_id,),
        ).fetchone()
        if row is None:
            raise ValidationError("memory has no tombstone")
        object_body = {
            "object_type": "MEMORY_TOMBSTONE",
            "source_memory_id": memory_id,
            "source_sequence": int(row["sequence"]),
            "reason": row["reason"],
            "source_event_hash": row["event_hash"],
        }
        object_hash = sha256_text("PV-DLAM-P2-OBJECT|" + canonical(object_body))
        return {**object_body, "object_hash": object_hash}

    @staticmethod
    def _verify_object_hash(obj: dict[str, Any]) -> None:
        object_hash = obj.get("object_hash")
        body = {k: v for k, v in obj.items() if k != "object_hash"}
        expected = sha256_text("PV-DLAM-P2-OBJECT|" + canonical(body))
        if object_hash != expected:
            raise SignatureError("object hash mismatch")

    def _seal_envelope(self, recipient_peer_id: str, *, scope: str, obj: dict[str, Any]) -> dict[str, Any]:
        link = self._link(recipient_peer_id)
        self._require_scope(link, scope)
        if obj.get("object_type") not in ALLOWED_OBJECT_TYPES:
            raise ValidationError("unsupported sync object type")
        _scan_authority_fields(obj)
        self._verify_object_hash(obj)

        sequence = self._next_outbox_sequence(recipient_peer_id)
        body = {
            "schema": "superphivessel.dlam.p2.envelope.v0.1",
            "protocol": "PV-DLAM-P2-0.1",
            "source_peer_id": self.node_id,
            "recipient_peer_id": recipient_peer_id,
            "authority_epoch": link["authority_epoch"],
            "scope": scope,
            "sequence": sequence,
            "created_at": self.store.clock(),
            "object": obj,
            "authority_granted": False,
        }
        encoded = ENVELOPE_DOMAIN + canonical(body).encode("utf-8")
        envelope_hash = hashlib.sha256(encoded).hexdigest()
        envelope = {
            "envelope_id": "p2env_" + envelope_hash[:32],
            "envelope_hash": envelope_hash,
            "body": body,
            "signature_b64": self.signer(encoded),
        }
        outbox_id = "p2out_" + envelope_hash[:32]
        self.conn.execute(
            """
            INSERT INTO p2_outbox(
              outbox_id,recipient_peer_id,sequence,envelope_id,envelope_json,
              status,ack_receipt_json,created_at
            ) VALUES(?,?,?,?,?,'QUEUED',NULL,?)
            """,
            (outbox_id, recipient_peer_id, sequence, envelope["envelope_id"],
             canonical(envelope), body["created_at"]),
        )
        self.conn.commit()
        return {"outbox_id": outbox_id, "envelope": envelope}

    def queue_memory(self, recipient_peer_id: str, memory_id: str, *, scope: str) -> dict[str, Any]:
        return self._seal_envelope(recipient_peer_id, scope=scope, obj=self._memory_object(memory_id))

    def queue_tombstone(self, recipient_peer_id: str, memory_id: str, *, scope: str) -> dict[str, Any]:
        return self._seal_envelope(recipient_peer_id, scope=scope, obj=self._tombstone_object(memory_id))

    def pending_outbox(self, peer_id: str | None = None) -> list[dict[str, Any]]:
        if peer_id is None:
            rows = self.conn.execute(
                "SELECT * FROM p2_outbox WHERE status='QUEUED' ORDER BY recipient_peer_id,sequence"
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM p2_outbox WHERE status='QUEUED' AND recipient_peer_id=? ORDER BY sequence",
                (peer_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def _local_replica_id(self, source_peer_id: str, source_memory_id: str, object_hash: str) -> str:
        digest = sha256_text(
            "PV-DLAM-P2-REPLICA|" + source_peer_id + "|" + source_memory_id + "|" + object_hash
        )
        return "peerobj_" + digest[:32]

    def _record_remote_relations(self, source_peer_id: str, obj: dict[str, Any]) -> None:
        source_id = obj["source_memory_id"]
        for relation, field in (
            ("EVIDENCE", "evidence_refs"),
            ("CONTRADICTS", "conflict_refs"),
            ("SUPERSEDES", "supersedes_refs"),
            ("DERIVES_FROM", "derivation_parents"),
        ):
            for target in sorted(set(obj.get(field, []))):
                if target == source_id:
                    continue
                self.conn.execute(
                    """
                    INSERT OR IGNORE INTO p2_remote_relations(
                      source_peer_id,from_source_memory_id,relation,to_source_memory_id
                    ) VALUES(?,?,?,?)
                    """,
                    (source_peer_id, source_id, relation, target),
                )

    def _resolve_remote_relations(self, source_peer_id: str) -> None:
        rows = self.conn.execute(
            """
            SELECT from_source_memory_id,relation,to_source_memory_id
            FROM p2_remote_relations
            WHERE source_peer_id=?
            ORDER BY from_source_memory_id,relation,to_source_memory_id
            """,
            (source_peer_id,),
        ).fetchall()
        for row in rows:
            from_map = self.conn.execute(
                "SELECT local_memory_id FROM p2_remote_objects WHERE source_peer_id=? AND source_memory_id=? AND status='IMPORTED'",
                (source_peer_id, row["from_source_memory_id"]),
            ).fetchone()
            to_map = self.conn.execute(
                "SELECT local_memory_id FROM p2_remote_objects WHERE source_peer_id=? AND source_memory_id=? AND status='IMPORTED'",
                (source_peer_id, row["to_source_memory_id"]),
            ).fetchone()
            if from_map is None or to_map is None:
                continue
            from_local = from_map["local_memory_id"]
            to_local = to_map["local_memory_id"]
            if row["relation"] == "DERIVES_FROM":
                self.conn.execute(
                    "INSERT OR IGNORE INTO derivation_edges(parent_memory_id,child_memory_id) VALUES(?,?)",
                    (to_local, from_local),
                )
            else:
                self.conn.execute(
                    "INSERT OR IGNORE INTO relations(from_memory_id,relation,to_memory_id) VALUES(?,?,?)",
                    (from_local, row["relation"], to_local),
                )

    def _apply_admit(self, source_peer_id: str, scope: str, obj: dict[str, Any]) -> tuple[str, list[str]]:
        source_id = obj["source_memory_id"]
        source_sequence = int(obj["source_sequence"])
        tomb = self.conn.execute(
            "SELECT source_sequence FROM p2_remote_tombstones WHERE source_peer_id=? AND source_memory_id=?",
            (source_peer_id, source_id),
        ).fetchone()
        if tomb is not None and source_sequence <= int(tomb["source_sequence"]):
            return "STALE_SUPPRESSED", []

        existing = self.conn.execute(
            "SELECT object_hash,local_memory_id,status FROM p2_remote_objects WHERE source_peer_id=? AND source_memory_id=?",
            (source_peer_id, source_id),
        ).fetchone()
        if existing is not None:
            if existing["object_hash"] != obj["object_hash"]:
                return "QUARANTINED_CONFLICTING_SOURCE_ID", []
            return "IDEMPOTENT", [existing["local_memory_id"]] if existing["local_memory_id"] else []

        local_id = self._local_replica_id(source_peer_id, source_id, obj["object_hash"])
        capsule = {
            "memory_id": local_id,
            "namespace_id": scope,
            "agent_id": "peer:" + source_peer_id,
            "genius_id": obj.get("genius_id"),
            "kind": obj["kind"],
            "content": obj["content"],
            "origin": obj["origin"],
            "source_status": "REMOTE_SIGNED",
            "sensitivity": obj["sensitivity"],
            "allowed_targets": obj["allowed_targets"],
            "allowed_purposes": obj["allowed_purposes"],
            "retention_rule": obj["retention_rule"],
        }
        self.store.admit(capsule)
        self.conn.execute(
            """
            INSERT INTO p2_remote_objects(
              source_peer_id,source_memory_id,object_hash,local_memory_id,
              source_sequence,scope,status,object_json
            ) VALUES(?,?,?,?,?,?,'IMPORTED',?)
            """,
            (source_peer_id, source_id, obj["object_hash"], local_id, source_sequence,
             scope, canonical(obj)),
        )
        self._record_remote_relations(source_peer_id, obj)
        self._resolve_remote_relations(source_peer_id)
        self.conn.commit()
        return "IMPORTED", [local_id]

    def _apply_tombstone(self, source_peer_id: str, obj: dict[str, Any]) -> tuple[str, list[str]]:
        source_id = obj["source_memory_id"]
        source_sequence = int(obj["source_sequence"])
        current = self.conn.execute(
            "SELECT source_sequence FROM p2_remote_tombstones WHERE source_peer_id=? AND source_memory_id=?",
            (source_peer_id, source_id),
        ).fetchone()
        if current is not None and int(current["source_sequence"]) >= source_sequence:
            return "IDEMPOTENT_TOMBSTONE", []

        self.conn.execute(
            """
            INSERT INTO p2_remote_tombstones(
              source_peer_id,source_memory_id,source_sequence,object_hash
            ) VALUES(?,?,?,?)
            ON CONFLICT(source_peer_id,source_memory_id) DO UPDATE SET
              source_sequence=excluded.source_sequence,
              object_hash=excluded.object_hash
            """,
            (source_peer_id, source_id, source_sequence, obj["object_hash"]),
        )
        mapping = self.conn.execute(
            "SELECT local_memory_id,source_sequence FROM p2_remote_objects WHERE source_peer_id=? AND source_memory_id=?",
            (source_peer_id, source_id),
        ).fetchone()
        affected: list[str] = []
        status = "TOMBSTONE_FRONTIER_RECORDED"
        if mapping is not None and source_sequence >= int(mapping["source_sequence"]):
            local_id = mapping["local_memory_id"]
            record = self.store.get_memory(local_id)
            if record is not None and not record["tombstoned"]:
                receipt = self.store.forget(
                    local_id,
                    reason="REMOTE_SIGNED_TOMBSTONE:" + source_peer_id,
                    actor="peer:" + source_peer_id,
                )
                affected = list(receipt["affected"])
            status = "TOMBSTONE_APPLIED"
        self.conn.commit()
        return status, affected

    def _receipt(self, *, envelope_id: str, recipient_peer_id: str, status: str, imported_local_ids: list[str]) -> dict[str, Any]:
        body = {
            "schema": "superphivessel.dlam.p2.receipt.v0.1",
            "source_peer_id": self.node_id,
            "recipient_peer_id": recipient_peer_id,
            "envelope_id": envelope_id,
            "status": status,
            "imported_local_ids": sorted(set(imported_local_ids)),
            "authority_granted": False,
        }
        encoded = RECEIPT_DOMAIN + canonical(body).encode("utf-8")
        digest = hashlib.sha256(encoded).hexdigest()
        return {
            "receipt_id": "p2rcpt_" + digest[:32],
            "receipt_hash": digest,
            "body": body,
            "signature_b64": self.signer(encoded),
        }

    def receive(self, envelope: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(envelope, dict) or not isinstance(envelope.get("body"), dict):
            raise ValidationError("invalid envelope")
        body = envelope["body"]
        if body.get("schema") != "superphivessel.dlam.p2.envelope.v0.1":
            raise ValidationError("unsupported envelope schema")
        if body.get("protocol") != "PV-DLAM-P2-0.1":
            raise ValidationError("unsupported sync protocol")
        if body.get("recipient_peer_id") != self.node_id:
            raise SyncDenied("wrong recipient")
        if body.get("authority_granted") is not False:
            raise SyncDenied("transport envelope may not grant authority")

        source_peer_id = body.get("source_peer_id")
        if not isinstance(source_peer_id, str) or not source_peer_id:
            raise ValidationError("source_peer_id missing")
        link = self._link(source_peer_id)
        self._require_scope(link, body.get("scope"))
        if int(body.get("authority_epoch", -1)) != link["authority_epoch"]:
            raise SyncDenied("stale authority epoch")

        encoded = ENVELOPE_DOMAIN + canonical(body).encode("utf-8")
        digest = hashlib.sha256(encoded).hexdigest()
        if envelope.get("envelope_hash") != digest:
            raise SignatureError("envelope hash mismatch")
        if envelope.get("envelope_id") != "p2env_" + digest[:32]:
            raise SignatureError("envelope id mismatch")
        if not self.verifier(link["public_key_b64"], encoded, envelope.get("signature_b64", "")):
            raise SignatureError("peer signature verification failed")

        existing = self.conn.execute(
            "SELECT receipt_json FROM p2_inbox_receipts WHERE envelope_id=?",
            (envelope["envelope_id"],),
        ).fetchone()
        if existing is not None:
            return json.loads(existing["receipt_json"])

        obj = body.get("object")
        if not isinstance(obj, dict):
            raise ValidationError("sync object missing")
        _scan_authority_fields(obj)
        if obj.get("object_type") not in ALLOWED_OBJECT_TYPES:
            raise SyncDenied("unsupported object type")
        self._verify_object_hash(obj)

        if obj["object_type"] == "MEMORY_ADMIT":
            status, imported = self._apply_admit(source_peer_id, body["scope"], obj)
        else:
            status, imported = self._apply_tombstone(source_peer_id, obj)

        receipt = self._receipt(
            envelope_id=envelope["envelope_id"],
            recipient_peer_id=source_peer_id,
            status=status,
            imported_local_ids=imported,
        )
        self.conn.execute(
            "INSERT INTO p2_inbox_receipts(envelope_id,source_peer_id,receipt_json) VALUES(?,?,?)",
            (envelope["envelope_id"], source_peer_id, canonical(receipt)),
        )
        self.conn.commit()
        return receipt

    def acknowledge(self, outbox_id: str, receipt: dict[str, Any]) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM p2_outbox WHERE outbox_id=?",
            (outbox_id,),
        ).fetchone()
        if row is None:
            raise ValidationError("unknown outbox_id")
        if not isinstance(receipt, dict) or not isinstance(receipt.get("body"), dict):
            raise ValidationError("invalid receipt")
        body = receipt["body"]
        if body.get("schema") != "superphivessel.dlam.p2.receipt.v0.1":
            raise ValidationError("unsupported receipt schema")
        if body.get("recipient_peer_id") != self.node_id:
            raise SyncDenied("receipt addressed to another node")
        if body.get("source_peer_id") != row["recipient_peer_id"]:
            raise SyncDenied("receipt source does not match outbox recipient")
        if body.get("envelope_id") != row["envelope_id"]:
            raise SyncDenied("receipt envelope mismatch")
        if body.get("authority_granted") is not False:
            raise SyncDenied("receipt attempted authority grant")

        link = self._link(row["recipient_peer_id"])
        encoded = RECEIPT_DOMAIN + canonical(body).encode("utf-8")
        digest = hashlib.sha256(encoded).hexdigest()
        if receipt.get("receipt_hash") != digest:
            raise SignatureError("receipt hash mismatch")
        if receipt.get("receipt_id") != "p2rcpt_" + digest[:32]:
            raise SignatureError("receipt id mismatch")
        if not self.verifier(link["public_key_b64"], encoded, receipt.get("signature_b64", "")):
            raise SignatureError("receipt signature verification failed")

        self.conn.execute(
            "UPDATE p2_outbox SET status='ACKED',ack_receipt_json=? WHERE outbox_id=?",
            (canonical(receipt), outbox_id),
        )
        self.conn.commit()
        return {
            "outbox_id": outbox_id,
            "status": "ACKED",
            "receipt_id": receipt["receipt_id"],
            "authority_granted": False,
        }

    def sync_status(self) -> dict[str, Any]:
        return {
            "schema": "superphivessel.dlam.p2.status.v0.1",
            "node_id": self.node_id,
            "active_peers": int(self.conn.execute("SELECT COUNT(*) FROM p2_peer_links WHERE status='ACTIVE'").fetchone()[0]),
            "revoked_peers": int(self.conn.execute("SELECT COUNT(*) FROM p2_peer_links WHERE status='REVOKED'").fetchone()[0]),
            "queued_outbox": int(self.conn.execute("SELECT COUNT(*) FROM p2_outbox WHERE status='QUEUED'").fetchone()[0]),
            "acked_outbox": int(self.conn.execute("SELECT COUNT(*) FROM p2_outbox WHERE status='ACKED'").fetchone()[0]),
            "inbox_receipts": int(self.conn.execute("SELECT COUNT(*) FROM p2_inbox_receipts").fetchone()[0]),
            "remote_objects": int(self.conn.execute("SELECT COUNT(*) FROM p2_remote_objects WHERE status='IMPORTED'").fetchone()[0]),
            "authority_granted": False,
        }
