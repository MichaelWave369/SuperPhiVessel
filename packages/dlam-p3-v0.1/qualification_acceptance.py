from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P1 = ROOT / "packages" / "dlam-p1-v0.1"
SFR_DIR = ROOT / "packages" / "sparse-frontier-v0.1"
P3 = ROOT / "packages" / "dlam-p3-v0.1"
for p in (P1, SFR_DIR, P3):
    sys.path.insert(0, str(p))

from dlam_store import DlamStore
from p1c_runtime import P1CRuntime
from qualification import P3QualificationGate, QualificationError
from routing_observatory import RoutingObservatory
from shadow_replay import ShadowReplayLab
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


def expect(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")


class FixedClock:
    def __init__(self):
        self.i = 0

    def __call__(self):
        self.i += 1
        return f"2026-10-07T22:{(self.i // 60) % 60:02d}:{self.i % 60:02d}Z"


def tok(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def model(name, priority):
    return {
        "name": name,
        "provider": "fixture",
        "runtime": "fixture",
        "runtime_version": "1",
        "weights_digest": f"sha256:{name}",
        "quantization": "Q4",
        "adapter_digest": None,
        "prompt_template_digest": f"sha256:{name}-template",
        "tokenizer_id": "fixture-tokenizer",
        "context_window": 32768,
        "capabilities": ["reasoning", "text", "tools", "frontier"],
        "locality": "LOCAL",
        "priority": priority,
        "max_vram_mb": 4096,
        "status": "QUALIFIED",
    }


def capsule(mid, profile):
    ga = profile.split(":")[1]
    return {
        "memory_id": mid,
        "namespace_id": f"genius.ga108.{ga}",
        "agent_id": "vessie",
        "genius_id": profile,
        "kind": "fact",
        "content": f"synthetic qualification memory {profile} secret-sentinel-never-export",
        "origin": "OBSERVED",
        "source_status": "CAPTURED",
        "sensitivity": "LOCAL",
        "allowed_targets": ["local_model"],
        "allowed_purposes": ["analysis"],
        "retention_rule": "retain_until_tombstoned",
    }


def prepare(rt, *, task_id, profile, memory_id, model_ref):
    return rt.prepare_task(
        task_id=task_id,
        query="synthetic paired qualification case",
        profile_ref=profile,
        agent_id="vessie",
        recipe_ref="recipe:p3c:v1",
        purpose="analysis",
        target_surface="local_model",
        policy_epoch=32,
        authority_decision_ref="auth:p3c:32",
        authority_status="CURRENT",
        memory_budget_tokens=10000,
        required_capabilities=["reasoning", "text"],
        preferred_capabilities=["tools"],
        local_only=True,
        minimum_context_tokens=4096,
        max_vram_mb=8192,
        allowed_model_refs=[model_ref],
        required_memory_ids=[memory_id],
    )


def signals(kind):
    if kind == "hard":
        return {
            "novelty": 0.10,
            "state_change_magnitude": 0.10,
            "consequence": 0.90,
            "provenance_gap": 0.10,
            "missing_evidence": 0.10,
            "irreversible_risk": 0.95,
            "disagreement": 0.10,
            "routing_confidence": 0.90,
            "governance_concern": False,
            "authority_boundary": False,
        }
    if kind == "soft":
        return {
            "novelty": 1.0,
            "state_change_magnitude": 1.0,
            "consequence": 0.70,
            "provenance_gap": 0.80,
            "missing_evidence": 0.80,
            "irreversible_risk": 0.20,
            "disagreement": 1.0,
            "routing_confidence": 0.0,
            "governance_concern": False,
            "authority_boundary": False,
        }
    return {
        "novelty": 0.05,
        "state_change_magnitude": 0.05,
        "consequence": 0.10,
        "provenance_gap": 0.05,
        "missing_evidence": 0.05,
        "irreversible_risk": 0.0,
        "disagreement": 0.0,
        "routing_confidence": 0.95,
        "governance_concern": False,
        "authority_boundary": False,
    }


def main():
    seeds = [11, 37, 101, 369, 2027]
    task_specs = [
        ("formal.reasoning", "ga108:032", "ga108:033"),
        ("systems.analysis", "ga108:104", "ga108:105"),
        ("navigation.analysis", "ga108:108", "ga108:107"),
        ("creative.analysis", "ga108:060", "ga108:061"),
    ]

    with tempfile.TemporaryDirectory() as td:
        store = DlamStore(Path(td) / "p3c.db", clock=FixedClock())
        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-tokenizer", tok)
        base_model = rt.register_model(model("p3c-baseline", 1))
        candidate_model = rt.register_model(model("p3c-candidate", 2))

        # One reusable admitted memory anchor per routed Genius.
        memory_ids = {}
        for _, base_profile, candidate_profile in task_specs:
            for profile in (base_profile, candidate_profile):
                if profile in memory_ids:
                    continue
                mid = "mem-" + profile.replace(":", "-")
                memory_ids[profile] = mid
                store.admit(capsule(mid, profile))

        observer = RoutingObservatory(rt)
        lab = ShadowReplayLab(observer)
        sfr = SparseFrontierRouter(rt)
        gate = P3QualificationGate(lab)

        def add_case(i):
            task_class, base_profile, candidate_profile = task_specs[i % len(task_specs)]
            task_id = f"p3c-task-{i:04d}"
            base_prepared = prepare(
                rt,
                task_id=task_id,
                profile=base_profile,
                memory_id=memory_ids[base_profile],
                model_ref=base_model["model_ref"],
            )
            candidate_prepared = prepare(
                rt,
                task_id=task_id,
                profile=candidate_profile,
                memory_id=memory_ids[candidate_profile],
                model_ref=candidate_model["model_ref"],
            )

            sfr_decision_id = None
            if i < 120:
                kind = "hard" if i < 20 else ("soft" if i < 60 else "local")
                decision = sfr.assess({
                    "candidate_id": f"p3c-sfr-{i:04d}",
                    "task_id": task_id,
                    "cheap_prediction": {"decision": "baseline"},
                    "cheap_confidence": 0.90 if kind in {"hard", "local"} else 0.10,
                    "cheap_model_ref": base_model["model_ref"],
                    "cheap_route_decision_id": base_prepared["route_receipt"]["decision_id"],
                    "memory_refs": [memory_ids[base_profile]],
                    "evidence_refs": [f"fixture:evidence:{i:04d}"],
                    "state_changes": [{"kind": kind}],
                    "task_tags": task_class.split("."),
                    "signals": signals(kind),
                    "authority_decision_ref": "auth:p3c:32",
                    "authority_status": "CURRENT",
                    "frontier_token_budget": 1200,
                })
                escalated = decision["escalated"]
                if kind == "hard":
                    require(escalated and "IRREVERSIBLE_ACTION_RISK" in decision["hard_reasons"], "hard SFR fixture failed")
                elif kind == "soft":
                    require(escalated and not decision["hard_reasons"], "soft SFR fixture failed")
                else:
                    require(not escalated, "local SFR fixture escalated")
                sfr.record_outcome(
                    decision["decision_id"],
                    frontier_model_ref=candidate_model["model_ref"] if escalated else None,
                    genius_profile_refs=[candidate_profile] if escalated else [],
                    frontier_conclusion_ref=(f"fixture:frontier:{i:04d}" if escalated else None),
                    changed_decision=(kind == "soft"),
                    discovered_missing_evidence=(kind == "soft"),
                    caught_critical_issue=(kind == "hard"),
                    critical_issue_present=(kind == "hard"),
                    eventual_success=True,
                    governance_violation=False,
                    latency_ms=500 if escalated else 60,
                    context_tokens=650 if escalated else 200,
                    estimated_cost_micros=500 if escalated else 0,
                )
                sfr_decision_id = decision["decision_id"]

            base_obs = observer.record_observation(
                route_decision_id=base_prepared["route_receipt"]["decision_id"],
                task_class=task_class,
                success=(i % 10 != 0),
                quality_score=0.72 + (i % 5) * 0.005,
                predicted_confidence=0.78,
                evidence_satisfied=True,
                governance_violation=False,
                critical_miss=False,
                user_correction=(i % 10 == 0),
                latency_ms=100,
                context_tokens=400,
                estimated_cost_micros=50,
                outcome_source_refs=[f"fixture:baseline:{i:04d}"],
                task_tags=task_class.split("."),
                sfr_decision_id=sfr_decision_id,
            )
            candidate_obs = observer.record_observation(
                route_decision_id=candidate_prepared["route_receipt"]["decision_id"],
                task_class=task_class,
                success=(i % 20 != 0),
                quality_score=0.91 + (i % 5) * 0.005,
                predicted_confidence=0.88,
                evidence_satisfied=True,
                governance_violation=False,
                critical_miss=False,
                user_correction=(i % 20 == 0),
                latency_ms=115,
                context_tokens=430,
                estimated_cost_micros=70,
                outcome_source_refs=[f"fixture:candidate:{i:04d}"],
                task_tags=task_class.split("."),
            )
            lab.register_case(
                case_ref=f"qualification-case-{i:04d}",
                partition_group_ref=f"qualification-group-{i:04d}",
                baseline_observation_id=base_obs["observation_id"],
                alternative_observation_ids=[candidate_obs["observation_id"]],
            )

        for i in range(20):
            add_case(i)

        small = gate.assess(
            seeds=seeds,
            train_fraction=0.70,
            minimum_route_observations=20,
            current_sfr_soft_threshold=0.62,
            evidence_class="SYNTHETIC_QUALIFICATION_FIXTURE",
            evidence_manifest_refs=["fixture:p3c:small"],
            fixture_mode=True,
        )
        case("C01 undersized-corpus-is-blocked", lambda: (
            require(small["status"] == "BLOCKED_INSUFFICIENT_EVIDENCE", "small corpus was not blocked"),
            require(small["technical_gates_passed"] is False, "small corpus passed technical gates"),
            require(small["p4_evaluation_allowed"] is False, "small corpus reached P4"),
        ))

        for i in range(20, 420):
            add_case(i)

        full = gate.assess(
            seeds=seeds,
            train_fraction=0.70,
            minimum_route_observations=20,
            current_sfr_soft_threshold=0.62,
            evidence_class="SYNTHETIC_QUALIFICATION_FIXTURE",
            evidence_manifest_refs=["fixture:p3c:420-paired", "fixture:p3c:sfr-120"],
            fixture_mode=True,
        )

        case("C02 structural-evidence-floors-pass", lambda:
            require(full["technical_gates_passed"] is True, "technical gates did not pass"))

        case("C03 total-and-task-class-coverage-meet-floors", lambda: (
            require(full["coverage"]["total_cases"] == 420, "case count wrong"),
            require(full["coverage"]["task_class_count"] == 4, "task class count wrong"),
            require(full["coverage"]["minimum_cases_in_any_task_class"] >= 100, "task floor wrong"),
        ))

        case("C04 ga108-and-model-coverage-are-explicit", lambda: (
            require(full["coverage"]["unique_profile_count"] == 8, "profile coverage wrong"),
            require(full["coverage"]["unique_model_count"] == 2, "model coverage wrong"),
        ))

        case("C05 five-distinct-heldout-seeds-qualify", lambda: (
            require(len(full["seed_reports"]) == 5, "seed count wrong"),
            require(len({x["seed"] for x in full["seed_reports"]}) == 5, "duplicate seed"),
        ))

        case("C06 every-seed-has-heldout-evidence-floor", lambda:
            require(all(x["test_cases"] >= 50 for x in full["seed_reports"]), "heldout floor failed"))

        case("C07 every-seed-has-full-paired-support", lambda:
            require(all(x["paired_support_coverage"] == 1.0 for x in full["seed_reports"]), "paired support incomplete"))

        case("C08 no-seed-has-leakage-or-breach", lambda:
            require(all(
                (not x["train_test_observation_leakage"])
                and x["candidate_non_tradable_breaches"] == 0
                for x in full["seed_reports"]
            ), "leakage/breach present"))

        case("C09 sfr-linked-and-frontier-floors-pass", lambda: (
            require(full["sfr_coverage"]["linked_observations"] == 120, "SFR linked count wrong"),
            require(full["sfr_coverage"]["completed_frontier_investigations"] == 60, "frontier count wrong"),
        ))

        case("C10 sfr-critical-cases-have-zero-misses", lambda: (
            require(full["sfr_coverage"]["critical_issues"] == 20, "critical count wrong"),
            require(full["sfr_coverage"]["critical_miss_rate"] == 0.0, "critical miss rate wrong"),
        ))

        case("C11 sfr-usefulness-and-governance-gates-pass", lambda: (
            require(full["sfr_coverage"]["escalation_precision"] == 1.0, "SFR precision wrong"),
            require(full["sfr_coverage"]["governance_violations"] == 0, "SFR governance violation"),
        ))

        case("C12 current-sfr-threshold-is-fully-supported", lambda:
            require(full["sfr_coverage"]["current_threshold_support_coverage"] == 1.0, "current threshold replay unsupported"))

        case("C13 synthetic-fixture-can-never-be-empirical-promotion", lambda: (
            require(full["status"] == "STRUCTURAL_PASS_SYNTHETIC_ONLY", "fixture guard failed"),
            require(full["empirical_evidence_gate_passed"] is False, "fixture became empirical"),
            require(full["p4_evaluation_allowed"] is False, "fixture reached P4"),
        ))

        packet = gate.p4_evaluation_packet(full)
        case("C14 p4-packet-remains-non-activating", lambda: (
            require(packet["activation_allowed"] is False, "packet activated routing"),
            require(packet["may_change_live_route"] is False, "packet changed live route"),
            require(packet["authority_granted"] is False, "packet granted authority"),
        ))

        case("C15 p4-packet-freezes-five-percent-and-five-seed-contract", lambda: (
            require(packet["p4_required_evaluation"]["minimum_heldout_tasks"] == 400, "task floor changed"),
            require(packet["p4_required_evaluation"]["minimum_distinct_seeds"] == 5, "seed floor changed"),
            require(packet["p4_required_evaluation"]["minimum_relative_utility_improvement"] == 0.05, "utility floor changed"),
        ))

        case("C16 p4-packet-requires-operator-activation-and-rollback", lambda: (
            require(packet["operator_activation_required"] is True, "operator activation missing"),
            require(packet["rollback_required"] is True, "rollback missing"),
            require(packet["p4_required_evaluation"]["automatic_activation_forbidden"] is True, "automatic activation allowed"),
        ))

        case("C17 evidence-manifest-is-required", lambda:
            expect(
                QualificationError,
                lambda: gate.assess(
                    seeds=seeds,
                    evidence_class="FIELD_OBSERVED",
                    evidence_manifest_refs=[],
                ),
            ))

        raw = json.dumps({"qualification": full, "packet": packet})
        case("C18 qualification-artifacts-do-not-copy-memory-text", lambda:
            require("secret-sentinel-never-export" not in raw, "memory text leaked"))

        full2 = gate.assess(
            seeds=seeds,
            train_fraction=0.70,
            minimum_route_observations=20,
            current_sfr_soft_threshold=0.62,
            evidence_class="SYNTHETIC_QUALIFICATION_FIXTURE",
            evidence_manifest_refs=["fixture:p3c:420-paired", "fixture:p3c:sfr-120"],
            fixture_mode=True,
        )
        case("C19 qualification-hash-is-deterministic", lambda:
            require(full2["qualification_hash"] == full["qualification_hash"], "qualification hash drift"))

        packet2 = gate.p4_evaluation_packet(full2)
        case("C20 p4-packet-hash-is-deterministic", lambda:
            require(packet2["packet_hash"] == packet["packet_hash"], "packet hash drift"))

        case("C21 learned-weights-remain-absent-through-p3-closeout", lambda: (
            require(full["learned_weights"] is None, "P3 learned weights appeared"),
            require(packet["learned_weights"] is None, "P4 packet contains learned weights"),
        ))

        case("C22 p3-structural-completion-does-not-equal-p4-readiness", lambda: (
            require(full["p3_complete_structurally"] is True, "P3 structural completion absent"),
            require(full["p4_evaluation_allowed"] is False, "structural completion leaked into P4 readiness"),
        ))

        store.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
