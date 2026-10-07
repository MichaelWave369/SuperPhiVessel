from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

from dlam_store import DlamStore
from p1c_runtime import CheckpointError, NoEligibleRouteError, P1CRuntime

ROOT = Path(__file__).resolve().parents[2]
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
        return f"2026-10-07T18:00:{self.i:02d}Z"


def tok_a(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def tok_b(text: str) -> int:
    # Deliberately different exact tokenizer fixture to prove recomposition.
    return sum(1 if ch.isspace() else 2 for ch in text)


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


def model(name, *, tokenizer, priority, status="QUALIFIED", locality="LOCAL",
          caps=None, context_window=32768, max_vram_mb=4096,
          quantization="Q4_K_M", template="sha256:template-a",
          weights=None):
    return {
        "name": name,
        "provider": "fixture",
        "runtime": "fixture-runtime",
        "runtime_version": "1.0",
        "weights_digest": weights or f"sha256:weights-{name}",
        "quantization": quantization,
        "adapter_digest": None,
        "prompt_template_digest": template,
        "tokenizer_id": tokenizer,
        "context_window": context_window,
        "capabilities": caps or ["reasoning", "text", "tools"],
        "locality": locality,
        "priority": priority,
        "max_vram_mb": max_vram_mb,
        "status": status,
    }


def prepare(rt, **kw):
    return rt.prepare_task(
        task_id=kw.pop("task_id", "task-turing-1"),
        query=kw.pop("query", "computability continuity theorem"),
        profile_ref=kw.pop("profile_ref", "ga108:032"),
        agent_id=kw.pop("agent_id", "vessie"),
        recipe_ref=kw.pop("recipe_ref", "recipe:analysis:v1"),
        purpose=kw.pop("purpose", "analysis"),
        target_surface=kw.pop("target_surface", "local_model"),
        policy_epoch=kw.pop("policy_epoch", 11),
        authority_decision_ref=kw.pop("authority_decision_ref", "auth:p1c:11"),
        authority_status=kw.pop("authority_status", "CURRENT"),
        memory_budget_tokens=kw.pop("memory_budget_tokens", 10000),
        required_capabilities=kw.pop("required_capabilities", ["reasoning", "text"]),
        preferred_capabilities=kw.pop("preferred_capabilities", ["tools"]),
        local_only=kw.pop("local_only", True),
        minimum_context_tokens=kw.pop("minimum_context_tokens", 4096),
        max_vram_mb=kw.pop("max_vram_mb", 8192),
        required_memory_ids=kw.pop("required_memory_ids", ["anchor"]),
        **kw,
    )


def main():
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "memory.db"
        store = DlamStore(db, clock=FixedClock())
        store.admit(capsule("anchor", "computability continuity theorem anchor"))

        rt = P1CRuntime(store, genius_roster_path=ROSTER)
        rt.register_tokenizer("fixture-a", tok_a)
        rt.register_tokenizer("fixture-b", tok_b)

        case("C01 canonical-ga108-profile", lambda: (
            require(rt.genius_profiles["ga108:032"]["label"] == "Alan Turing", "wrong profile"),
            require(rt.genius_profiles["ga108:032"]["authority"] == "NONE", "profile authority"),
            require(rt.genius_profiles["ga108:032"]["modelBinding"] is None, "fixed model binding"),
        ))

        a = rt.register_model(model("alpha", tokenizer="fixture-a", priority=10))
        a2 = rt.register_model(model("alpha", tokenizer="fixture-a", priority=10))
        case("C02 exact-model-identity-idempotent", lambda:
            require(a["model_ref"] == a2["model_ref"], "same artifact changed identity"))

        a_quant = rt.register_model(model(
            "alpha",
            tokenizer="fixture-a",
            priority=10,
            quantization="Q8_0",
        ))
        case("C03 quantization-change-new-identity", lambda:
            require(a_quant["model_ref"] != a["model_ref"], "quantization reused identity"))

        a_template = rt.register_model(model(
            "alpha",
            tokenizer="fixture-a",
            priority=10,
            template="sha256:template-b",
        ))
        case("C04-template-change-new-identity", lambda:
            require(a_template["model_ref"] != a["model_ref"], "template reused identity"))

        b = rt.register_model(model("beta", tokenizer="fixture-b", priority=20))
        unq = rt.register_model(model(
            "unqualified",
            tokenizer="fixture-a",
            priority=0,
            status="UNQUALIFIED",
        ))
        remote = rt.register_model(model(
            "remote",
            tokenizer="fixture-a",
            priority=0,
            locality="REMOTE",
        ))
        weak = rt.register_model(model(
            "weak",
            tokenizer="fixture-a",
            priority=0,
            caps=["text"],
        ))
        huge = rt.register_model(model(
            "huge",
            tokenizer="fixture-a",
            priority=0,
            max_vram_mb=24000,
        ))

        plan = rt.plan_static_route(
            profile_ref="ga108:032",
            authority_status="CURRENT",
            required_capabilities=["reasoning", "text"],
            preferred_capabilities=["tools"],
            local_only=True,
            minimum_context_tokens=4096,
            max_vram_mb=8192,
            allowed_model_refs=[a["model_ref"], b["model_ref"], unq["model_ref"], remote["model_ref"], weak["model_ref"], huge["model_ref"]],
        )
        case("C05 static-route-selects-qualified-priority", lambda:
            require(plan["selected_model_ref"] == a["model_ref"], "wrong model selected"))

        excluded = {x["model_ref"]: x["reasons"] for x in plan["excluded_candidates"]}
        case("C06 hard-eligibility-exclusions", lambda: (
            require("MODEL_NOT_QUALIFIED" in excluded[unq["model_ref"]], "unqualified not excluded"),
            require("REMOTE_NOT_ALLOWED" in excluded[remote["model_ref"]], "remote not excluded"),
            require(any(x.startswith("MISSING_CAPABILITIES") for x in excluded[weak["model_ref"]]), "capability miss not excluded"),
            require("VRAM_BUDGET_EXCEEDED" in excluded[huge["model_ref"]], "VRAM miss not excluded"),
        ))

        prepared_a = prepare(
            rt,
            allowed_model_refs=[a["model_ref"], b["model_ref"]],
        )
        case("C07 prepare-task-ready", lambda: (
            require(prepared_a["disposition"] == "READY", "not READY"),
            require(prepared_a["model_ref"] == a["model_ref"], "wrong selected model"),
            require(prepared_a["packet"]["model_ref"] == a["model_ref"], "packet/model mismatch"),
        ))

        receipt = prepared_a["route_receipt"]
        case("C08 route-receipt-p0-compatible-fields", lambda: (
            require(receipt["schema_version"] == "1", "schema version"),
            require(receipt["profile_ref"] == "ga108:032", "profile mismatch"),
            require(receipt["selection_probability"] == 1.0, "not deterministic"),
            require(receipt["authority_granted"] is False, "authority leak"),
            require(receipt["context_manifest_ref"], "context ref absent"),
            require(receipt["router_snapshot_ref"].startswith("static:"), "router snapshot missing"),
        ))

        case("C09 selected-model-tokenizer-bound", lambda:
            require(prepared_a["packet"]["tokenizer_id"] == "fixture-a", "wrong tokenizer"))

        c1 = rt.checkpoint_task(
            prepared_a,
            work_state={"step": 3, "notes": ["formalize theorem"], "artifact_refs": ["mem:anchor"]},
            status="PAUSED_FOR_SWAP",
        )
        case("C10 checkpoint-stable-genius-and-frontiers", lambda: (
            require(c1["profile_ref"] == "ga108:032", "profile drift"),
            require(c1["memory_namespace"] == "genius.ga108.032", "namespace drift"),
            require(c1["opaque_state_transferred"] is False, "opaque state marked transferred"),
            require(c1["context_packet_hash"] == prepared_a["packet"]["packet_hash"], "packet hash lost"),
        ))

        def forbid_hidden_state():
            try:
                rt.checkpoint_task(
                    prepared_a,
                    work_state={"hidden_state": [1, 2, 3]},
                    status="PAUSED",
                )
            except CheckpointError:
                return
            raise AssertionError("hidden state was accepted")

        case("C11 opaque-model-state-rejected", forbid_hidden_state)

        outcome_a = rt.record_outcome(
            receipt["decision_id"],
            success=True,
            latency_ms=123,
        )
        case("C12 attributable-outcome-recorded", lambda: (
            require(outcome_a["model_ref"] == a["model_ref"], "outcome model mismatch"),
            require(rt.model_observation_count(a["model_ref"]) == 1, "observation count wrong"),
        ))

        swap = rt.swap_model(c1["checkpoint_id"], replacement_model_ref=b["model_ref"])
        pb = swap["prepared"]
        c2 = swap["checkpoint"]
        case("C13 swap-preserves-task-and-genius", lambda: (
            require(c2["task_id"] == c1["task_id"], "task changed"),
            require(c2["profile_ref"] == c1["profile_ref"], "Genius changed"),
            require(c2["memory_namespace"] == c1["memory_namespace"], "namespace changed"),
        ))

        case("C14 swap-changes-exact-model-and-tokenizer", lambda: (
            require(pb["model_ref"] == b["model_ref"], "replacement not selected"),
            require(pb["packet"]["tokenizer_id"] == "fixture-b", "replacement tokenizer not used"),
            require(c2["model_ref"] == b["model_ref"], "checkpoint model not updated"),
        ))

        case("C15 swap-recomposes-context", lambda: (
            require(pb["packet"]["packet_hash"] != prepared_a["packet"]["packet_hash"], "old packet reused"),
            require(c2["context_packet_hash"] == pb["packet"]["packet_hash"], "new packet not checkpointed"),
        ))

        case("C16 changed-model-starts-cold", lambda: (
            require(receipt["prior_observations"] == 0, "alpha should start cold"),
            require(pb["route_receipt"]["prior_observations"] == 0, "beta inherited alpha stats"),
            require(rt.model_observation_count(b["model_ref"]) == 0, "beta observation count nonzero"),
            require(pb["route_receipt"]["routing_stats_key"] != receipt["routing_stats_key"], "stats key reused"),
        ))

        case("C17 work-state-survives-swap-without-model-state", lambda: (
            require(c2["work_state"] == c1["work_state"], "work state lost"),
            require(c2["opaque_state_transferred"] is False, "opaque state transfer"),
            require(c2["previous_checkpoint_ref"] == c1["checkpoint_id"], "checkpoint chain lost"),
        ))

        stale = prepare(rt, authority_status="STALE")
        denied = prepare(rt, authority_status="DENIED")
        case("C18 stale-and-denied-route-before-model-exposure", lambda: (
            require(stale["disposition"] == "HELD", "stale not held"),
            require(stale["packet"] is None, "stale packet exists"),
            require(denied["disposition"] == "DENIED", "denied not denied"),
            require(denied["packet"] is None, "denied packet exists"),
        ))

        blocked = prepare(
            rt,
            allowed_model_refs=[weak["model_ref"]],
            required_capabilities=["reasoning", "text"],
        )
        case("C19 no-eligible-model-fails-closed", lambda: (
            require(blocked["disposition"] == "BLOCKED", "route did not block"),
            require(blocked["route_receipt"] is None, "receipt minted without selection"),
        ))

        def reject_unqualified_swap():
            try:
                rt.swap_model(c1["checkpoint_id"], replacement_model_ref=unq["model_ref"])
            except NoEligibleRouteError:
                return
            raise AssertionError("unqualified replacement resumed task")

        case("C20 unqualified-swap-fails-closed", reject_unqualified_swap)

        checkpoint_id = c2["checkpoint_id"]
        model_b_ref = b["model_ref"]
        store.close()

        store2 = DlamStore(db, clock=FixedClock())
        rt2 = P1CRuntime(store2, genius_roster_path=ROSTER)
        rt2.register_tokenizer("fixture-a", tok_a)
        rt2.register_tokenizer("fixture-b", tok_b)
        recovered = rt2.get_checkpoint(checkpoint_id)
        case("C21 checkpoint-survives-cold-restart", lambda: (
            require(recovered["model_ref"] == model_b_ref, "model identity lost"),
            require(recovered["profile_ref"] == "ga108:032", "profile identity lost"),
            require(recovered["work_state"]["step"] == 3, "task state lost"),
        ))

        # Re-running the same prepared inputs after restart creates the same route
        # receipt identity because exact model/profile/context/policy are pinned.
        resumed_same = prepare(
            rt2,
            allowed_model_refs=[model_b_ref],
        )
        case("C22 deterministic-route-receipt-after-restart", lambda:
            require(
                resumed_same["route_receipt"]["decision_id"] == pb["route_receipt"]["decision_id"],
                "route receipt changed under identical inputs",
            ))
        store2.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
