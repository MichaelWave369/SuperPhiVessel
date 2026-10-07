from __future__ import annotations

import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

from context_composer import ContextComposer
from dlam_store import DlamStore
from p1c_runtime import P1CRuntime
from p1d_recovery import P1DRecoveryManager, RecoveryError, logical_manifest

HERE = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[2]
ROSTER = ROOT / "protocols" / "dlam-v0.1" / "genius-roster.json"
WORKER = HERE / "p1d_crash_worker.py"

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
    def __init__(self):
        self.i = 0

    def __call__(self):
        self.i += 1
        return f"2026-10-07T20:00:{self.i:02d}Z"


def tok(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def capsule(mid, content, **kw):
    return {
        "memory_id": mid,
        "namespace_id": kw.pop("namespace_id", "genius.ga108.032"),
        "agent_id": kw.pop("agent_id", "vessie"),
        "genius_id": kw.pop("genius_id", "ga108:032"),
        "kind": kw.pop("kind", "fact"),
        "content": content,
        "origin": kw.pop("origin", "OBSERVED"),
        "source_status": kw.pop("source_status", "CAPTURED"),
        "sensitivity": kw.pop("sensitivity", "LOCAL"),
        "allowed_targets": kw.pop("allowed_targets", ["local_model"]),
        "allowed_purposes": kw.pop("allowed_purposes", ["analysis"]),
        "retention_rule": kw.pop("retention_rule", "retain_until_tombstoned"),
        **kw,
    }


def model():
    return {
        "name": "p1d-local",
        "provider": "fixture",
        "runtime": "fixture",
        "runtime_version": "1",
        "weights_digest": "sha256:p1d-local",
        "quantization": "Q4",
        "adapter_digest": None,
        "prompt_template_digest": "sha256:p1d-template",
        "tokenizer_id": "fixture-p1d-tokenizer",
        "context_window": 32768,
        "capabilities": ["text", "reasoning", "tools"],
        "locality": "LOCAL",
        "priority": 1,
        "max_vram_mb": 4096,
        "status": "QUALIFIED",
    }


def prepare(rt, model_ref):
    return rt.prepare_task(
        task_id="p1d-task",
        query="active continuity anchor",
        profile_ref="ga108:032",
        agent_id="vessie",
        recipe_ref="recipe:p1d:v1",
        purpose="analysis",
        target_surface="local_model",
        policy_epoch=12,
        authority_decision_ref="auth:p1d:12",
        authority_status="CURRENT",
        memory_budget_tokens=10000,
        required_capabilities=["reasoning", "text"],
        preferred_capabilities=["tools"],
        local_only=True,
        minimum_context_tokens=4096,
        max_vram_mb=8192,
        allowed_model_refs=[model_ref],
        required_memory_ids=["active-anchor"],
    )


def run_worker(mode: str, db: Path) -> int:
    env = dict(os.environ)
    proc = subprocess.run(
        [sys.executable, str(WORKER), mode, str(db)],
        cwd=str(HERE),
        env=env,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return proc.returncode


def main():
    # Crash boundary: committed write survives even if process exits before the
    # higher layer can rely on receiving its receipt.
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "committed.db"
        rc = run_worker("committed-no-receipt", db)
        store = DlamStore(db, clock=FixedClock())
        case("D01 committed-before-crash-survives", lambda: (
            require(rc == 91, f"worker exit {rc}"),
            require(store.get_memory("crash-committed") is not None, "committed memory lost"),
        ))
        retry = store.admit(capsule("crash-committed", "committed before abrupt process loss"))
        case("D02 retry-after-lost-receipt-is-idempotent", lambda: (
            require(retry["idempotent"] is True, "retry created duplicate"),
            require(len(store.ledger("genius.ga108.032")) == 1, "duplicate ledger event"),
        ))
        store.close()

    # Crash inside an open transaction must leave no partial ledger/projection.
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "uncommitted.db"
        rc = run_worker("uncommitted", db)
        store = DlamStore(db, clock=FixedClock())
        case("D03 uncommitted-crash-rolls-back", lambda: (
            require(rc == 92, f"worker exit {rc}"),
            require(store.get_memory("crash-uncommitted") is None, "partial memory survived"),
            require(len(store.ledger("genius.ga108.032")) == 0, "partial ledger survived"),
        ))
        first = store.admit(capsule("after-crash", "first valid event after crash"))
        case("D04 rolled-back-sequence-not-consumed", lambda:
            require(first["sequence"] == 1, "rolled-back event consumed sequence"))
        store.close()

    # Deterministic SQLITE_FULL negative control in a throwaway DB.
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "full.db"
        store = DlamStore(db, clock=FixedClock())
        store.admit(capsule("full-seed", "seed"))
        current_pages = int(store.conn.execute("PRAGMA page_count").fetchone()[0])
        store.conn.execute(f"PRAGMA max_page_count={current_pages}")
        full_code = None
        try:
            store.admit(capsule("must-not-partial", "X" * (4 * 1024 * 1024)))
        except sqlite3.OperationalError as exc:
            full_code = getattr(exc, "sqlite_errorcode", None)
        case("D05 sqlite-full-fails-closed", lambda: (
            require(full_code == sqlite3.SQLITE_FULL, f"expected SQLITE_FULL, got {full_code}"),
            require(store.get_memory("must-not-partial") is None, "partial memory survived SQLITE_FULL"),
            require(
                not any(e["subject_memory_id"] == "must-not-partial" for e in store.ledger("genius.ga108.032")),
                "partial ledger survived SQLITE_FULL",
            ),
        ))
        store.conn.execute("PRAGMA max_page_count=2147483646")
        recovered = store.admit(capsule("after-full", "store still writable after full condition"))
        case("D06 store-recovers-after-cap-lift", lambda:
            require(recovered["disposition"] == "ADMITTED", "store did not recover"))
        store.close()

    # Full one-node state for backup/restore + projection rebuild qualification.
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        live = td / "live.db"
        backup = td / "backup.db"
        restored = td / "restored.db"

        store = DlamStore(live, clock=FixedClock())
        store.admit(capsule("active-anchor", "active continuity anchor"))
        store.admit(capsule("delete-source", "obsolete amber source"))
        store.admit(capsule(
            "delete-child",
            "obsolete amber derived summary",
            origin="INFERRED",
            derivation_parents=["delete-source"],
        ))
        store.forget("delete-source", reason="operator deletion", actor="operator")
        # Latest committed memory intentionally remains in WAL-capable live DB
        # immediately before backup.
        store.admit(capsule("wal-latest", "latest committed wal-visible record"))

        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-p1d-tokenizer", tok)
        registered = rt.register_model(model())
        prepared = prepare(rt, registered["model_ref"])
        checkpoint = rt.checkpoint_task(
            prepared,
            work_state={"step": 7, "artifact_refs": ["mem:active-anchor"]},
            status="PAUSED",
        )
        packet_hash_before = prepared["packet"]["packet_hash"]

        mgr = P1DRecoveryManager(store)
        baseline = mgr.verify()
        case("D07 baseline-integrity-clean", lambda: (
            require(baseline["ok"] is True, "integrity failed"),
            require(baseline["authority_granted"] is False, "verification granted authority"),
        ))

        source_manifest = logical_manifest(store.conn)
        backup_receipt = mgr.backup(backup)
        case("D08 sqlite-backup-receipt-pins-state", lambda: (
            require(backup_receipt["method"] == "SQLITE_BACKUP_API", "wrong backup method"),
            require(backup_receipt["source_manifest_hash"] == source_manifest["manifest_hash"], "source manifest drift"),
            require(backup_receipt["backup_manifest_hash"] == source_manifest["manifest_hash"], "backup manifest drift"),
            require(backup_receipt["authority_granted"] is False, "backup granted authority"),
        ))

        restore_receipt = P1DRecoveryManager.restore(backup, restored)
        case("D09 restore-verifies-exact-logical-manifest", lambda: (
            require(restore_receipt["source_manifest_hash"] == restore_receipt["restored_manifest_hash"], "restore manifest mismatch"),
            require(restore_receipt["foreign_key_violations"] == 0, "foreign-key violation"),
            require(restore_receipt["authority_granted"] is False, "restore granted authority"),
        ))

        restored_store = DlamStore(restored, clock=FixedClock())
        restored_mgr = P1DRecoveryManager(restored_store)
        case("D10 backup-captures-latest-committed-wal-state", lambda:
            require(restored_store.get_memory("wal-latest") is not None, "latest committed state absent"))

        case("D11 restore-preserves-tombstone-and-derived-block", lambda: (
            require(restored_store.get_memory("delete-source")["tombstoned"] == 1, "source tombstone lost"),
            require(restored_store.get_memory("delete-child")["blocked"] == 1, "derived block lost"),
        ))

        rt2 = P1CRuntime(restored_store, genius_roster_path=ROSTER)
        rt2.register_tokenizer("fixture-p1d-tokenizer", tok)
        recovered_checkpoint = rt2.get_checkpoint(checkpoint["checkpoint_id"])
        case("D12 restore-preserves-model-route-checkpoint-state", lambda: (
            require(recovered_checkpoint["profile_ref"] == "ga108:032", "Genius checkpoint lost"),
            require(recovered_checkpoint["work_state"]["step"] == 7, "work state lost"),
            require(rt2.get_model(registered["model_ref"])["model_ref"] == registered["model_ref"], "model registry lost"),
        ))

        prepared_after = prepare(rt2, registered["model_ref"])
        case("D13 context-recomposes-identically-after-restore", lambda:
            require(prepared_after["packet"]["packet_hash"] == packet_hash_before, "context packet changed after restore"))

        # Damage only the active projection, not the exact records/relations.
        restored_store.conn.execute(
            "UPDATE memory_records SET tombstoned=0,blocked=0,blocked_reason=NULL WHERE memory_id IN ('delete-source','delete-child')"
        )
        restored_store.conn.execute("DELETE FROM memory_fts WHERE memory_id='active-anchor'")
        restored_store.conn.execute(
            "INSERT OR IGNORE INTO memory_fts(memory_id,namespace_id,content) VALUES(?,?,?)",
            ("delete-source", "genius.ga108.032", "obsolete amber source"),
        )
        restored_store.conn.execute(
            "INSERT OR IGNORE INTO memory_fts(memory_id,namespace_id,content) VALUES(?,?,?)",
            ("delete-child", "genius.ga108.032", "obsolete amber derived summary"),
        )
        restored_store.conn.commit()
        damaged = restored_mgr.projection_status()
        case("D14 projection-damage-is-detectable", lambda:
            require(damaged["ok"] is False, "projection damage went unnoticed"))

        rebuild = restored_mgr.rebuild_active_projection()
        case("D15 rebuild-restores-active-index", lambda:
            require(
                [x["memory_id"] for x in restored_store.recall(
                    "active continuity",
                    namespace_id="genius.ga108.032",
                    purpose="analysis",
                    target="local_model",
                )] == ["active-anchor"],
                "active memory not restored",
            ))

        case("D16 rebuild-does-not-resurrect-deleted-lineage", lambda: (
            require(
                len(restored_store.recall(
                    "obsolete amber",
                    namespace_id="genius.ga108.032",
                    purpose="analysis",
                    target="local_model",
                )) == 0,
                "deleted lineage resurrected",
            ),
            require(restored_store.get_memory("delete-source")["tombstoned"] == 1, "source tombstone flag not rebuilt"),
            require(restored_store.get_memory("delete-child")["blocked"] == 1, "derived block not rebuilt"),
        ))

        case("D17 rebuild-receipt-is-non-authoritative", lambda: (
            require(rebuild["authority_granted"] is False, "rebuild granted authority"),
            require("delete-source" in rebuild["suppressed_memory_ids"], "source suppression absent"),
            require("delete-child" in rebuild["suppressed_memory_ids"], "child suppression absent"),
        ))

        after_rebuild = restored_mgr.verify()
        case("D18 integrity-clean-after-rebuild", lambda:
            require(after_rebuild["ok"] is True, "integrity failed after rebuild"))

        # Truncate a copy to prove corrupt backups fail before restore.
        corrupt = td / "corrupt.db"
        shutil.copyfile(backup, corrupt)
        with open(corrupt, "r+b") as f:
            size = f.seek(0, os.SEEK_END)
            f.truncate(max(64, size // 2))

        def reject_corrupt():
            try:
                P1DRecoveryManager.restore(corrupt, td / "corrupt-restore.db")
            except RecoveryError:
                return
            raise AssertionError("corrupt backup was accepted")

        case("D19 corrupt-backup-fails-closed", reject_corrupt)

        # A post-backup mutation changes the logical manifest, proving receipts
        # are snapshots rather than magical aliases to the live DB.
        source_hash_before = source_manifest["manifest_hash"]
        store.admit(capsule("post-backup", "mutation after backup snapshot"))
        source_hash_after = logical_manifest(store.conn)["manifest_hash"]
        case("D20 backup-is-point-in-time-not-live-alias", lambda: (
            require(source_hash_after != source_hash_before, "live manifest did not advance"),
            require(logical_manifest(restored_store.conn)["manifest_hash"] == source_hash_before, "restored snapshot mutated"),
        ))

        store.close()
        restored_store.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
