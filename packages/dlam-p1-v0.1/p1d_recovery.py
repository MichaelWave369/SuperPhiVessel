from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from dlam_store import DlamStore, ValidationError, canonical, sha256_text


class RecoveryError(ValidationError):
    pass


def file_sha256(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return row is not None


def _count(conn: sqlite3.Connection, table: str, where: str = "", params: tuple[Any, ...] = ()) -> int:
    if not _table_exists(conn, table):
        return 0
    query = f"SELECT COUNT(*) FROM {table}"
    if where:
        query += " WHERE " + where
    return int(conn.execute(query, params).fetchone()[0])


def integrity_report(conn: sqlite3.Connection) -> dict[str, Any]:
    integrity_rows = [str(r[0]) for r in conn.execute("PRAGMA integrity_check").fetchall()]
    foreign_rows = [tuple(r) for r in conn.execute("PRAGMA foreign_key_check").fetchall()]
    return {
        "integrity_check": integrity_rows,
        "foreign_key_violations": foreign_rows,
        "ok": integrity_rows == ["ok"] and not foreign_rows,
    }


def logical_manifest(conn: sqlite3.Connection) -> dict[str, Any]:
    namespaces: dict[str, dict[str, Any]] = {}
    if _table_exists(conn, "ledger_events"):
        rows = conn.execute(
            """
            SELECT namespace_id,sequence,event_id,event_hash
            FROM ledger_events
            ORDER BY namespace_id,sequence
            """
        ).fetchall()
        for row in rows:
            namespace_id = row[0]
            namespaces[namespace_id] = {
                "sequence": int(row[1]),
                "event_id": row[2],
                "event_hash": row[3],
            }

    body = {
        "schema": "superphivessel.dlam.p1d.logical-manifest.v0.1",
        "ledger_events": _count(conn, "ledger_events"),
        "memory_records": _count(conn, "memory_records"),
        "active_memory_records": _count(conn, "memory_records", "tombstoned=0 AND blocked=0"),
        "tombstones": _count(conn, "tombstones"),
        "relations": _count(conn, "relations"),
        "derivation_edges": _count(conn, "derivation_edges"),
        "p1c_models": _count(conn, "p1c_model_artifacts"),
        "p1c_route_receipts": _count(conn, "p1c_route_receipts"),
        "p1c_task_checkpoints": _count(conn, "p1c_task_checkpoints"),
        "p1c_route_outcomes": _count(conn, "p1c_route_outcomes"),
        "namespaces": namespaces,
    }
    digest = sha256_text("PV-DLAM-P1D-MANIFEST|" + canonical(body))
    return {**body, "manifest_hash": digest}


class P1DRecoveryManager:
    """P1-D durability, backup/restore, and active-projection rebuild tools.

    These are local maintenance operations. They do not mint model, memory, or
    action authority.
    """

    SCHEMA = "superphivessel.dlam.p1d.v0.1"

    def __init__(self, store: DlamStore) -> None:
        self.store = store
        self.conn = store.conn

    def verify(self) -> dict[str, Any]:
        report = integrity_report(self.conn)
        report["logical_manifest"] = logical_manifest(self.conn)
        report["authority_granted"] = False
        return report

    def backup(self, destination: str | Path) -> dict[str, Any]:
        destination = Path(destination)
        source = Path(self.store.db_path)
        if destination.resolve() == source.resolve():
            raise RecoveryError("backup destination must differ from live database")
        if destination.exists():
            raise RecoveryError("backup destination already exists")
        destination.parent.mkdir(parents=True, exist_ok=True)

        source_manifest = logical_manifest(self.conn)
        dst = sqlite3.connect(str(destination))
        try:
            self.conn.backup(dst)
            dst.commit()
            dst.row_factory = sqlite3.Row
            report = integrity_report(dst)
            if not report["ok"]:
                raise RecoveryError("backup integrity verification failed")
            backup_manifest = logical_manifest(dst)
        finally:
            dst.close()

        if backup_manifest["manifest_hash"] != source_manifest["manifest_hash"]:
            raise RecoveryError("backup logical manifest mismatch")

        body = {
            "schema": "superphivessel.dlam.p1d.backup-receipt.v0.1",
            "backup_sha256": file_sha256(destination),
            "source_manifest_hash": source_manifest["manifest_hash"],
            "backup_manifest_hash": backup_manifest["manifest_hash"],
            "ledger_frontiers": source_manifest["namespaces"],
            "method": "SQLITE_BACKUP_API",
            "wal_safe": True,
            "authority_granted": False,
        }
        receipt_hash = sha256_text("PV-DLAM-P1D-BACKUP|" + canonical(body))
        return {
            **body,
            "receipt_id": "p1db_" + receipt_hash[:32],
            "receipt_hash": receipt_hash,
        }

    @staticmethod
    def _verify_file(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
        if not path.exists() or not path.is_file():
            raise RecoveryError("database file does not exist")
        try:
            conn = sqlite3.connect(str(path))
            conn.row_factory = sqlite3.Row
            report = integrity_report(conn)
            if not report["ok"]:
                raise RecoveryError("database integrity verification failed")
            manifest = logical_manifest(conn)
            conn.close()
            return report, manifest
        except (sqlite3.DatabaseError, sqlite3.OperationalError) as exc:
            raise RecoveryError("database file is unreadable or corrupt") from exc

    @classmethod
    def restore(
        cls,
        backup_path: str | Path,
        destination: str | Path,
        *,
        overwrite: bool = False,
    ) -> dict[str, Any]:
        backup_path = Path(backup_path)
        destination = Path(destination)
        _, source_manifest = cls._verify_file(backup_path)

        if destination.exists() and not overwrite:
            raise RecoveryError("restore destination already exists")
        if destination.exists():
            destination.unlink()
        for suffix in ("-wal", "-shm"):
            sidecar = Path(str(destination) + suffix)
            if sidecar.exists():
                sidecar.unlink()
        destination.parent.mkdir(parents=True, exist_ok=True)

        try:
            src = sqlite3.connect(str(backup_path))
            dst = sqlite3.connect(str(destination))
            try:
                src.backup(dst)
                dst.commit()
            finally:
                dst.close()
                src.close()
        except (sqlite3.DatabaseError, sqlite3.OperationalError) as exc:
            raise RecoveryError("restore failed") from exc

        report, restored_manifest = cls._verify_file(destination)
        if restored_manifest["manifest_hash"] != source_manifest["manifest_hash"]:
            raise RecoveryError("restored logical manifest mismatch")

        body = {
            "schema": "superphivessel.dlam.p1d.restore-receipt.v0.1",
            "backup_sha256": file_sha256(backup_path),
            "restored_sha256": file_sha256(destination),
            "source_manifest_hash": source_manifest["manifest_hash"],
            "restored_manifest_hash": restored_manifest["manifest_hash"],
            "integrity_check": report["integrity_check"],
            "foreign_key_violations": len(report["foreign_key_violations"]),
            "method": "SQLITE_BACKUP_API",
            "authority_granted": False,
        }
        receipt_hash = sha256_text("PV-DLAM-P1D-RESTORE|" + canonical(body))
        return {
            **body,
            "receipt_id": "p1dr_" + receipt_hash[:32],
            "receipt_hash": receipt_hash,
        }

    def projection_status(self) -> dict[str, Any]:
        active = {
            r[0]
            for r in self.conn.execute(
                "SELECT memory_id FROM memory_records WHERE tombstoned=0 AND blocked=0"
            ).fetchall()
        }
        indexed = {
            r[0]
            for r in self.conn.execute(
                "SELECT memory_id FROM memory_fts"
            ).fetchall()
        }
        tombstoned = {
            r[0]
            for r in self.conn.execute(
                "SELECT memory_id FROM tombstones"
            ).fetchall()
        }
        wrong_flags = sorted(
            mid
            for mid in tombstoned
            if (
                (row := self.conn.execute(
                    "SELECT tombstoned,blocked FROM memory_records WHERE memory_id=?",
                    (mid,),
                ).fetchone())
                and (int(row[0]) != 1 or int(row[1]) != 1)
            )
        )
        return {
            "active_memory_ids": sorted(active),
            "indexed_memory_ids": sorted(indexed),
            "missing_from_index": sorted(active - indexed),
            "stale_in_index": sorted(indexed - active),
            "tombstone_flag_mismatches": wrong_flags,
            "ok": active == indexed and not wrong_flags,
        }

    def _descendant_closure(self, root_memory_id: str) -> set[str]:
        seen: set[str] = set()
        stack = [root_memory_id]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            rows = self.conn.execute(
                "SELECT child_memory_id FROM derivation_edges WHERE parent_memory_id=?",
                (current,),
            ).fetchall()
            stack.extend(str(r[0]) for r in rows)
        return seen

    def rebuild_active_projection(self) -> dict[str, Any]:
        tombstone_roots = [
            str(r[0])
            for r in self.conn.execute(
                "SELECT memory_id FROM tombstones ORDER BY memory_id"
            ).fetchall()
        ]
        try:
            self.conn.execute("BEGIN IMMEDIATE")
            self.conn.execute(
                "UPDATE memory_records SET tombstoned=0,blocked=0,blocked_reason=NULL"
            )
            affected: set[str] = set()
            for root in tombstone_roots:
                closure = self._descendant_closure(root)
                affected.update(closure)
                self.conn.execute(
                    """
                    UPDATE memory_records
                    SET tombstoned=1,blocked=1,blocked_reason='TOMBSTONED'
                    WHERE memory_id=?
                    """,
                    (root,),
                )
                for child in sorted(closure - {root}):
                    self.conn.execute(
                        """
                        UPDATE memory_records
                        SET blocked=1,blocked_reason=?
                        WHERE memory_id=?
                        """,
                        (f"ANCESTOR_TOMBSTONED:{root}", child),
                    )

            self.conn.execute("DELETE FROM memory_fts")
            rows = self.conn.execute(
                """
                SELECT memory_id,namespace_id,content
                FROM memory_records
                WHERE tombstoned=0 AND blocked=0
                ORDER BY namespace_id,admitted_sequence,memory_id
                """
            ).fetchall()
            for row in rows:
                self.conn.execute(
                    "INSERT INTO memory_fts(memory_id,namespace_id,content) VALUES(?,?,?)",
                    (row[0], row[1], row[2]),
                )
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

        status = self.projection_status()
        if not status["ok"]:
            raise RecoveryError("active projection rebuild did not converge")

        body = {
            "schema": "superphivessel.dlam.p1d.rebuild-receipt.v0.1",
            "tombstone_roots": tombstone_roots,
            "suppressed_memory_ids": sorted(affected),
            "active_memory_count": len(status["active_memory_ids"]),
            "indexed_memory_count": len(status["indexed_memory_ids"]),
            "manifest_hash": logical_manifest(self.conn)["manifest_hash"],
            "authority_granted": False,
        }
        receipt_hash = sha256_text("PV-DLAM-P1D-REBUILD|" + canonical(body))
        return {
            **body,
            "receipt_id": "p1dx_" + receipt_hash[:32],
            "receipt_hash": receipt_hash,
        }
