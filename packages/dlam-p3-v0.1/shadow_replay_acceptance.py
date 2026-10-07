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

from dlam_store import DlamStore, ValidationError
from p1c_runtime import P1CRuntime
from routing_observatory import RoutingObservatory
from shadow_replay import ReplayError, ShadowReplayLab
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
        return f"2026-10-07T21:{self.i % 60:02d}:00Z"


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


def capsule(mid, profile, content):
    ga = profile.split(":")[1]
    return {
        "memory_id": mid,
        "namespace_id": f"genius.ga108.{ga}",
        "agent_id": "vessie",
        "genius_id": profile,
        "kind": "fact",
        "content": content,
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
        query="paired benchmark routing case",
        profile_ref=profile,
        agent_id="vessie",
        recipe_ref="recipe:p3b:v1",
        purpose="analysis",
        target_surface="local_model",
        policy_epoch=31,
        authority_decision_ref="auth:p3b:31",
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


def observe(observer, prepared, *, quality, success=True, governance=False,
            critical=False, confidence=0.80, source="verifier:fixture",
            sfr_decision_id=None):
    return observer.record_observation(
        route_decision_id=prepared["route_receipt"]["decision_id"],
        task_class="routing.compare",
        success=success,
        quality_score=quality,
        predicted_confidence=confidence,
        evidence_satisfied=True,
        governance_violation=governance,
        critical_miss=critical,
        user_correction=not success,
        latency_ms=100,
        context_tokens=400,
        estimated_cost_micros=100,
        outcome_source_refs=[source],
        task_tags=["routing", "systems", "formal"],
        sfr_decision_id=sfr_decision_id,
    )


def sfr_signals(**kw):
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


def pick_groups(lab, *, seed, train_fraction, train_count, test_count):
    train, test = [], []
    i = 0
    while len(train) < train_count or len(test) < test_count:
        ref = f"group-{i:03d}"
        p = lab.partition_for_group(ref, seed=seed, train_fraction=train_fraction)
        if p == "TRAIN" and len(train) < train_count:
            train.append(ref)
        elif p == "TEST" and len(test) < test_count:
            test.append(ref)
        i += 1
    return train, test


def main():
    seed = 369
    train_fraction = 0.60

    with tempfile.TemporaryDirectory() as td:
        store = DlamStore(Path(td) / "p3b.db", clock=FixedClock())
        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-tokenizer", tok)

        ma = rt.register_model(model("baseline-local", 1))
        mb = rt.register_model(model("candidate-local", 2))
        mc = rt.register_model(model("risky-local", 3))

        observer = RoutingObservatory(rt)
        sfr = SparseFrontierRouter(rt)
        lab = ShadowReplayLab(observer)

        train_groups, test_groups = pick_groups(
            lab,
            seed=seed,
            train_fraction=train_fraction,
            train_count=3,
            test_count=2,
        )

        case("B01 deterministic-group-partition", lambda: (
            require(
                lab.partition_for_group(train_groups[0], seed=seed, train_fraction=train_fraction)
                == "TRAIN",
                "train group drift",
            ),
            require(
                lab.partition_for_group(test_groups[0], seed=seed, train_fraction=train_fraction)
                == "TEST",
                "test group drift",
            ),
        ))

        static_before = rt.plan_static_route(
            profile_ref="ga108:032",
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[ma["model_ref"], mb["model_ref"], mc["model_ref"]],
        )

        created_cases = []
        first_train_obs = None

        def build_route(case_no, profile, model_ref, label, quality, *,
                        governance=False, critical=False, sfr_id=None):
            mid = f"mem-{case_no}-{label}"
            store.admit(capsule(
                mid,
                profile,
                f"private benchmark fixture {case_no} {label} sentinel-text-never-export",
            ))
            prepared = prepare(
                rt,
                task_id=f"paired-task-{case_no}",
                profile=profile,
                memory_id=mid,
                model_ref=model_ref,
            )
            ob = observe(
                observer,
                prepared,
                quality=quality,
                governance=governance,
                critical=critical,
                source=f"verifier:paired:{case_no}:{label}",
                sfr_decision_id=sfr_id,
            )
            return prepared, ob

        # Training cases: candidate B is genuinely observed and better than A.
        # Risky C looks superficially excellent but carries a governance breach.
        for idx, group in enumerate(train_groups, start=1):
            a_p, a_o = build_route(idx, "ga108:032", ma["model_ref"], "a", 0.70 + idx * 0.01)
            b_p, b_o = build_route(idx, "ga108:104", mb["model_ref"], "b", 0.92 + idx * 0.01)
            c_p, c_o = build_route(
                idx, "ga108:108", mc["model_ref"], "c", 0.99,
                governance=True,
            )
            registered = lab.register_case(
                case_ref=f"case-train-{idx}",
                partition_group_ref=group,
                baseline_observation_id=a_o["observation_id"],
                alternative_observation_ids=[b_o["observation_id"], c_o["observation_id"]],
            )
            created_cases.append(registered)
            if first_train_obs is None:
                first_train_obs = (a_p, a_o)

        # Supported held-out case includes the route preferred from training.
        supported_no = 100
        a_p, a_o = build_route(supported_no, "ga108:032", ma["model_ref"], "a", 0.73)
        b_p, b_o = build_route(supported_no, "ga108:104", mb["model_ref"], "b", 0.95)
        c_p, c_o = build_route(
            supported_no, "ga108:108", mc["model_ref"], "c", 0.995,
            governance=True,
        )
        supported_case = lab.register_case(
            case_ref="case-test-supported",
            partition_group_ref=test_groups[0],
            baseline_observation_id=a_o["observation_id"],
            alternative_observation_ids=[b_o["observation_id"], c_o["observation_id"]],
        )
        created_cases.append(supported_case)

        # Unsupported held-out case never ran candidate B. P3-B must abstain.
        unsupported_no = 101
        a2_p, a2_o = build_route(unsupported_no, "ga108:032", ma["model_ref"], "a", 0.74)
        c2_p, c2_o = build_route(
            unsupported_no, "ga108:108", mc["model_ref"], "c", 1.0,
            governance=True,
        )
        unsupported_case = lab.register_case(
            case_ref="case-test-unsupported",
            partition_group_ref=test_groups[1],
            baseline_observation_id=a2_o["observation_id"],
            alternative_observation_ids=[c2_o["observation_id"]],
        )
        created_cases.append(unsupported_case)

        case("B02 paired-case-is-immutable-and-idempotent", lambda: (
            require(
                lab.register_case(
                    case_ref="case-test-supported",
                    partition_group_ref=test_groups[0],
                    baseline_observation_id=a_o["observation_id"],
                    alternative_observation_ids=[b_o["observation_id"], c_o["observation_id"]],
                )["case_id"] == supported_case["case_id"],
                "identical case was not idempotent",
            ),
            expect(
                ReplayError,
                lambda: lab.register_case(
                    case_ref="case-test-supported",
                    partition_group_ref=test_groups[0],
                    baseline_observation_id=a_o["observation_id"],
                    alternative_observation_ids=[c_o["observation_id"]],
                ),
            ),
        ))

        # Create a mismatched task observation and prove it cannot be paired.
        store.admit(capsule("mismatch-mem", "ga108:104", "mismatch sentinel"))
        mismatch_p = prepare(
            rt,
            task_id="different-task",
            profile="ga108:104",
            memory_id="mismatch-mem",
            model_ref=mb["model_ref"],
        )
        mismatch_o = observe(observer, mismatch_p, quality=0.90, source="verifier:mismatch")
        case("B03 replay-case-requires-same-task-id", lambda:
            expect(
                ReplayError,
                lambda: lab.register_case(
                    case_ref="bad-pair",
                    partition_group_ref=train_groups[0],
                    baseline_observation_id=a_o["observation_id"],
                    alternative_observation_ids=[mismatch_o["observation_id"]],
                ),
            ))

        dataset = lab.dataset_snapshot(seed=seed, train_fraction=train_fraction)
        case("B04 partition-groups-never-leak", lambda: (
            require(dataset["group_leakage"] is False, "group leakage detected"),
            require(set(dataset["train_groups"]).isdisjoint(dataset["test_groups"]), "train/test group overlap"),
        ))

        policy = lab.fit_route_policy(
            seed=seed,
            train_fraction=train_fraction,
            minimum_route_observations=2,
        )
        expected_signature = "ga108:104|" + mb["model_ref"]
        risky_signature = "ga108:108|" + mc["model_ref"]

        case("B05 policy-fit-uses-training-observations-only", lambda: (
            require(set(policy["training_source_observation_ids"]).isdisjoint({
                a_o["observation_id"], b_o["observation_id"], c_o["observation_id"],
                a2_o["observation_id"], c2_o["observation_id"],
            }), "held-out observation leaked into training"),
            require(policy["policy_is_live"] is False, "policy became live"),
        ))

        case("B06 clean-observed-route-wins-training-shadow-rank", lambda:
            require(
                policy["preferred_routes"]["routing.compare"] == expected_signature,
                "expected candidate route not selected",
            ))

        risky_key = "routing.compare|" + risky_signature
        case("B07 governance-breach-cannot-be-bought-with-quality", lambda: (
            require(policy["route_stats"][risky_key]["mean_quality"] > 0.98, "risky route fixture wrong"),
            require(policy["route_stats"][risky_key]["non_tradable_breaches"] > 0, "breach missing"),
            require(policy["route_stats"][risky_key]["clean_for_shadow_selection"] is False, "breached route selectable"),
        ))

        report = lab.evaluate_route_policy(policy)
        case("B08 held-out-supported-case-uses-paired-observed-outcome", lambda:
            require(report["supported_paired_cases"] == 1, "supported case count wrong"))

        case("B09 unobserved-candidate-is-marked-unsupported", lambda: (
            require(report["unsupported_counterfactual_cases"] == 1, "unsupported count wrong"),
            require(
                any(r["case_ref"] == "case-test-unsupported" and r["status"] == "UNSUPPORTED_COUNTERFACTUAL" for r in report["results"]),
                "unsupported case was fabricated",
            ),
        ))

        case("B10 paired-heldout-delta-shows-observed-quality-improvement", lambda:
            require(report["mean_paired_delta"]["quality"] > 0.0, "paired quality delta not positive"))

        case("B11 train-test-observation-sets-are-disjoint", lambda:
            require(report["train_test_observation_leakage"] is False, "observation leakage"))

        case("B12 replay-report-makes-no-causal-or-promotion-claim", lambda: (
            require(report["causal_claim"] == "NONE", "causal claim leaked"),
            require(report["promotion_eligible"] is False, "P3-B promoted itself"),
            require(report["may_change_live_route"] is False, "live routing authority leaked"),
            require(report["authority_granted"] is False, "authority leaked"),
        ))

        # Add two SFR-linked P3 observations: one composite-only escalation and
        # one hard irreversible-risk escalation.
        base_prepared, _ = first_train_obs
        composite = sfr.assess({
            "candidate_id": "p3b-sfr-composite",
            "task_id": base_prepared["route_receipt"]["task_id"],
            "cheap_prediction": {"decision": "local"},
            "cheap_confidence": 0.20,
            "cheap_model_ref": ma["model_ref"],
            "cheap_route_decision_id": base_prepared["route_receipt"]["decision_id"],
            "memory_refs": [base_prepared["request"]["required_memory_ids"][0]],
            "evidence_refs": ["evidence:sfr:composite"],
            "state_changes": [{"kind": "novel"}],
            "task_tags": ["routing", "uncertainty"],
            "signals": sfr_signals(
                novelty=1.0,
                state_change_magnitude=1.0,
                consequence=0.60,
                provenance_gap=0.80,
                missing_evidence=0.70,
                disagreement=1.0,
                routing_confidence=0.0,
            ),
            "authority_decision_ref": "auth:p3b:31",
            "authority_status": "CURRENT",
            "frontier_token_budget": 1000,
        })
        require(composite["escalated"] is True and not composite["hard_reasons"], "composite fixture did not soft-escalate")
        sfr.record_outcome(
            composite["decision_id"],
            frontier_model_ref=mb["model_ref"],
            genius_profile_refs=["ga108:104"],
            frontier_conclusion_ref="evidence:sfr:composite:outcome",
            changed_decision=True,
            discovered_missing_evidence=True,
            caught_critical_issue=False,
            critical_issue_present=False,
            eventual_success=True,
            governance_violation=False,
            latency_ms=500,
            context_tokens=500,
        )

        # P3-A observations are immutable; create a fresh route to join the SFR record.
        store.admit(capsule("sfr-composite-mem", "ga108:032", "soft escalation sentinel"))
        composite_p = prepare(
            rt,
            task_id="sfr-composite-task",
            profile="ga108:032",
            memory_id="sfr-composite-mem",
            model_ref=ma["model_ref"],
        )
        # Recreate SFR with the exact route/task for the fresh observation.
        composite2 = sfr.assess({
            "candidate_id": "p3b-sfr-composite-2",
            "task_id": "sfr-composite-task",
            "cheap_prediction": {"decision": "local"},
            "cheap_confidence": 0.20,
            "cheap_model_ref": ma["model_ref"],
            "cheap_route_decision_id": composite_p["route_receipt"]["decision_id"],
            "memory_refs": ["sfr-composite-mem"],
            "evidence_refs": ["evidence:sfr:composite2"],
            "state_changes": [{"kind": "novel"}],
            "task_tags": ["routing", "uncertainty"],
            "signals": sfr_signals(
                novelty=1.0,
                state_change_magnitude=1.0,
                consequence=0.60,
                provenance_gap=0.80,
                missing_evidence=0.70,
                disagreement=1.0,
                routing_confidence=0.0,
            ),
            "authority_decision_ref": "auth:p3b:31",
            "authority_status": "CURRENT",
            "frontier_token_budget": 1000,
        })
        require(composite2["escalated"] is True and not composite2["hard_reasons"], "soft SFR fixture failed")
        sfr.record_outcome(
            composite2["decision_id"],
            frontier_model_ref=mb["model_ref"],
            genius_profile_refs=["ga108:104"],
            frontier_conclusion_ref="evidence:sfr:composite2:outcome",
            changed_decision=True,
            discovered_missing_evidence=True,
            caught_critical_issue=False,
            critical_issue_present=False,
            eventual_success=True,
            governance_violation=False,
            latency_ms=500,
            context_tokens=500,
        )
        observer.record_observation(
            route_decision_id=composite_p["route_receipt"]["decision_id"],
            task_class="sfr.calibration",
            success=True,
            quality_score=0.9,
            predicted_confidence=0.2,
            evidence_satisfied=True,
            governance_violation=False,
            critical_miss=False,
            user_correction=False,
            latency_ms=80,
            context_tokens=300,
            estimated_cost_micros=0,
            outcome_source_refs=["verifier:sfr:composite2"],
            task_tags=["routing", "uncertainty"],
            sfr_decision_id=composite2["decision_id"],
        )

        store.admit(capsule("sfr-hard-mem", "ga108:032", "hard escalation sentinel"))
        hard_p = prepare(
            rt,
            task_id="sfr-hard-task",
            profile="ga108:032",
            memory_id="sfr-hard-mem",
            model_ref=ma["model_ref"],
        )
        hard = sfr.assess({
            "candidate_id": "p3b-sfr-hard",
            "task_id": "sfr-hard-task",
            "cheap_prediction": {"decision": "local"},
            "cheap_confidence": 0.95,
            "cheap_model_ref": ma["model_ref"],
            "cheap_route_decision_id": hard_p["route_receipt"]["decision_id"],
            "memory_refs": ["sfr-hard-mem"],
            "evidence_refs": ["evidence:sfr:hard"],
            "state_changes": [],
            "task_tags": ["risk"],
            "signals": sfr_signals(
                consequence=0.90,
                irreversible_risk=0.95,
            ),
            "authority_decision_ref": "auth:p3b:31",
            "authority_status": "CURRENT",
            "frontier_token_budget": 1000,
        })
        require("IRREVERSIBLE_ACTION_RISK" in hard["hard_reasons"], "hard SFR fixture failed")
        sfr.record_outcome(
            hard["decision_id"],
            frontier_model_ref=mb["model_ref"],
            genius_profile_refs=["ga108:104"],
            frontier_conclusion_ref="evidence:sfr:hard:outcome",
            changed_decision=False,
            discovered_missing_evidence=False,
            caught_critical_issue=True,
            critical_issue_present=True,
            eventual_success=True,
            governance_violation=False,
            latency_ms=400,
            context_tokens=450,
        )
        observer.record_observation(
            route_decision_id=hard_p["route_receipt"]["decision_id"],
            task_class="sfr.calibration",
            success=True,
            quality_score=0.95,
            predicted_confidence=0.95,
            evidence_satisfied=True,
            governance_violation=False,
            critical_miss=False,
            user_correction=False,
            latency_ms=70,
            context_tokens=280,
            estimated_cost_micros=0,
            outcome_source_refs=["verifier:sfr:hard"],
            task_tags=["risk"],
            sfr_decision_id=hard["decision_id"],
        )

        same_threshold = lab.replay_sfr_threshold(candidate_soft_threshold=0.62)
        case("B13 current-sfr-soft-threshold-replay-is-on-policy", lambda:
            require(
                all(r["supported"] for r in same_threshold["results"]),
                "current threshold unexpectedly created unsupported flip",
            ))

        high_threshold = lab.replay_sfr_threshold(candidate_soft_threshold=0.99)
        case("B14 threshold-flip-is-unsupported-counterfactual", lambda:
            require(
                any(r["status"] == "UNSUPPORTED_COUNTERFACTUAL" for r in high_threshold["results"]),
                "threshold flip was incorrectly scored",
            ))

        hard_row = next(
            r for r in high_threshold["results"]
            if r["observation_id"] == observer._rows()[-1]["observation_id"]
        )
        case("B15 hard-escalation-survives-high-soft-threshold", lambda:
            require(hard_row["candidate_escalated"] is True and hard_row["supported"] is True, "hard reason overridden"))

        case("B16 sfr-replay-carries-no-live-threshold-authority", lambda: (
            require(high_threshold["threshold_is_live"] is False, "threshold became live"),
            require(high_threshold["may_change_live_thresholds"] is False, "threshold authority leaked"),
            require(high_threshold["causal_claim"] == "NONE", "SFR causal claim leaked"),
        ))

        static_after = rt.plan_static_route(
            profile_ref="ga108:032",
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[ma["model_ref"], mb["model_ref"], mc["model_ref"]],
        )
        case("B17 fitting-and-replay-do-not-change-live-p1c-route", lambda:
            require(static_after["selected_model_ref"] == static_before["selected_model_ref"], "live static route changed"))

        raw = json.dumps({"policy": policy, "report": report})
        case("B18 replay-artifacts-contain-no-benchmark-memory-text", lambda:
            require("sentinel-text-never-export" not in raw, "raw memory text leaked"))

        report2 = lab.evaluate_route_policy(policy)
        case("B19 replay-report-hash-is-deterministic", lambda:
            require(report2["report_hash"] == report["report_hash"], "report hash drift"))

        unsupported_policy = lab.fit_route_policy(
            seed=seed,
            train_fraction=train_fraction,
            minimum_route_observations=999,
        )
        case("B20 insufficient-training-support-produces-no-route-preference", lambda: (
            require(unsupported_policy["preferred_routes"]["routing.compare"] is None, "unsupported policy invented a route"),
            require(unsupported_policy["may_change_live_route"] is False, "unsupported policy became live"),
        ))

        store.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
