from __future__ import annotations

import copy
import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P1 = ROOT / "packages" / "dlam-p1-v0.1"
P3 = ROOT / "packages" / "dlam-p3-v0.1"
P4 = ROOT / "packages" / "dlam-p4-v0.1"
for p in (P1, P3, P4):
    sys.path.insert(0, str(p))

from bounded_linear_ucb import (
    BoundedLinearUCB,
    FEATURE_NAMES,
    LearnerError,
)
from dlam_store import DlamStore
from p1c_runtime import P1CRuntime
from routing_observatory import RoutingObservatory

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
        return f"2026-10-07T23:{(self.i // 60) % 60:02d}:{self.i % 60:02d}Z"


def tok(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def model(name, *, priority, status="QUALIFIED", weights=None, vram=4096):
    return {
        "name": name,
        "provider": "fixture",
        "runtime": "fixture",
        "runtime_version": "1",
        "weights_digest": weights or f"sha256:{name}",
        "quantization": "Q4",
        "adapter_digest": None,
        "prompt_template_digest": f"sha256:{name}-template",
        "tokenizer_id": "fixture-tokenizer",
        "context_window": 32768,
        "capabilities": ["reasoning", "text", "tools"],
        "locality": "LOCAL",
        "priority": priority,
        "max_vram_mb": vram,
        "status": status,
    }


def capsule(mid, profile, text):
    ga = profile.split(":")[1]
    return {
        "memory_id": mid,
        "namespace_id": f"genius.ga108.{ga}",
        "agent_id": "vessie",
        "genius_id": profile,
        "kind": "fact",
        "content": text,
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
        query="systems feedback leverage routing benchmark",
        profile_ref=profile,
        agent_id="vessie",
        recipe_ref="recipe:p4a:v1",
        purpose="analysis",
        target_surface="local_model",
        policy_epoch=40,
        authority_decision_ref="auth:p4a:40",
        authority_status="CURRENT",
        memory_budget_tokens=8000,
        required_capabilities=["reasoning", "text"],
        preferred_capabilities=["tools"],
        local_only=True,
        minimum_context_tokens=4096,
        max_vram_mb=8192,
        allowed_model_refs=[model_ref],
        required_memory_ids=[memory_id],
    )


def observe(observer, prepared, *, quality, success=True, governance=False,
            critical=False, latency=100, cost=50, correction=False):
    return observer.record_observation(
        route_decision_id=prepared["route_receipt"]["decision_id"],
        task_class="systems.analysis",
        success=success,
        quality_score=quality,
        predicted_confidence=0.82 if success else 0.55,
        evidence_satisfied=True,
        governance_violation=governance,
        critical_miss=critical,
        user_correction=correction,
        latency_ms=latency,
        context_tokens=450,
        estimated_cost_micros=cost,
        outcome_source_refs=[f"fixture:outcome:{prepared['route_receipt']['decision_id']}"],
        task_tags=["systems", "feedback", "leverage"],
    )


def source_artifacts(observation_ids):
    qualification = {
        "schema": "superphivessel.dlam.p3c.qualification.v0.1",
        "status": "STRUCTURAL_PASS_SYNTHETIC_ONLY",
        "qualification_id": "p3qual_fixture_p4a",
        "qualification_hash": "sha256:p3qual-fixture-p4a",
        "p4_evaluation_allowed": False,
        "evidence_class": "SYNTHETIC_QUALIFICATION_FIXTURE",
    }
    packet = {
        "schema": "superphivessel.dlam.p4.evaluation-packet.v0.1",
        "packet_id": "p4eval_fixture_p4a",
        "packet_hash": "sha256:p4eval-fixture-p4a",
        "source_qualification_id": qualification["qualification_id"],
        "source_qualification_hash": qualification["qualification_hash"],
        "p4_evaluation_allowed": False,
        "source_observation_ids": sorted(observation_ids),
        "activation_allowed": False,
        "authority_granted": False,
    }
    return qualification, packet


def main():
    with tempfile.TemporaryDirectory() as td:
        store = DlamStore(Path(td) / "p4a.db", clock=FixedClock())
        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-tokenizer", tok)

        ma = rt.register_model(model("static-cheap", priority=1))
        mb = rt.register_model(model("learned-better", priority=5))
        mc = rt.register_model(model("breached-highscore", priority=2))

        profiles = {
            "a": "ga108:032",
            "b": "ga108:104",
            "c": "ga108:108",
        }
        memories = {}
        for label, profile in profiles.items():
            mid = f"mem-{label}"
            memories[label] = mid
            store.admit(capsule(
                mid,
                profile,
                f"private p4a training memory {label} secret-p4a-never-export",
            ))

        observer = RoutingObservatory(rt)
        learner = BoundedLinearUCB(observer)

        static_before = rt.plan_static_route(
            profile_ref=profiles["a"],
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[ma["model_ref"], mb["model_ref"], mc["model_ref"]],
        )

        observations = []
        # Route A: adequate but clearly weaker.
        for i in range(8):
            p = prepare(
                rt,
                task_id=f"train-a-{i}",
                profile=profiles["a"],
                memory_id=memories["a"],
                model_ref=ma["model_ref"],
            )
            observations.append(observe(
                observer,
                p,
                quality=0.62 + (i % 2) * 0.01,
                success=(i % 4 != 0),
                latency=130,
                cost=20,
                correction=(i % 4 == 0),
            ))

        # Route B: stronger observed utility despite worse static priority.
        for i in range(8):
            p = prepare(
                rt,
                task_id=f"train-b-{i}",
                profile=profiles["b"],
                memory_id=memories["b"],
                model_ref=mb["model_ref"],
            )
            observations.append(observe(
                observer,
                p,
                quality=0.95 - (i % 2) * 0.01,
                success=True,
                latency=110,
                cost=30,
            ))

        # Route C: superficially excellent but contains a governance breach.
        for i in range(4):
            p = prepare(
                rt,
                task_id=f"train-c-{i}",
                profile=profiles["c"],
                memory_id=memories["c"],
                model_ref=mc["model_ref"],
            )
            observations.append(observe(
                observer,
                p,
                quality=0.995,
                success=True,
                governance=(i == 0),
                latency=80,
                cost=10,
            ))

        observation_ids = [x["observation_id"] for x in observations]
        qualification, packet = source_artifacts(observation_ids)

        snapshot = learner.train_snapshot(
            qualification=qualification,
            p4_packet=packet,
            training_observation_ids=observation_ids,
            ridge_lambda=0.5,
            ucb_alpha=0.0,
            minimum_route_support=3,
        )

        case("A01 p4a-feature-schema-is-exactly-24-pre-route-features", lambda: (
            require(len(FEATURE_NAMES) == 24, "feature count drift"),
            require(snapshot["feature_schema"] == "p4a-pre-route-24-v0.1", "feature schema drift"),
        ))

        case("A02 synthetic-source-remains-structural-only", lambda: (
            require(snapshot["status"] == "STRUCTURAL_FIXTURE_CANDIDATE", "synthetic source promoted"),
            require(snapshot["empirical_source_gate_passed"] is False, "synthetic source became empirical"),
            require(snapshot["activation_allowed"] is False, "snapshot activated"),
        ))

        case("A03 exact-training-frontier-is-pinned", lambda:
            require(snapshot["training_observation_ids"] == sorted(observation_ids), "training provenance drift"))

        case("A04 learned-snapshot-has-static-rollback-parent", lambda: (
            require(snapshot["parent_snapshot_ref"] == "P1C_STATIC", "parent wrong"),
            require(snapshot["rollback_target_ref"] == "P1C_STATIC", "rollback target wrong"),
        ))

        route_c_key = learner.route_key("systems.analysis", profiles["c"], mc["model_ref"])
        case("A05 governance-breach-blocks-route-before-learned-selection", lambda: (
            require(route_c_key in snapshot["blocked_route_keys"], "breached route not blocked"),
            require(snapshot["route_support"][route_c_key] == 4, "breach support not recorded"),
        ))

        plan = learner.shadow_plan(
            snapshot,
            task_class="systems.analysis",
            task_tags=["systems", "feedback", "leverage"],
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[ma["model_ref"], mb["model_ref"], mc["model_ref"]],
            candidate_profile_refs=[profiles["a"], profiles["b"], profiles["c"]],
            max_profiles=3,
            max_routes=8,
        )

        case("A06 shadow-learner-can-prefer-better-observed-route", lambda:
            require(
                plan["shadow_selected_route"]["route_signature"]
                == learner.route_signature(profiles["b"], mb["model_ref"]),
                "better route not selected in shadow",
            ))

        case("A07 learned-plan-never-becomes-live", lambda: (
            require(plan["selection_is_live"] is False, "selection became live"),
            require(plan["live_router_remains"] == "P1C_STATIC", "live router changed"),
            require(plan["may_change_live_route"] is False, "route authority leaked"),
            require(plan["authority_granted"] is False, "authority leaked"),
        ))

        case("A08 genius-shortlist-and-route-shortlist-stay-bounded", lambda: (
            require(len(plan["profile_shortlist"]) <= 3, "profile shortlist expanded"),
            require(len(plan["route_candidates"]) <= 8, "route shortlist expanded"),
            require(all(x["activation_status"] == "SHADOW_ONLY_DORMANT" for x in plan["route_candidates"]), "Genius activated"),
        ))

        blocked_c = next(
            x for x in plan["route_candidates"]
            if x["profile_ref"] == profiles["c"] and x["model_ref"] == mc["model_ref"]
        )
        case("A09 breached-route-cannot-buy-selection-with-high-score", lambda: (
            require(blocked_c["blocked_by_non_tradable_breach"] is True, "breach flag missing"),
            require(blocked_c["learned_eligible"] is False, "breached route eligible"),
        ))

        # A changed exact model artifact is hard-eligible but starts with zero
        # exact-route support and cannot inherit route B's eligibility.
        mb2 = rt.register_model(model(
            "learned-better",
            priority=5,
            weights="sha256:learned-better-new-weights",
        ))
        plan_swap = learner.shadow_plan(
            snapshot,
            task_class="systems.analysis",
            task_tags=["systems", "feedback", "leverage"],
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[mb["model_ref"], mb2["model_ref"]],
            candidate_profile_refs=[profiles["b"]],
            max_profiles=1,
            max_routes=8,
        )
        new_candidate = next(
            x for x in plan_swap["route_candidates"]
            if x["model_ref"] == mb2["model_ref"]
        )
        case("A10 changed-model-artifact-starts-cold", lambda: (
            require(mb2["model_ref"] != mb["model_ref"], "model identity did not change"),
            require(new_candidate["training_support"] == 0, "new artifact inherited support"),
            require(new_candidate["learned_eligible"] is False, "new artifact became learned-eligible"),
        ))

        # Hard P1-C eligibility still dominates learned scores.
        rt.register_model(model("breached-highscore", priority=2, status="UNQUALIFIED"))
        plan_unq = learner.shadow_plan(
            snapshot,
            task_class="systems.analysis",
            task_tags=["systems", "feedback", "leverage"],
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[ma["model_ref"], mb["model_ref"], mc["model_ref"]],
            candidate_profile_refs=[profiles["a"], profiles["b"], profiles["c"]],
            max_profiles=3,
            max_routes=8,
        )
        case("A11 unqualified-model-never-reaches-learned-scorer", lambda:
            require(all(x["model_ref"] != mc["model_ref"] for x in plan_unq["route_candidates"]), "unqualified model reached scorer"))

        held = learner.shadow_plan(
            snapshot,
            task_class="systems.analysis",
            task_tags=["systems"],
            authority_status="STALE",
            required_capabilities=["reasoning", "text"],
        )
        denied = learner.shadow_plan(
            snapshot,
            task_class="systems.analysis",
            task_tags=["systems"],
            authority_status="DENIED",
            required_capabilities=["reasoning", "text"],
        )
        case("A12 stale-and-denied-authority-stop-before-shadow-scoring", lambda: (
            require(held["disposition"] == "HELD" and not held["route_candidates"], "stale authority scored"),
            require(denied["disposition"] == "DENIED" and not denied["route_candidates"], "denied authority scored"),
        ))

        unseen = learner.shadow_plan(
            snapshot,
            task_class="unseen.task",
            task_tags=["unknown"],
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            allowed_model_refs=[ma["model_ref"], mb["model_ref"]],
            candidate_profile_refs=[profiles["a"], profiles["b"]],
            max_profiles=2,
        )
        case("A13 unseen-task-class-abstains-instead-of-inventing-weights", lambda: (
            require(unseen["disposition"] == "NO_SUPPORTED_LEARNED_ROUTE", "unseen class invented route"),
            require(unseen["shadow_selected_route"] is None, "unseen class selected route"),
        ))

        snapshot2 = learner.train_snapshot(
            qualification=qualification,
            p4_packet=packet,
            training_observation_ids=observation_ids,
            ridge_lambda=0.5,
            ucb_alpha=0.0,
            minimum_route_support=3,
        )
        case("A14 identical-training-inputs-produce-identical-snapshot", lambda:
            require(snapshot2["snapshot_hash"] == snapshot["snapshot_hash"], "snapshot hash drift"))

        child = learner.train_snapshot(
            qualification=qualification,
            p4_packet=packet,
            training_observation_ids=observation_ids,
            parent_snapshot_ref=snapshot["snapshot_id"],
            ridge_lambda=0.5,
            ucb_alpha=0.0,
            minimum_route_support=3,
        )
        case("A15 candidate-snapshot-lineage-is-explicit-and-rollbackable", lambda: (
            require(child["snapshot_id"] != snapshot["snapshot_id"], "child snapshot identity did not change"),
            require(child["rollback_target_ref"] == snapshot["snapshot_id"], "child rollback target wrong"),
        ))

        bad_packet = copy.deepcopy(packet)
        bad_packet["source_qualification_hash"] = "sha256:mismatch"
        case("A16 qualification-packet-mismatch-fails-closed", lambda:
            expect(
                LearnerError,
                lambda: learner.train_snapshot(
                    qualification=qualification,
                    p4_packet=bad_packet,
                    training_observation_ids=observation_ids,
                ),
            ))

        outside_packet = copy.deepcopy(packet)
        outside_packet["source_observation_ids"] = observation_ids[:-1]
        case("A17 training-outside-p3-evidence-frontier-fails-closed", lambda:
            expect(
                LearnerError,
                lambda: learner.train_snapshot(
                    qualification=qualification,
                    p4_packet=outside_packet,
                    training_observation_ids=observation_ids,
                ),
            ))

        raw = json.dumps({"snapshot": snapshot, "plan": plan})
        case("A18 learned-artifacts-contain-no-memory-or-prompt-text", lambda: (
            require("secret-p4a-never-export" not in raw, "memory text leaked"),
            require("systems feedback leverage routing benchmark" not in raw, "query text leaked"),
        ))

        static_after = rt.plan_static_route(
            profile_ref=profiles["a"],
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[ma["model_ref"], mb["model_ref"]],
        )
        case("A19 training-and-shadow-planning-do-not-change-p1c-static-route", lambda:
            require(static_after["selected_model_ref"] == static_before["selected_model_ref"], "static route changed"))

        case("A20 p4a-has-no-activation-method", lambda:
            require(not hasattr(learner, "activate"), "P4-A unexpectedly exposes activation"))

        case("A21 feature-receipts-are-hashed-and-non-authoritative", lambda:
            require(all(
                (x["feature_receipt"] is None or x["feature_receipt"].startswith("p4feat_"))
                and x["authority"] == "NONE"
                for x in plan["route_candidates"]
            ), "feature receipt or authority invalid"))

        case("A22 learned-parameters-remain-versioned-shadow-evidence", lambda: (
            require(bool(snapshot["task_class_models"]["systems.analysis"]["theta"]), "theta missing"),
            require(snapshot["automatic_activation_forbidden"] is True, "automatic activation allowed"),
            require(snapshot["may_grant_authority"] is False, "snapshot may grant authority"),
        ))

        store.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
