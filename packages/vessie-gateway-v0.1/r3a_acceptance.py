from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from r3a_route_trace import TraceProjectionError, read_trace, sha256_text, canonical

passed = 0
total = 0


def case(name, fn):
    global passed, total
    total += 1
    try:
        fn()
        passed += 1
        print(f"PASS {name}")
    except Exception as e:
        print(f"FAIL {name}: {type(e).__name__}: {e}")


def need(ok, why):
    if not ok:
        raise AssertionError(why)


def must_refuse(fn):
    try:
        fn()
    except TraceProjectionError:
        return
    raise AssertionError("expected fail-closed trace refusal")


def seal_route(**override):
    body = {
        "schema": "superphivessel.dlam.route-decision.p1c.v0.1",
        "task_id": "sensitive-task-user-prompt-hidden",
        "profile_ref": "ga108:032",
        "model_ref": "model:" + "b" * 32,
        "routing_mode": "STATIC",
        "authority_granted": False,
        "context_manifest_ref": "secret-context-manifest-ref",
        "policy_frontier_ref": "secret-authority-frontier-ref",
        "eligible_candidates": [{"model_ref": "model:" + "b" * 32,
                                 "private": "raw-memory-secret"}],
        "request_envelope": {"query": "highly-private-user-question"},
    }
    body.update(override)
    digest = sha256_text("PV-DLAM-ROUTE|" + canonical(body))
    return {**body, "decision_id": "route_" + digest[:32], "receipt_hash": digest}


def seal_observation(route, **override):
    body = {
        "schema": "superphivessel.dlam.p3a.v0.1",
        "route_decision_id": route["decision_id"],
        "route_receipt_hash": route["receipt_hash"],
        "task_id": route["task_id"],
        "task_class": "systems.analysis",
        "profile_ref": route["profile_ref"],
        "model_ref": route["model_ref"],
        "success": True,
        "quality_score": 0.89,
        "brier_score": 0.04,
        "evidence_satisfied": True,
        "governance_violation": False,
        "critical_miss": False,
        "user_correction": False,
        "latency_ms": 150,
        "context_tokens": 412,
        "estimated_cost_micros": 10,
        "sfr": {"private": "raw-sfr-secret"},
        "outcome_source_refs": ["evidence:private-path"],
        "learning_mode": "SHADOW_OBSERVATION_ONLY",
        "may_change_live_route": False,
        "may_change_live_thresholds": False,
        "authority_granted": False,
    }
    body.update(override)
    digest = sha256_text("PV-DLAM-P3A-OBS|" + canonical(body))
    return {**body, "observation_id": "p3obs_" + digest[:32],
            "observation_hash": digest}


def setup(db):
    conn = sqlite3.connect(str(db))
    conn.executescript("""
    CREATE TABLE p1c_route_receipts (
      decision_id TEXT PRIMARY KEY,
      task_id TEXT,
      profile_ref TEXT,
      model_ref TEXT,
      receipt_hash TEXT,
      receipt_json TEXT
    );
    CREATE TABLE p3_route_observations (
      observation_id TEXT PRIMARY KEY,
      route_decision_id TEXT,
      task_id TEXT,
      profile_ref TEXT,
      model_ref TEXT,
      observation_hash TEXT,
      observation_json TEXT
    );
    """)
    conn.commit()
    return conn


def insert_route(conn, route):
    conn.execute("INSERT INTO p1c_route_receipts VALUES (?,?,?,?,?,?)",
                 (route["decision_id"], route["task_id"], route["profile_ref"],
                  route["model_ref"], route["receipt_hash"], canonical(route)))
    conn.commit()


def insert_obs(conn, obs):
    conn.execute("INSERT INTO p3_route_observations VALUES (?,?,?,?,?,?,?)",
                 (obs["observation_id"], obs["route_decision_id"], obs["task_id"],
                  obs["profile_ref"], obs["model_ref"], obs["observation_hash"],
                  canonical(obs)))
    conn.commit()


def main():
    with tempfile.TemporaryDirectory() as temp:
        db = Path(temp) / "local.sqlite"
        conn = setup(db)
        route = seal_route()
        obs = seal_observation(route)
        insert_route(conn, route)
        insert_obs(conn, obs)
        view = read_trace(db, route["decision_id"])

        case("T01 existing-P1C-P3A-trace-projects-locally", lambda:
             need(view["outcome"]["status"] == "OBSERVED_P3_SHADOW", "observation missing"))
        case("T02 exact-model-and-profile-identity-preserved", lambda:
             need(view["model_ref"] == route["model_ref"] and view["profile_ref"] == "ga108:032",
                  "wrong identity"))
        case("T03 self-hash-consistency-is-not-external-authenticity", lambda:
             need(view["self_hash_consistent"] and
                  view["external_signature_verified"] is False and
                  view["source_authenticity_attested"] is False, "misleading integrity claim"))
        case("T04 exported-projection-never-grants-any-authority", lambda:
             need(view["activation_allowed"] is False and
                  view["authority_granted"] is False and
                  view["can_execute"] is False and
                  view["live_brainc_connected"] is False, "authority leaked"))
        case("T05 private-route-and-sfr-fields-are-never-exported", lambda:
             need(all(secret not in json.dumps(view) for secret in (
                  "raw-memory-secret", "highly-private-user-question",
                  "secret-context-manifest-ref", "secret-authority-frontier-ref",
                  "raw-sfr-secret", "sensitive-task-user-prompt-hidden",
                  "evidence:private-path")), "private data leaked"))
        case("T06 immutable-replay-hash-deterministic", lambda:
             need(read_trace(db, route["decision_id"])["projection_hash"] ==
                  view["projection_hash"], "projection hash drift"))
        case("T07 no-mutation-of-SQLite-source", lambda:
             need(conn.execute("SELECT COUNT(*) FROM p1c_route_receipts").fetchone()[0] == 1
                  and conn.execute("SELECT COUNT(*) FROM p3_route_observations").fetchone()[0] == 1,
                  "read-only projection mutated source"))
        case("T08 invalid-route-id-refused-before-DB-read", lambda:
             must_refuse(lambda: read_trace(db, "something-private")))
        case("T09 nonexistent-file-never-created", lambda: (
             must_refuse(lambda: read_trace(Path(temp) / "missing.sqlite", route["decision_id"])),
             need(not (Path(temp) / "missing.sqlite").exists(), "SQLite created an absent DB"),
        ))

        # An actual P1-C schema can legitimately exist before P3-A is installed.
        no_p3 = Path(temp) / "route-only.sqlite"
        co = sqlite3.connect(no_p3)
        co.execute("""CREATE TABLE p1c_route_receipts (
          decision_id TEXT PRIMARY KEY,task_id TEXT,profile_ref TEXT,
          model_ref TEXT,receipt_hash TEXT,receipt_json TEXT)""")
        insert_route(co, route)
        co.close()
        case("T10 missing-P3-schema-yields-no-evidence-not-fabrication", lambda:
             need(read_trace(no_p3,route["decision_id"])["outcome"]["status"] ==
                  "NO_P3_OBSERVATION", "unobserved outcome fabricated"))

        conn.execute("UPDATE p1c_route_receipts SET receipt_json=? WHERE decision_id=?",
                     (canonical({**route, "routing_mode": "ADVISORY"}), route["decision_id"]))
        conn.commit()
        case("T11 tampered-route-receipt-refused", lambda:
             must_refuse(lambda: read_trace(db, route["decision_id"])))
        conn.execute("UPDATE p1c_route_receipts SET receipt_json=? WHERE decision_id=?",
                     (canonical(route), route["decision_id"]))
        conn.commit()

        conn.execute("UPDATE p3_route_observations SET observation_json=?",
                     (canonical({**obs, "success": False}),))
        conn.commit()
        case("T12 tampered-observation-refused", lambda:
             must_refuse(lambda: read_trace(db, route["decision_id"])))
        conn.execute("UPDATE p3_route_observations SET observation_json=?",
                     (canonical(obs),))
        conn.commit()

        changed = seal_observation(route, task_id="another-private-task")
        conn.execute("""UPDATE p3_route_observations
          SET task_id=?,observation_id=?,observation_hash=?,observation_json=?
          WHERE route_decision_id=?""",
          (changed["task_id"],changed["observation_id"],
           changed["observation_hash"],canonical(changed),route["decision_id"]))
        conn.commit()
        case("T13 rehashed-cross-task-observation-is-still-refused", lambda:
             must_refuse(lambda: read_trace(db,route["decision_id"])))
        conn.execute("""UPDATE p3_route_observations
          SET task_id=?,observation_id=?,observation_hash=?,observation_json=?
          WHERE route_decision_id=?""",
          (obs["task_id"],obs["observation_id"],obs["observation_hash"],
           canonical(obs),route["decision_id"]))
        conn.commit()

        bad = seal_observation(route, authority_granted=True)
        conn.execute("""UPDATE p3_route_observations
          SET observation_id=?,observation_hash=?,observation_json=? WHERE route_decision_id=?""",
          (bad["observation_id"],bad["observation_hash"],
           canonical(bad),route["decision_id"]))
        conn.commit()
        case("T14 valid-self-hash-authority-claim-still-refused", lambda:
             must_refuse(lambda: read_trace(db,route["decision_id"])))
        conn.execute("""UPDATE p3_route_observations
          SET observation_id=?,observation_hash=?,observation_json=? WHERE route_decision_id=?""",
          (obs["observation_id"],obs["observation_hash"],
           canonical(obs),route["decision_id"]))
        conn.commit()

        conn.execute("UPDATE p1c_route_receipts SET model_ref=? WHERE decision_id=?",
                     ("model:" + "c"*32,route["decision_id"]))
        conn.commit()
        case("T15 SQLite-index-vs-signed-body-mismatch-refused", lambda:
             must_refuse(lambda: read_trace(db,route["decision_id"])))
        conn.execute("UPDATE p1c_route_receipts SET model_ref=? WHERE decision_id=?",
                     (route["model_ref"],route["decision_id"]))
        conn.commit()

        conn.execute("UPDATE p3_route_observations SET observation_json='bad-json'")
        conn.commit()
        case("T16 malformed-source-record-refused", lambda:
             must_refuse(lambda: read_trace(db,route["decision_id"])))
        conn.close()
    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
