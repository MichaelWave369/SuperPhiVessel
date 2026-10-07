from __future__ import annotations

import os
import sys
from pathlib import Path

from dlam_store import DlamStore, canonical, sha256_text


def capsule(mid: str, content: str) -> dict:
    return {
        "memory_id": mid,
        "namespace_id": "genius.ga108.032",
        "agent_id": "vessie",
        "genius_id": "ga108:032",
        "kind": "fact",
        "content": content,
        "origin": "OBSERVED",
        "source_status": "CAPTURED",
        "sensitivity": "LOCAL",
        "allowed_targets": ["local_model"],
        "allowed_purposes": ["analysis"],
        "retention_rule": "retain_until_tombstoned",
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: p1d_crash_worker.py MODE DB")
    mode = sys.argv[1]
    db = Path(sys.argv[2])
    store = DlamStore(db)

    if mode == "committed-no-receipt":
        store.admit(capsule("crash-committed", "committed before abrupt process loss"))
        # Simulates process loss after SQLite commit but before any higher layer
        # can rely on receiving/persisting the returned receipt.
        os._exit(91)

    if mode == "uncommitted":
        memory_id = "crash-uncommitted"
        content = "this transaction must vanish after process loss"
        ns = "genius.ga108.032"
        seq = store._next_sequence(ns)
        created_at = "2026-10-07T19:30:00Z"
        payload = {
            "memory_id": memory_id,
            "agent_id": "vessie",
            "genius_id": "ga108:032",
            "kind": "fact",
            "content_sha256": sha256_text(content),
            "origin": "OBSERVED",
            "source_status": "CAPTURED",
            "sensitivity": "LOCAL",
            "allowed_targets": ["local_model"],
            "allowed_purposes": ["analysis"],
            "retention_rule": "retain_until_tombstoned",
            "evidence_refs": [],
            "derivation_parents": [],
            "conflict_refs": [],
            "supersedes_refs": [],
        }
        event_id, event_hash, payload_json = store._event_envelope(
            namespace_id=ns,
            sequence=seq,
            operation="ADMIT",
            subject_memory_id=memory_id,
            payload=payload,
            created_at=created_at,
        )
        store.conn.execute("BEGIN IMMEDIATE")
        store.conn.execute(
            """
            INSERT INTO ledger_events(
              event_id,namespace_id,sequence,operation,subject_memory_id,
              payload_json,event_hash,created_at
            ) VALUES(?,?,?,?,?,?,?,?)
            """,
            (event_id, ns, seq, "ADMIT", memory_id, payload_json, event_hash, created_at),
        )
        store.conn.execute(
            """
            INSERT INTO memory_records(
              memory_id,namespace_id,agent_id,genius_id,kind,content,content_sha256,
              origin,source_status,sensitivity,retention_rule,admitted_event_id,admitted_sequence
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                memory_id, ns, "vessie", "ga108:032", "fact", content,
                sha256_text(content), "OBSERVED", "CAPTURED", "LOCAL",
                "retain_until_tombstoned", event_id, seq,
            ),
        )
        store.conn.execute(
            "INSERT INTO memory_targets(memory_id,target) VALUES(?,?)",
            (memory_id, "local_model"),
        )
        store.conn.execute(
            "INSERT INTO memory_purposes(memory_id,purpose) VALUES(?,?)",
            (memory_id, "analysis"),
        )
        store.conn.execute(
            "INSERT INTO memory_fts(memory_id,namespace_id,content) VALUES(?,?,?)",
            (memory_id, ns, content),
        )
        # Deliberately bypass rollback/close handlers.
        os._exit(92)

    raise SystemExit("unknown mode")


if __name__ == "__main__":
    main()
