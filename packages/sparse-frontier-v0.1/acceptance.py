from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DLAM = ROOT / "packages" / "dlam-p1-v0.1"
SFR = ROOT / "packages" / "sparse-frontier-v0.1"
sys.path.insert(0, str(DLAM))
sys.path.insert(0, str(SFR))

from dlam_store import DlamStore
from p1c_runtime import P1CRuntime
from sparse_frontier import SparseFrontierRouter

ROSTER = ROOT / "protocols" / "dlam-v0.1" / "genius-roster.json"

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
        return f"2026-10-07T19:00:{self.i:02d}Z"


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


def model(name, priority):
    return {
        "name": name,
        "provider": "fixture",
        "runtime": "fixture",
        "runtime_version": "1",
        "weights_digest": f"sha256:{name}",
        "quantization": "Q4",
        "adapter_digest": None,
        "prompt_template_digest": "sha256:template",
        "tokenizer_id": "fixture-tokenizer",
        "context_window": 32768,
        "capabilities": ["text", "reasoning", "tools", "frontier"],
        "locality": "LOCAL",
        "priority": priority,
        "max_vram_mb": 4096,
        "status": "QUALIFIED",
    }


def signals(**kw):
    base = {
        "novelty": 0.05,
        "state_change_magnitude": 0.05,
        "consequence": 0.10,
        "provenance_gap": 0.05,
        "missing_evidence": 0.05,
        "irreversible_risk": 0.00,
        "disagreement": 0.00,
        "routing_confidence": 0.95,
        "governance_concern": False,
        "authority_boundary": False,
    }
    base.update(kw)
    return base


def candidate(cid, **kw):
    return {
        "candidate_id": cid,
        "task_id": kw.pop("task_id", f"task-{cid}"),
        "cheap_prediction": kw.pop("cheap_prediction", {"decision": "continue_local"}),
        "cheap_confidence": kw.pop("cheap_confidence", 0.94),
        "cheap_model_ref": kw.pop("cheap_model_ref", None),
        "cheap_route_decision_id": kw.pop("cheap_route_decision_id", None),
        "memory_refs": kw.pop("memory_refs", []),
        "evidence_refs": kw.pop("evidence_refs", []),
        "state_changes": kw.pop("state_changes", []),
        "task_tags": kw.pop("task_tags", ["computability"]),
        "signals": kw.pop("signals", signals()),
        "authority_decision_ref": kw.pop("authority_decision_ref", "auth:sfr:1"),
        "authority_status": kw.pop("authority_status", "CURRENT"),
        "frontier_token_budget": kw.pop("frontier_token_budget", 1200),
        **kw,
    }


def main():
    with tempfile.TemporaryDirectory() as td:
        store = DlamStore(Path(td) / "memory.db", clock=FixedClock())
        store.admit(capsule("easy-memory", "known deterministic local transform"))
        store.admit(capsule("claim-a", "reactor pressure stable"))
        store.admit(capsule("claim-b", "reactor pressure unstable", conflict_refs=["claim-a"]))

        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-tokenizer", tok)
        cheap = rt.register_model(model("cheap-local", 1))
        frontier = rt.register_model(model("frontier-local", 20))

        sfr = SparseFrontierRouter(rt)

        easy = sfr.assess(candidate(
            "easy",
            cheap_model_ref=cheap["model_ref"],
            memory_refs=["easy-memory"],
            task_tags=["formal", "computation"],
            signals=signals(),
        ))
        case("S01 easy-local-does-not-wake-frontier", lambda: (
            require(easy["disposition"] == "LOCAL_RESOLVE", "easy case escalated"),
            require(easy["frontier_packet"] is None, "frontier packet created"),
            require(easy["recommended_geniuses"] == [], "Genius woke on easy case"),
        ))

        critical = sfr.assess(candidate(
            "critical",
            cheap_model_ref=cheap["model_ref"],
            cheap_confidence=0.56,
            memory_refs=["claim-a", "claim-b"],
            evidence_refs=["evidence:pressure:1"],
            state_changes=[{"field": "pressure", "from": 0.4, "to": 0.9}],
            task_tags=["uncertainty", "control", "causal", "computation"],
            signals=signals(
                consequence=0.95,
                irreversible_risk=0.92,
                disagreement=0.72,
                routing_confidence=0.51,
            ),
        ))
        case("S02 contradiction-critical-risk-escalates", lambda: (
            require(critical["disposition"] == "ESCALATE_INVESTIGATION", "critical case stayed local"),
            require("IRREVERSIBLE_ACTION_RISK" in critical["hard_reasons"], "risk trigger missing"),
            require(critical["memory_signal_receipt"]["contradiction_count"] >= 1, "memory contradiction missing"),
            require(critical["frontier_packet"]["action_authority"] == "NONE", "authority leak"),
        ))

        case("S03 escalation-wakes-small-genius-subset", lambda: (
            require(0 < len(critical["recommended_geniuses"]) <= 3, "bad Genius activation size"),
            require(len(critical["recommended_geniuses"]) < 108, "full roster activated"),
            require(all(x["activation_status"] == "RECOMMENDED_DORMANT" for x in critical["recommended_geniuses"]), "Genius auto-activated"),
        ))

        experimental = sfr.assess(candidate(
            "nbg-exp",
            cheap_model_ref=cheap["model_ref"],
            nbg={
                "status": "LEARNED_EXPERIMENTAL",
                "activation_anomaly": 1.0,
                "source_ref": "nbg-w:fixture",
            },
            signals=signals(),
        ))
        case("S04 experimental-nbg-alone-cannot-escalate", lambda: (
            require(experimental["disposition"] == "LOCAL_RESOLVE", "experimental NBG changed routing"),
            require(experimental["nbg_signal_receipt"]["score_effect"] == "LOG_ONLY_NOT_ROUTING", "NBG boundary lost"),
        ))

        deterministic_nbg = sfr.assess(candidate(
            "nbg-det",
            cheap_model_ref=cheap["model_ref"],
            cheap_confidence=0.70,
            task_tags=["temporal", "causal", "uncertainty"],
            nbg={
                "status": "DETERMINISTIC_PROJECTED",
                "temporal_divergence": True,
                "unresolved_dependencies": 3,
                "source_ref": "nbg-t:fixture",
            },
            signals=signals(
                novelty=0.75,
                consequence=0.70,
                missing_evidence=0.60,
                routing_confidence=0.55,
            ),
        ))
        case("S05 deterministic-nbg-signal-is-bounded-feature", lambda:
            require(deterministic_nbg["nbg_signal_receipt"]["score_effect"] == "ENABLED_DETERMINISTIC", "deterministic NBG ignored"))

        stale = sfr.assess(candidate(
            "stale",
            cheap_model_ref=cheap["model_ref"],
            authority_status="STALE",
            signals=signals(governance_concern=True, irreversible_risk=1.0),
        ))
        case("S06 stale-authority-holds-before-frontier", lambda: (
            require(stale["disposition"] == "HELD", "stale authority escalated"),
            require(stale["frontier_packet"] is None, "stale packet exposed"),
        ))

        denied = sfr.assess(candidate(
            "denied",
            cheap_model_ref=cheap["model_ref"],
            authority_status="DENIED",
            signals=signals(governance_concern=True),
        ))
        case("S07 denied-authority-denies-frontier", lambda:
            require(denied["disposition"] == "DENIED", "denial ignored"))

        local_outcome = sfr.record_outcome(
            easy["decision_id"],
            frontier_model_ref=None,
            genius_profile_refs=[],
            frontier_conclusion_ref=None,
            changed_decision=False,
            discovered_missing_evidence=False,
            caught_critical_issue=False,
            critical_issue_present=False,
            eventual_success=True,
            governance_violation=False,
            latency_ms=4,
            context_tokens=0,
        )
        case("S08 local-outcome-recorded-no-frontier", lambda: (
            require(local_outcome["frontier_used"] is False, "local marked frontier"),
            require(local_outcome["authority_granted"] is False, "authority leak"),
        ))

        selected_geniuses = [x["profile_ref"] for x in critical["recommended_geniuses"]]
        before = sfr.routing_knowledge_snapshot()
        frontier_outcome = sfr.record_outcome(
            critical["decision_id"],
            frontier_model_ref=frontier["model_ref"],
            genius_profile_refs=selected_geniuses,
            frontier_conclusion_ref="evidence:frontier:critical",
            changed_decision=True,
            discovered_missing_evidence=True,
            caught_critical_issue=True,
            critical_issue_present=True,
            eventual_success=True,
            governance_violation=False,
            latency_ms=1200,
            context_tokens=650,
            estimated_cost_micros=900,
        )
        after = sfr.routing_knowledge_snapshot()
        case("S09 frontier-result-changes-routing-knowledge-not-authority", lambda: (
            require(before["snapshot_hash"] != after["snapshot_hash"], "knowledge did not change"),
            require(after["may_change_live_thresholds"] is False, "shadow knowledge changed live routing"),
            require(after["may_grant_authority"] is False, "knowledge gained authority"),
            require(frontier_outcome["authority_granted"] is False, "outcome granted authority"),
        ))

        metrics = sfr.metrics()
        case("S10 frontier-duty-cycle-measured-not-solo-objective", lambda: (
            require(metrics["frontier_duty_cycle"] is not None, "FDC missing"),
            require("critical_miss_rate" in metrics, "critical miss metric missing"),
            require(metrics["governance_violations"] == 0, "governance violation"),
            require("subject to" in metrics["optimization_statement"], "constraint objective missing"),
        ))

        case("S11 useful-frontier-call-measured", lambda: (
            require(metrics["frontier_calls_changed_outcome"] == 1, "changed-outcome count wrong"),
            require(metrics["frontier_calls_unnecessary"] == 0, "useful call marked unnecessary"),
            require(metrics["escalation_precision"] == 1.0, "precision mismatch"),
        ))

        case("S12 frontier-context-is-bounded-reference-region", lambda: (
            require(len(critical["frontier_packet"]["bounded_region"]["memory_refs"]) == 2, "region refs drift"),
            require("reactor pressure stable" not in json.dumps(critical["frontier_packet"]), "raw memory leaked into escalation envelope"),
            require(critical["frontier_packet"]["token_budget"] == 1200, "token budget lost"),
        ))

        decision_again = sfr.assess(candidate(
            "critical",
            cheap_model_ref=cheap["model_ref"],
            cheap_confidence=0.56,
            memory_refs=["claim-a", "claim-b"],
            evidence_refs=["evidence:pressure:1"],
            state_changes=[{"field": "pressure", "from": 0.4, "to": 0.9}],
            task_tags=["uncertainty", "control", "causal", "computation"],
            signals=signals(
                consequence=0.95,
                irreversible_risk=0.92,
                disagreement=0.72,
                routing_confidence=0.51,
            ),
        ))
        case("S13 deterministic-escalation-receipt", lambda:
            require(decision_again["decision_hash"] == critical["decision_hash"], "decision hash drift"))

        case("S14 thresholds-remain-static-shadow-only", lambda: (
            require(critical["threshold_learning_active"] is False, "live threshold learning enabled"),
            require(after["learning_mode"] == "SHADOW_OBSERVATION_ONLY", "wrong learning mode"),
        ))

        store.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
