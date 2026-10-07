from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

ORIGINS = {"OBSERVED", "VERIFIED", "INFERRED", "DREAMED", "SIMULATED", "UNKNOWN"}


class DlamError(Exception):
    pass


class ValidationError(DlamError):
    pass


class MemoryConflictError(DlamError):
    pass


class DependencyError(DlamError):
    pass


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def default_clock() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class DlamStore:
    """PV-DLAM P1-A: one-node exact ledger + lexical projection.

    This package performs no model invocation and grants no action authority.
    """

    SCHEMA = "superphivessel.dlam.p1a.v0.1"

    def __init__(self, db_path: str | Path, *, clock: Callable[[], str] | None = None) -> None:
        self.db_path = str(db_path)
        self.clock = clock or default_clock
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.execute("PRAGMA busy_timeout=5000")
        mode = self.conn.execute("PRAGMA journal_mode=WAL").fetchone()[0]
        if str(mode).lower() != "wal":
            raise DependencyError(f"WAL unavailable: {mode}")
        self.conn.execute("PRAGMA synchronous=FULL")
        self._init_schema()

    def close(self) -> None:
        self.conn.close()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS meta(
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ledger_events(
              event_id TEXT PRIMARY KEY,
              namespace_id TEXT NOT NULL,
              sequence INTEGER NOT NULL,
              operation TEXT NOT NULL CHECK(operation IN ('ADMIT','TOMBSTONE')),
              subject_memory_id TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              event_hash TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL,
              UNIQUE(namespace_id, sequence)
            );

            CREATE TABLE IF NOT EXISTS memory_records(
              memory_id TEXT PRIMARY KEY,
              namespace_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              genius_id TEXT,
              kind TEXT NOT NULL,
              content TEXT NOT NULL,
              content_sha256 TEXT NOT NULL,
              origin TEXT NOT NULL,
              source_status TEXT NOT NULL,
              sensitivity TEXT NOT NULL,
              retention_rule TEXT NOT NULL,
              admitted_event_id TEXT NOT NULL UNIQUE REFERENCES ledger_events(event_id),
              admitted_sequence INTEGER NOT NULL,
              tombstoned INTEGER NOT NULL DEFAULT 0 CHECK(tombstoned IN (0,1)),
              blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),
              blocked_reason TEXT
            );

            CREATE TABLE IF NOT EXISTS memory_targets(
              memory_id TEXT NOT NULL REFERENCES memory_records(memory_id) ON DELETE RESTRICT,
              target TEXT NOT NULL,
              PRIMARY KEY(memory_id, target)
            );

            CREATE TABLE IF NOT EXISTS memory_purposes(
              memory_id TEXT NOT NULL REFERENCES memory_records(memory_id) ON DELETE RESTRICT,
              purpose TEXT NOT NULL,
              PRIMARY KEY(memory_id, purpose)
            );

            CREATE TABLE IF NOT EXISTS relations(
              from_memory_id TEXT NOT NULL REFERENCES memory_records(memory_id) ON DELETE RESTRICT,
              relation TEXT NOT NULL,
              to_memory_id TEXT NOT NULL,
              PRIMARY KEY(from_memory_id, relation, to_memory_id)
            );

            CREATE TABLE IF NOT EXISTS derivation_edges(
              parent_memory_id TEXT NOT NULL REFERENCES memory_records(memory_id) ON DELETE RESTRICT,
              child_memory_id TEXT NOT NULL REFERENCES memory_records(memory_id) ON DELETE RESTRICT,
              PRIMARY KEY(parent_memory_id, child_memory_id),
              CHECK(parent_memory_id <> child_memory_id)
            );

            CREATE TABLE IF NOT EXISTS tombstones(
              memory_id TEXT PRIMARY KEY REFERENCES memory_records(memory_id) ON DELETE RESTRICT,
              tombstone_event_id TEXT NOT NULL UNIQUE REFERENCES ledger_events(event_id),
              reason TEXT NOT NULL,
              actor TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_memory_namespace_active
              ON memory_records(namespace_id, tombstoned, blocked, admitted_sequence);
            CREATE INDEX IF NOT EXISTS idx_derivation_parent
              ON derivation_edges(parent_memory_id);
            CREATE INDEX IF NOT EXISTS idx_ledger_namespace_seq
              ON ledger_events(namespace_id, sequence);
            """
        )
        try:
            self.conn.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
                  memory_id UNINDEXED,
                  namespace_id UNINDEXED,
                  content,
                  tokenize='unicode61'
                )
                """
            )
        except sqlite3.OperationalError as exc:
            raise DependencyError("SQLite FTS5 is required for P1-A") from exc

        self.conn.execute(
            "INSERT OR REPLACE INTO meta(key,value) VALUES('schema',?)",
            (self.SCHEMA,),
        )
        self.conn.commit()

    def dependency_report(self) -> dict[str, Any]:
        return {
            "sqlite_version": sqlite3.sqlite_version,
            "journal_mode": str(self.conn.execute("PRAGMA journal_mode").fetchone()[0]).upper(),
            "synchronous": int(self.conn.execute("PRAGMA synchronous").fetchone()[0]),
            "fts5": True,
            "schema": self.conn.execute("SELECT value FROM meta WHERE key='schema'").fetchone()[0],
        }

    @staticmethod
    def _validate_capsule(capsule: dict[str, Any]) -> None:
        required = {
            "memory_id", "namespace_id", "agent_id", "kind", "content", "origin",
            "source_status", "sensitivity", "allowed_targets", "allowed_purposes",
            "retention_rule",
        }
        missing = sorted(required - capsule.keys())
        if missing:
            raise ValidationError("missing required fields: " + ", ".join(missing))
        for field in ("memory_id", "namespace_id", "agent_id", "kind", "content",
                      "source_status", "sensitivity", "retention_rule"):
            if not isinstance(capsule[field], str) or not capsule[field]:
                raise ValidationError(f"{field} must be a non-empty string")
        if capsule["origin"] not in ORIGINS:
            raise ValidationError(f"invalid origin: {capsule['origin']}")
        for field in ("allowed_targets", "allowed_purposes"):
            value = capsule[field]
            if not isinstance(value, list) or not value or not all(isinstance(x, str) and x for x in value):
                raise ValidationError(f"{field} must be a non-empty string list")

    def _next_sequence(self, namespace_id: str) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(MAX(sequence),0)+1 FROM ledger_events WHERE namespace_id=?",
            (namespace_id,),
        ).fetchone()
        return int(row[0])

    def _event_envelope(
        self,
        *,
        namespace_id: str,
        sequence: int,
        operation: str,
        subject_memory_id: str,
        payload: dict[str, Any],
        created_at: str,
    ) -> tuple[str, str, str]:
        body = {
            "schema": self.SCHEMA,
            "namespace_id": namespace_id,
            "sequence": sequence,
            "operation": operation,
            "subject_memory_id": subject_memory_id,
            "payload": payload,
            "created_at": created_at,
        }
        event_hash = sha256_text("PV-DLAM-EVENT|" + canonical(body))
        event_id = "evt_" + event_hash[:32]
        return event_id, event_hash, canonical(payload)

    def _capsule_fingerprint(self, capsule: dict[str, Any]) -> str:
        value = {
            "memory_id": capsule["memory_id"],
            "namespace_id": capsule["namespace_id"],
            "agent_id": capsule["agent_id"],
            "genius_id": capsule.get("genius_id"),
            "kind": capsule["kind"],
            "content": capsule["content"],
            "origin": capsule["origin"],
            "source_status": capsule["source_status"],
            "sensitivity": capsule["sensitivity"],
            "allowed_targets": sorted(set(capsule["allowed_targets"])),
            "allowed_purposes": sorted(set(capsule["allowed_purposes"])),
            "retention_rule": capsule["retention_rule"],
        }
        return sha256_text(canonical(value))

    def _record_fingerprint(self, record: sqlite3.Row) -> str:
        targets = [r[0] for r in self.conn.execute(
            "SELECT target FROM memory_targets WHERE memory_id=? ORDER BY target",
            (record["memory_id"],),
        )]
        purposes = [r[0] for r in self.conn.execute(
            "SELECT purpose FROM memory_purposes WHERE memory_id=? ORDER BY purpose",
            (record["memory_id"],),
        )]
        return sha256_text(canonical({
            "memory_id": record["memory_id"],
            "namespace_id": record["namespace_id"],
            "agent_id": record["agent_id"],
            "genius_id": record["genius_id"],
            "kind": record["kind"],
            "content": record["content"],
            "origin": record["origin"],
            "source_status": record["source_status"],
            "sensitivity": record["sensitivity"],
            "allowed_targets": targets,
            "allowed_purposes": purposes,
            "retention_rule": record["retention_rule"],
        }))

    def admit(self, capsule: dict[str, Any]) -> dict[str, Any]:
        self._validate_capsule(capsule)
        memory_id = capsule["memory_id"]

        existing = self.conn.execute(
            "SELECT * FROM memory_records WHERE memory_id=?",
            (memory_id,),
        ).fetchone()
        if existing is not None:
            if self._capsule_fingerprint(capsule) != self._record_fingerprint(existing):
                raise MemoryConflictError(
                    f"memory_id {memory_id} already exists with different content/metadata"
                )
            event = self.conn.execute(
                "SELECT * FROM ledger_events WHERE event_id=?",
                (existing["admitted_event_id"],),
            ).fetchone()
            return self._admission_receipt(existing, event, idempotent=True)

        derivation_parents = list(dict.fromkeys(capsule.get("derivation_parents", [])))
        for parent in derivation_parents:
            if self.conn.execute(
                "SELECT 1 FROM memory_records WHERE memory_id=?",
                (parent,),
            ).fetchone() is None:
                raise ValidationError(f"unknown derivation parent: {parent}")

        namespace_id = capsule["namespace_id"]
        sequence = self._next_sequence(namespace_id)
        created_at = self.clock()
        payload = {
            "memory_id": memory_id,
            "agent_id": capsule["agent_id"],
            "genius_id": capsule.get("genius_id"),
            "kind": capsule["kind"],
            "content_sha256": sha256_text(capsule["content"]),
            "origin": capsule["origin"],
            "source_status": capsule["source_status"],
            "sensitivity": capsule["sensitivity"],
            "allowed_targets": sorted(set(capsule["allowed_targets"])),
            "allowed_purposes": sorted(set(capsule["allowed_purposes"])),
            "retention_rule": capsule["retention_rule"],
            "evidence_refs": sorted(set(capsule.get("evidence_refs", []))),
            "derivation_parents": sorted(set(derivation_parents)),
            "conflict_refs": sorted(set(capsule.get("conflict_refs", []))),
            "supersedes_refs": sorted(set(capsule.get("supersedes_refs", []))),
        }
        event_id, event_hash, payload_json = self._event_envelope(
            namespace_id=namespace_id,
            sequence=sequence,
            operation="ADMIT",
            subject_memory_id=memory_id,
            payload=payload,
            created_at=created_at,
        )

        try:
            self.conn.execute("BEGIN IMMEDIATE")
            self.conn.execute(
                """
                INSERT INTO ledger_events(
                  event_id,namespace_id,sequence,operation,subject_memory_id,
                  payload_json,event_hash,created_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (event_id, namespace_id, sequence, "ADMIT", memory_id,
                 payload_json, event_hash, created_at),
            )
            self.conn.execute(
                """
                INSERT INTO memory_records(
                  memory_id,namespace_id,agent_id,genius_id,kind,content,content_sha256,
                  origin,source_status,sensitivity,retention_rule,admitted_event_id,admitted_sequence
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    memory_id, namespace_id, capsule["agent_id"], capsule.get("genius_id"),
                    capsule["kind"], capsule["content"], payload["content_sha256"],
                    capsule["origin"], capsule["source_status"], capsule["sensitivity"],
                    capsule["retention_rule"], event_id, sequence,
                ),
            )
            for target in payload["allowed_targets"]:
                self.conn.execute(
                    "INSERT INTO memory_targets(memory_id,target) VALUES(?,?)",
                    (memory_id, target),
                )
            for purpose in payload["allowed_purposes"]:
                self.conn.execute(
                    "INSERT INTO memory_purposes(memory_id,purpose) VALUES(?,?)",
                    (memory_id, purpose),
                )
            for parent in derivation_parents:
                self.conn.execute(
                    "INSERT INTO derivation_edges(parent_memory_id,child_memory_id) VALUES(?,?)",
                    (parent, memory_id),
                )
            for relation_name, refs in (
                ("EVIDENCE", capsule.get("evidence_refs", [])),
                ("CONTRADICTS", capsule.get("conflict_refs", [])),
                ("SUPERSEDES", capsule.get("supersedes_refs", [])),
            ):
                for ref in sorted(set(refs)):
                    self.conn.execute(
                        "INSERT OR IGNORE INTO relations(from_memory_id,relation,to_memory_id) VALUES(?,?,?)",
                        (memory_id, relation_name, ref),
                    )
            self.conn.execute(
                "INSERT INTO memory_fts(memory_id,namespace_id,content) VALUES(?,?,?)",
                (memory_id, namespace_id, capsule["content"]),
            )
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

        record = self.conn.execute(
            "SELECT * FROM memory_records WHERE memory_id=?",
            (memory_id,),
        ).fetchone()
        event = self.conn.execute(
            "SELECT * FROM ledger_events WHERE event_id=?",
            (event_id,),
        ).fetchone()
        return self._admission_receipt(record, event, idempotent=False)

    @staticmethod
    def _admission_receipt(
        record: sqlite3.Row,
        event: sqlite3.Row,
        *,
        idempotent: bool,
    ) -> dict[str, Any]:
        return {
            "schema": DlamStore.SCHEMA,
            "disposition": "ADMITTED",
            "durability": "DURABLE_LOCAL",
            "memory_id": record["memory_id"],
            "namespace_id": record["namespace_id"],
            "sequence": int(event["sequence"]),
            "event_id": event["event_id"],
            "event_hash": event["event_hash"],
            "origin": record["origin"],
            "authority_granted": False,
            "idempotent": idempotent,
        }

    @staticmethod
    def _fts_query(query: str) -> str:
        terms = [t.strip('"') for t in query.replace("'", " ").split() if t.strip('"')]
        if not terms:
            raise ValidationError("query must contain searchable terms")
        safe = [f'"{t.replace(chr(34), "")}"' for t in terms]
        return " AND ".join(safe)

    def recall(
        self,
        query: str,
        *,
        namespace_id: str,
        purpose: str,
        target: str,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        if limit < 1 or limit > 100:
            raise ValidationError("limit must be between 1 and 100")
        rows = self.conn.execute(
            """
            SELECT DISTINCT m.*
            FROM memory_fts f
            JOIN memory_records m ON m.memory_id=f.memory_id
            JOIN memory_targets t ON t.memory_id=m.memory_id AND t.target=?
            JOIN memory_purposes p ON p.memory_id=m.memory_id AND p.purpose=?
            WHERE f.memory_fts MATCH ?
              AND m.namespace_id=?
              AND m.tombstoned=0
              AND m.blocked=0
            ORDER BY m.admitted_sequence DESC
            LIMIT ?
            """,
            (target, purpose, self._fts_query(query), namespace_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def _descendant_closure(self, root_memory_id: str) -> list[str]:
        seen: set[str] = set()
        stack = [root_memory_id]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            rows = self.conn.execute(
                "SELECT child_memory_id FROM derivation_edges WHERE parent_memory_id=? ORDER BY child_memory_id",
                (current,),
            ).fetchall()
            stack.extend(r[0] for r in rows)
        return sorted(seen)

    def forget(self, memory_id: str, *, reason: str, actor: str) -> dict[str, Any]:
        if not reason or not actor:
            raise ValidationError("reason and actor are required")
        record = self.conn.execute(
            "SELECT * FROM memory_records WHERE memory_id=?",
            (memory_id,),
        ).fetchone()
        if record is None:
            raise ValidationError(f"unknown memory_id: {memory_id}")

        existing = self.conn.execute(
            "SELECT * FROM tombstones WHERE memory_id=?",
            (memory_id,),
        ).fetchone()
        if existing is not None:
            event = self.conn.execute(
                "SELECT * FROM ledger_events WHERE event_id=?",
                (existing["tombstone_event_id"],),
            ).fetchone()
            return {
                "schema": self.SCHEMA,
                "disposition": "TOMBSTONED",
                "memory_id": memory_id,
                "event_id": event["event_id"],
                "event_hash": event["event_hash"],
                "affected": self._descendant_closure(memory_id),
                "idempotent": True,
                "authority_granted": False,
            }

        namespace_id = record["namespace_id"]
        sequence = self._next_sequence(namespace_id)
        created_at = self.clock()
        affected = self._descendant_closure(memory_id)
        payload = {
            "memory_id": memory_id,
            "reason": reason,
            "actor": actor,
            "affected": affected,
        }
        event_id, event_hash, payload_json = self._event_envelope(
            namespace_id=namespace_id,
            sequence=sequence,
            operation="TOMBSTONE",
            subject_memory_id=memory_id,
            payload=payload,
            created_at=created_at,
        )

        try:
            self.conn.execute("BEGIN IMMEDIATE")
            self.conn.execute(
                """
                INSERT INTO ledger_events(
                  event_id,namespace_id,sequence,operation,subject_memory_id,
                  payload_json,event_hash,created_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (event_id, namespace_id, sequence, "TOMBSTONE", memory_id,
                 payload_json, event_hash, created_at),
            )
            self.conn.execute(
                """
                INSERT INTO tombstones(memory_id,tombstone_event_id,reason,actor,created_at)
                VALUES(?,?,?,?,?)
                """,
                (memory_id, event_id, reason, actor, created_at),
            )
            self.conn.execute(
                """
                UPDATE memory_records
                SET tombstoned=1, blocked=1, blocked_reason='TOMBSTONED'
                WHERE memory_id=?
                """,
                (memory_id,),
            )
            for child in affected:
                if child != memory_id:
                    self.conn.execute(
                        """
                        UPDATE memory_records
                        SET blocked=1, blocked_reason=?
                        WHERE memory_id=?
                        """,
                        (f"ANCESTOR_TOMBSTONED:{memory_id}", child),
                    )
            for mid in affected:
                self.conn.execute("DELETE FROM memory_fts WHERE memory_id=?", (mid,))
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

        return {
            "schema": self.SCHEMA,
            "disposition": "TOMBSTONED",
            "memory_id": memory_id,
            "event_id": event_id,
            "event_hash": event_hash,
            "affected": affected,
            "idempotent": False,
            "authority_granted": False,
        }

    def get_memory(self, memory_id: str) -> dict[str, Any] | None:
        row = self.conn.execute(
            "SELECT * FROM memory_records WHERE memory_id=?",
            (memory_id,),
        ).fetchone()
        return dict(row) if row else None

    def ledger(self, namespace_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM ledger_events WHERE namespace_id=? ORDER BY sequence",
            (namespace_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def relation_exists(self, from_memory_id: str, relation: str, to_memory_id: str) -> bool:
        return self.conn.execute(
            """
            SELECT 1 FROM relations
            WHERE from_memory_id=? AND relation=? AND to_memory_id=?
            """,
            (from_memory_id, relation, to_memory_id),
        ).fetchone() is not None
