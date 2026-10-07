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
        return f"2026-10-07T20:00:{self.i % 60:02d}Z"


def tok(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def capsule(mid, namespace, genius, content):
    return {
        "memory_id": mid,
        "namespace_id": namespace,
        "agent_id": "vessie",
        "genius_id": genius,
        "kind": "fact",
        "content": content,
        "origin": "OBSERVED",
        "source_status": "CAPTURED",
        "sensitivity": "LOCAL",
        "allowed_targets": ["local_model"],
        "allowed_purposes": ["analysis"],
        "retention_rule": "retain_until_tombstoned",
    }


def model(name, *, priority, tokenizer="fixture-tokenizer", quantization="Q4"):
    return {
        "name": name,
        "provider": "fixture",
        "runtime": "fixture-runtime",
        "runtime_version": "1",
        "weights_digest": f"sha256:{name}-weights",
        "quantization": quantization,
        "adapter_digest": None,
        "prompt_template_digest": f"sha256:{name}-template",
        "tokenizer_id": tokenizer,
        "context_window": 32768,
        "capabilities": ["reasoning", "text", "tools", "frontier"],
        "locality": "LOCAL",
        "priority": priority,
        "max_vram_mb": 4096,
        "status": "QUALIFIED",
    }


def prepare(rt, *, task_id, profile_ref, memory_id, query, model_refs):
    profile = rt.genius_profiles[profile_ref]
    return rt.prepare_task(
        task_id=task_id,
        query=query,
        profile_ref=profile_ref,
        agent_id="vessie",
        recipe_ref="recipe:p3a:v1",
        purpose="analysis",
        target_surface="local_model",
        policy_epoch=30,
        authority_decision_ref="auth:p3a:30",
        authority_status="CURRENT",
        memory_budget_tokens=10000,
        required_capabilities=["reasoning", "text"],
        preferred_capabilities=["tools"],
        local_only=True,
        minimum_context_tokens=4096,
        max_vram_mb=8192,
        allowed_model_refs=model_refs,
        required_memory_ids=[memory_id],
    )


def obs(observer, prepared, *, task_class, confidence, success, quality,
        source, tags, sfr_decision_id=None, governance=False, critical=False,
        correction=False, latency=100, tokens=400, cost=0):
    return observer.record_observation(
        route_decision_id=prepared["route_receipt"]["decision_id"],
        task_class=task_class,
        success=success,
        quality_score=quality,
        predicted_confidence=confidence,
        evidence_satisfied=True,
        governance_violation=governance,
        critical_miss=critical,
        user_correction=correction,
        latency_ms=latency,
        context_tokens=tokens,
        estimated_cost_micros=cost,
        outcome_source_refs=[source],
        task_tags=tags,
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


def main():
    with tempfile.TemporaryDirectory() as td:
        store = DlamStore(Path(td) / "p3.db", clock=FixedClock())
        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-tokenizer", tok)
        model_a = rt.register_model(model("local-a", priority=1))
        model_b = rt.register_model(model("local-b", priority=2, quantization="Q8"))

        # Four logical Genius namespaces; the scorecard must still represent all 108.
        fixtures = [
            ("ga108:032", "genius.ga108.032", "turing-1", "computability formal algorithm proof"),
            ("ga108:032", "genius.ga108.032", "turing-2", "formal machine reasoning invariant"),
            ("ga108:032", "genius.ga108.032", "turing-3", "symbolic computation decision procedure"),
            ("ga108:032", "genius.ga108.032", "turing-4", "formal algorithm counterexample"),
            ("ga108:104", "genius.ga108.104", "meadows-1", "feedback leverage systems dynamics"),
            ("ga108:104", "genius.ga108.104", "meadows-2", "feedback loop intervention"),
            ("ga108:104", "genius.ga108.104", "meadows-3", "systems leverage consequence"),
            ("ga108:108", "genius.ga108.108", "wayfind-1", "navigation environmental cues"),
        ]
        for profile, ns, mid, content in fixtures:
            store.admit(capsule(mid, ns, profile, content))

        observer = RoutingObservatory(rt)
        sfr = SparseFrontierRouter(rt)

        case("P301 full-ga108-roster-loaded", lambda:
            require(len(observer.genius_profiles) == 108, "roster not complete"))

        static_before = rt.plan_static_route(
            profile_ref="ga108:032",
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[model_a["model_ref"], model_b["model_ref"]],
        )

        t1 = prepare(
            rt, task_id="formal-1", profile_ref="ga108:032",
            memory_id="turing-1", query="computability formal",
            model_refs=[model_a["model_ref"]],
        )

        sfr_decision = sfr.assess({
            "candidate_id": "p3-sfr-1",
            "task_id": "formal-1",
            "cheap_prediction": {"decision": "local-proof"},
            "cheap_confidence": 0.55,
            "cheap_model_ref": model_a["model_ref"],
            "cheap_route_decision_id": t1["route_receipt"]["decision_id"],
            "memory_refs": ["turing-1"],
            "evidence_refs": ["evidence:formal:1"],
            "state_changes": [{"kind": "contradiction_detected"}],
            "task_tags": ["formal", "computation", "uncertainty"],
            "signals": sfr_signals(
                consequence=0.90,
                irreversible_risk=0.90,
                disagreement=0.60,
                routing_confidence=0.50,
            ),
            "authority_decision_ref": "auth:p3a:30",
            "authority_status": "CURRENT",
            "frontier_token_budget": 1400,
        })
        sfr.record_outcome(
            sfr_decision["decision_id"],
            frontier_model_ref=model_b["model_ref"],
            genius_profile_refs=["ga108:032"],
            frontier_conclusion_ref="evidence:frontier:formal-1",
            changed_decision=True,
            discovered_missing_evidence=True,
            caught_critical_issue=False,
            critical_issue_present=False,
            eventual_success=True,
            governance_violation=False,
            latency_ms=600,
            context_tokens=700,
            estimated_cost_micros=500,
        )

        o1 = obs(
            observer, t1, task_class="formal.reasoning",
            confidence=0.55, success=True, quality=0.94,
            source="verifier:formal-1", tags=["formal", "computation"],
            sfr_decision_id=sfr_decision["decision_id"],
            latency=120, tokens=500,
        )
        case("P302 route-outcome-is-anchored-and-shadow-only", lambda: (
            require(o1["profile_ref"] == "ga108:032", "wrong Genius"),
            require(o1["model_ref"] == model_a["model_ref"], "wrong model"),
            require(o1["sfr"]["frontier_useful"] is True, "SFR usefulness not joined"),
            require(o1["may_change_live_route"] is False, "observation changed live routing"),
            require(o1["authority_granted"] is False, "observation granted authority"),
        ))

        case("P303 calibration-brier-is-explicit", lambda:
            require(abs(o1["brier_score"] - ((0.55 - 1.0) ** 2)) < 1e-12, "Brier mismatch"))

        same = obs(
            observer, t1, task_class="formal.reasoning",
            confidence=0.55, success=True, quality=0.94,
            source="verifier:formal-1", tags=["formal", "computation"],
            sfr_decision_id=sfr_decision["decision_id"],
            latency=120, tokens=500,
        )
        case("P304 identical-final-observation-is-idempotent", lambda:
            require(same["observation_id"] == o1["observation_id"], "idempotency failed"))

        case("P305 finalized-observation-cannot-be-rewritten", lambda:
            expect(ValidationError, lambda: obs(
                observer, t1, task_class="formal.reasoning",
                confidence=0.55, success=False, quality=0.10,
                source="verifier:changed", tags=["formal"],
                sfr_decision_id=sfr_decision["decision_id"],
            )))

        t2 = prepare(rt, task_id="formal-2", profile_ref="ga108:032", memory_id="turing-2",
                     query="formal machine invariant", model_refs=[model_a["model_ref"]])
        t3 = prepare(rt, task_id="formal-3", profile_ref="ga108:032", memory_id="turing-3",
                     query="symbolic computation", model_refs=[model_a["model_ref"]])
        t4 = prepare(rt, task_id="formal-4", profile_ref="ga108:032", memory_id="turing-4",
                     query="algorithm counterexample", model_refs=[model_b["model_ref"]])
        obs(observer, t2, task_class="formal.reasoning", confidence=0.80, success=True, quality=0.90,
            source="verifier:formal-2", tags=["formal", "algorithm"], latency=95, tokens=420)
        obs(observer, t3, task_class="formal.reasoning", confidence=0.72, success=True, quality=0.88,
            source="verifier:formal-3", tags=["formal", "computation"], latency=90, tokens=390)
        obs(observer, t4, task_class="formal.reasoning", confidence=0.70, success=False, quality=0.45,
            source="verifier:formal-4", tags=["formal", "algorithm"], correction=True, latency=130, tokens=510)

        m1 = prepare(rt, task_id="systems-1", profile_ref="ga108:104", memory_id="meadows-1",
                     query="systems leverage feedback", model_refs=[model_a["model_ref"]])
        m2 = prepare(rt, task_id="systems-2", profile_ref="ga108:104", memory_id="meadows-2",
                     query="feedback loop intervention", model_refs=[model_a["model_ref"]])
        m3 = prepare(rt, task_id="systems-3", profile_ref="ga108:104", memory_id="meadows-3",
                     query="systems consequence", model_refs=[model_a["model_ref"]])
        obs(observer, m1, task_class="systems.analysis", confidence=0.90, success=True, quality=0.99,
            source="verifier:systems-1", tags=["systems", "feedback", "leverage"])
        obs(observer, m2, task_class="systems.analysis", confidence=0.90, success=True, quality=0.98,
            source="verifier:systems-2", tags=["systems", "feedback", "leverage"])
        obs(observer, m3, task_class="systems.analysis", confidence=0.95, success=True, quality=1.0,
            source="verifier:systems-3", tags=["systems", "feedback", "leverage"],
            governance=True)

        w1 = prepare(rt, task_id="navigation-1", profile_ref="ga108:108", memory_id="wayfind-1",
                     query="navigation environmental cues", model_refs=[model_a["model_ref"]])
        obs(observer, w1, task_class="navigation", confidence=0.76, success=True, quality=0.91,
            source="verifier:navigation-1", tags=["navigation", "environmental", "cues"])

        snapshot = observer.scorecard_snapshot()
        case("P306 scorecard-always-covers-all-108-geniuses", lambda: (
            require(snapshot["roster_size"] == 108, "roster size wrong"),
            require(len(snapshot["geniuses"]) == 108, "scorecard missing Geniuses"),
        ))

        case("P307 dormant-geniuses-do-not-receive-invented-performance", lambda: (
            require(snapshot["geniuses"]["ga108:001"]["evidence_status"] == "DORMANT_NO_EVIDENCE", "dormant status wrong"),
            require(snapshot["geniuses"]["ga108:001"]["success_rate"] is None, "invented success rate"),
            require(snapshot["geniuses"]["ga108:001"]["observations"] == 0, "invented observations"),
        ))

        turing_card = snapshot["geniuses"]["ga108:032"]
        case("P308 genius-history-separates-exact-model-identities", lambda: (
            require(turing_card["observations"] == 4, "Turing observation count wrong"),
            require(len(turing_card["models_observed"]) == 2, "model identities collapsed"),
            require(model_a["model_ref"] in turing_card["models_observed"], "model A absent"),
            require(model_b["model_ref"] in turing_card["models_observed"], "model B absent"),
        ))

        case("P309 task-class-performance-and-calibration-are-inspectable", lambda: (
            require("formal.reasoning" in snapshot["task_classes"], "task class missing"),
            require(snapshot["task_classes"]["formal.reasoning"]["mean_brier"] is not None, "calibration missing"),
            require(snapshot["task_classes"]["formal.reasoning"]["successes"] == 3, "task successes wrong"),
        ))

        case("P310 non-tradable-governance-breach-is-not-averaged-away", lambda: (
            require(snapshot["geniuses"]["ga108:104"]["governance_violations"] == 1, "violation missing"),
            require(snapshot["geniuses"]["ga108:104"]["non_tradable_breach"] is True, "breach flag missing"),
        ))

        case("P311 sfr-usefulness-joins-without-changing-thresholds", lambda: (
            require(snapshot["sfr_shadow"]["completed_frontier_investigations"] == 1, "frontier count wrong"),
            require(snapshot["sfr_shadow"]["useful_frontier_investigations"] == 1, "useful frontier count wrong"),
            require(snapshot["may_change_live_thresholds"] is False, "threshold authority leaked"),
        ))

        case("P312 snapshot-pins-exact-source-observation-provenance", lambda: (
            require(o1["observation_id"] in snapshot["source_observation_ids"], "source observation absent"),
            require(snapshot["snapshot_hash"], "snapshot hash absent"),
            require(snapshot["learned_weights"] is None, "weights should not exist in P3-A"),
        ))

        raw_snapshot = json.dumps(snapshot)
        case("P313 observatory-does-not-copy-memory-or-prompt-text", lambda: (
            require("computability formal algorithm proof" not in raw_snapshot, "memory text leaked"),
            require("formal machine invariant" not in raw_snapshot, "query/memory prose leaked"),
        ))

        static_after = rt.plan_static_route(
            profile_ref="ga108:032",
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[model_a["model_ref"], model_b["model_ref"]],
        )
        case("P314 p3-observations-do-not-change-live-static-route", lambda:
            require(static_after["selected_model_ref"] == static_before["selected_model_ref"], "live route changed"))

        rank_formal = observer.shadow_roster_rank(
            task_class="formal.reasoning",
            task_tags=["formal", "algorithm", "computation"],
            limit=8,
            minimum_observations=3,
        )
        case("P315 shadow-ranking-remains-dormant-and-non-authoritative", lambda: (
            require(rank_formal["ranking_is_live"] is False, "ranking became live"),
            require(rank_formal["may_activate_genius"] is False, "ranking activated Genius"),
            require(rank_formal["authority_granted"] is False, "ranking granted authority"),
            require(all(x["activation_status"] == "SHADOW_ONLY_DORMANT" for x in rank_formal["candidates"]), "candidate activated"),
        ))

        case("P316 observed-qualified-profile-can-surface-in-shadow", lambda:
            require(any(x["profile_ref"] == "ga108:032" and x["evidence_sufficient"] for x in rank_formal["candidates"]), "Turing evidence not surfaced"))

        rank_systems = observer.shadow_roster_rank(
            task_class="systems.analysis",
            task_tags=["systems", "feedback", "leverage"],
            limit=8,
            minimum_observations=3,
        )
        meadows = next(x for x in rank_systems["candidates"] if x["profile_ref"] == "ga108:104")
        case("P317 governance-breach-remains-visible-in-shadow-ranking", lambda: (
            require(meadows["evidence_sufficient"] is True, "Meadows evidence missing"),
            require(meadows["non_tradable_breach"] is True, "breach disappeared"),
        ))

        case("P318 outcome-evidence-reference-is-required", lambda:
            expect(ValidationError, lambda: observer.record_observation(
                route_decision_id=w1["route_receipt"]["decision_id"],
                task_class="navigation",
                success=True,
                quality_score=0.9,
                predicted_confidence=0.8,
                evidence_satisfied=True,
                governance_violation=False,
                critical_miss=False,
                user_correction=False,
                latency_ms=10,
                context_tokens=100,
                estimated_cost_micros=0,
                outcome_source_refs=[],
                task_tags=["navigation"],
            )))

        case("P319 invalid-task-taxonomy-fails-closed", lambda:
            expect(ValidationError, lambda: observer.shadow_roster_rank(
                task_class="Formal Reasoning With Spaces",
                task_tags=["formal"],
            )))

        snapshot2 = observer.scorecard_snapshot()
        case("P320 scorecard-hash-is-deterministic", lambda:
            require(snapshot2["snapshot_hash"] == snapshot["snapshot_hash"], "snapshot hash drift"))

        store.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
