"""R3-A: offline, read-only projection of P1-C and P3-A routing evidence.

No BrainC connector, browser endpoint, task execution, routing changes, or memory reads.
Hash equality proves self-consistency of local data, NOT external authenticity.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE / "packages" / "dlam-p1-v0.1"))
from dlam_store import canonical, sha256_text  # noqa: E402

DECISION_RE = re.compile(r"^route_[0-9a-f]{32}$")
OBSERVATION_RE = re.compile(r"^p3obs_[0-9a-f]{32}$")
PROFILE_RE = re.compile(r"^ga108:[0-9]{3}$")
MODEL_RE = re.compile(r"^model:[0-9a-f]{32}$")
TASK_CLASS_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
HEX_RE = re.compile(r"^[0-9a-f]{64}$")
TRACE_SCHEMA = "superphivessel.gateway.r3a.routing-trace.v0.1"
MAX_JSON_LENGTH = 131072


class TraceProjectionError(Exception):
    """Local evidence was missing, malformed, or internally inconsistent."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise TraceProjectionError(message)


def checked_json(value: Any) -> dict[str, Any]:
    require(isinstance(value, str) and len(value.encode("utf-8")) <= MAX_JSON_LENGTH,
            "INVALID_SOURCE_OBJECT")
    try:
        item = json.loads(value)
    except (ValueError, TypeError):
        raise TraceProjectionError("INVALID_SOURCE_JSON") from None
    require(isinstance(item, dict), "INVALID_SOURCE_OBJECT")
    return item


def valid_digest(data: dict[str, Any], *, kind: str) -> str:
    spec = {
        "route": ("PV-DLAM-ROUTE|", "receipt_hash", "decision_id", "route_",
                  "superphivessel.dlam.route-decision.p1c.v0.1"),
        "observation": ("PV-DLAM-P3A-OBS|", "observation_hash", "observation_id",
                        "p3obs_", "superphivessel.dlam.p3a.v0.1"),
    }[kind]
    prefix, hash_field, id_field, id_prefix, schema = spec
    require(data.get("schema") == schema, "SCHEMA_MISMATCH")
    digest = data.get(hash_field)
    require(isinstance(digest, str) and HEX_RE.fullmatch(digest) is not None,
            "HASH_FORMAT_INVALID")
    require(data.get(id_field) == id_prefix + digest[:32], "ID_HASH_MISMATCH")
    body = {k: v for k, v in data.items() if k not in (hash_field, id_field)}
    require(digest == sha256_text(prefix + canonical(body)), "HASH_MISMATCH")
    require(data.get("authority_granted") is False, "AUTHORITY_CLAIM_REJECTED")
    return digest


def _safe_bool(v: Any) -> bool:
    require(type(v) is bool, "INVALID_OBSERVATION_BOOL")
    return v


def _safe_number(v: Any, *, maximum: float = 1.0) -> float:
    require(type(v) in (int, float) and 0 <= float(v) <= maximum,
            "INVALID_OBSERVATION_NUMBER")
    return float(v)


def _safe_int(v: Any, *, limit: int = 100_000_000) -> int:
    require(type(v) is int and 0 <= v <= limit, "INVALID_OBSERVATION_INTEGER")
    return v


def project_receipts(
    route_row: sqlite3.Row,
    observation_row: sqlite3.Row | None,
) -> dict[str, Any]:
    route = checked_json(route_row["receipt_json"])
    route_hash = valid_digest(route, kind="route")
    for name in ("decision_id", "task_id", "profile_ref", "model_ref", "receipt_hash"):
        require(route_row[name] == route.get(name), "ROUTE_ROW_MISMATCH")
    require(DECISION_RE.fullmatch(route["decision_id"]) is not None,
            "DECISION_REF_INVALID")
    require(PROFILE_RE.fullmatch(route["profile_ref"]) is not None,
            "PROFILE_REF_INVALID")
    require(MODEL_RE.fullmatch(route["model_ref"]) is not None,
            "MODEL_REF_INVALID")
    require(route.get("routing_mode") == "STATIC", "ROUTE_MODE_INVALID")
    assert route_hash == route_row["receipt_hash"]

    # Nothing from the route's eligible/excluded candidates, policy frontier,
    # context manifest, task text, memory IDs or secret-bearing inputs is exported.
    projection = {
        "schema": TRACE_SCHEMA,
        "source": "EXTRACTED_P1C_P3A_SQLITE",
        "route_decision_id": route["decision_id"],
        "profile_ref": route["profile_ref"],
        "model_ref": route["model_ref"],
        "routing_mode": "STATIC",
        "route_receipt_hash": route_hash,
        "outcome": {"status": "NO_P3_OBSERVATION"},
        "self_hash_consistent": True,
        "external_signature_verified": False,
        "source_authenticity_attested": False,
        "live_brainc_connected": False,
        "browser_gateway_connected": False,
        "activation_allowed": False,
        "may_change_live_route": False,
        "may_change_live_thresholds": False,
        "can_execute": False,
        "authority_granted": False,
    }

    if observation_row is not None:
        obs = checked_json(observation_row["observation_json"])
        observation_hash = valid_digest(obs, kind="observation")
        for name in ("observation_id", "route_decision_id", "task_id",
                     "profile_ref", "model_ref", "observation_hash"):
            require(observation_row[name] == obs.get(name), "OBSERVATION_ROW_MISMATCH")
        require(obs["route_decision_id"] == route["decision_id"],
                "CROSS_ROUTE_LINK_MISMATCH")
        for name in ("task_id", "profile_ref", "model_ref"):
            require(obs[name] == route[name], "CROSS_ROUTE_IDENTITY_MISMATCH")
        require(obs.get("route_receipt_hash") == route_hash,
                "CROSS_ROUTE_HASH_MISMATCH")
        require(OBSERVATION_RE.fullmatch(obs["observation_id"]) is not None,
                "OBSERVATION_REF_INVALID")
        require(TASK_CLASS_RE.fullmatch(str(obs.get("task_class", ""))) is not None,
                "TASK_CLASS_INVALID")
        require(obs.get("learning_mode") == "SHADOW_OBSERVATION_ONLY",
                "LEARNING_MODE_MISMATCH")
        require(obs.get("may_change_live_route") is False
                and obs.get("may_change_live_thresholds") is False,
                "LIVE_POLICY_CLAIM_REJECTED")
        projection["outcome"] = {
            "status": "OBSERVED_P3_SHADOW",
            "observation_id": obs["observation_id"],
            "observation_hash": observation_hash,
            "task_class": obs["task_class"],
            "success": _safe_bool(obs.get("success")),
            "quality_score": _safe_number(obs.get("quality_score")),
            "brier_score": _safe_number(obs.get("brier_score")),
            "evidence_satisfied": _safe_bool(obs.get("evidence_satisfied")),
            "governance_violation": _safe_bool(obs.get("governance_violation")),
            "critical_miss": _safe_bool(obs.get("critical_miss")),
            "user_correction": _safe_bool(obs.get("user_correction")),
            "latency_ms": _safe_int(obs.get("latency_ms")),
            "context_tokens": _safe_int(obs.get("context_tokens")),
            "estimated_cost_micros": _safe_int(obs.get("estimated_cost_micros")),
            "sfr_linked": obs.get("sfr") is not None,
        }

    # Hash the redacted, ordered projection. This is a checksum, not a signature.
    projection_hash = sha256_text("PV-VESSIE-R3A-VIEW|" + canonical(projection))
    projection["projection_hash"] = projection_hash
    return projection


def read_trace(database: str | Path, decision_id: str) -> dict[str, Any]:
    require(isinstance(decision_id, str) and DECISION_RE.fullmatch(decision_id)
            is not None, "DECISION_REF_INVALID")
    path = Path(database).expanduser().resolve()
    require(path.is_file(), "SOURCE_DB_MISSING")
    try:
        con = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=2)
        con.row_factory = sqlite3.Row
        try:
            con.execute("PRAGMA query_only=ON")
            route = con.execute(
                "SELECT decision_id,task_id,profile_ref,model_ref,receipt_hash,receipt_json "
                "FROM p1c_route_receipts WHERE decision_id=?",
                (decision_id,),
            ).fetchone()
            require(route is not None, "ROUTE_NOT_FOUND")
            has_p3 = con.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='p3_route_observations'"
            ).fetchone()
            obs = None
            if has_p3:
                obs = con.execute(
                    "SELECT observation_id,route_decision_id,task_id,profile_ref,"
                    "model_ref,observation_hash,observation_json "
                    "FROM p3_route_observations WHERE route_decision_id=?",
                    (decision_id,),
                ).fetchone()
            return project_receipts(route, obs)
        finally:
            con.close()
    except sqlite3.DatabaseError:
        raise TraceProjectionError("READ_ONLY_DB_INVALID") from None


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline, read-only R3-A routing receipt projection")
    parser.add_argument("--db", required=True, help="Existing PV-DLAM P1-C SQLite file")
    parser.add_argument("--decision", required=True, help="Exact route_<32hex> ID")
    args = parser.parse_args()
    try:
        print(json.dumps(read_trace(args.db, args.decision), sort_keys=True,
                         separators=(",", ":")))
        return 0
    except TraceProjectionError as exc:
        print(json.dumps({
            "schema": TRACE_SCHEMA,
            "status": "REFUSED",
            "reason": str(exc),
            "authority_granted": False,
        }), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
