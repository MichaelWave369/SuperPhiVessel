from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

from context_composer import ContextComposer
from dlam_store import DlamStore

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
        return f"2026-10-07T17:00:{self.i:02d}Z"


def fixture_token_counter(text: str) -> int:
    # Deterministic acceptance tokenizer only. Production adapters must supply
    # the exact tokenizer for the selected model artifact.
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def capsule(mid, content, **kw):
    return {
        "memory_id": mid,
        "namespace_id": kw.pop("namespace_id", "genius.ga108.001"),
        "agent_id": kw.pop("agent_id", "vessie"),
        "genius_id": kw.pop("genius_id", "ga108:001"),
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


def request(composer, query, **kw):
    return composer.compose(
        query,
        task_id=kw.pop("task_id", "task-1"),
        namespace_id=kw.pop("namespace_id", "genius.ga108.001"),
        agent_id=kw.pop("agent_id", "vessie"),
        genius_profile_ref=kw.pop("genius_profile_ref", "ga108:001"),
        model_ref=kw.pop("model_ref", "fixture-model@1"),
        purpose=kw.pop("purpose", "analysis"),
        target_surface=kw.pop("target_surface", "local_model"),
        policy_epoch=kw.pop("policy_epoch", 7),
        authority_decision_ref=kw.pop("authority_decision_ref", "auth:fixture:7"),
        authority_status=kw.pop("authority_status", "CURRENT"),
        memory_budget_tokens=kw.pop("memory_budget_tokens", 10000),
        **kw,
    )


def main():
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "memory.db"
        store = DlamStore(db, clock=FixedClock())
        composer = ContextComposer(
            store,
            tokenizer_id="fixture-regex-v1",
            token_counter=fixture_token_counter,
        )

        store.admit(capsule("anchor", "alpha continuity anchor"))
        p = request(composer, "alpha continuity")
        case("B01 ready-packet", lambda: (
            require(p["disposition"] == "READY", "not READY"),
            require([x["memory_id"] for x in p["items"]] == ["anchor"], "wrong memory"),
        ))

        case("B02 packet-never-grants-authority", lambda:
            require(p["action_authority"] == "NONE", "authority leak"))

        store.admit(capsule(
            "private",
            "violet secret orchard",
            allowed_targets=["private_surface"],
            allowed_purposes=["private_analysis"],
        ))
        denied = request(composer, "violet secret")
        case("B03 purpose-target-filter-before-packet", lambda: (
            require(denied["disposition"] == "INSUFFICIENT", "forbidden memory activated"),
            require("violet secret orchard" not in json.dumps(denied), "forbidden plaintext leaked"),
        ))

        store.admit(capsule("dream", "silver impossible tower", origin="DREAMED"))
        origin_filtered = request(
            composer,
            "silver impossible",
            allowed_origins={"OBSERVED", "VERIFIED"},
        )
        case("B04 epistemic-origin-admission", lambda:
            require(origin_filtered["disposition"] == "INSUFFICIENT", "DREAMED content crossed filter"))

        store.admit(capsule("claimA", "reactor balance stable"))
        store.admit(capsule("claimB", "reactor balance unstable", conflict_refs=["claimA"]))
        pair = request(composer, "reactor balance")
        pair_ids = {x["memory_id"] for x in pair["items"]}
        case("B05 contradictions-travel-together", lambda:
            require({"claimA", "claimB"}.issubset(pair_ids), "contradiction pair split"))

        store.admit(capsule(
            "hiddenClaim",
            "private pressure contradiction",
            allowed_targets=["private_surface"],
            allowed_purposes=["analysis"],
        ))
        store.admit(capsule(
            "publicClaim",
            "pressure reading acceptable",
            conflict_refs=["hiddenClaim"],
        ))
        blocked_pair = request(composer, "pressure reading")
        case("B06 inaccessible-contradiction-fails-closed", lambda: (
            require(blocked_pair["disposition"] == "INSUFFICIENT", "orphan claim activated"),
            require("private pressure contradiction" not in json.dumps(blocked_pair), "companion plaintext leaked"),
        ))

        store.admit(capsule("evidence", "sensor frame ninety seven"))
        store.admit(capsule(
            "derived",
            "derived sensor conclusion",
            origin="INFERRED",
            derivation_parents=["evidence"],
        ))
        prov = request(composer, "derived sensor")
        prov_ids = {x["memory_id"] for x in prov["items"]}
        case("B07 provenance-expands-with-derived-memory", lambda:
            require({"derived", "evidence"}.issubset(prov_ids), "provenance parent absent"))

        store.admit(capsule("deleteSource", "obsolete cobalt source"))
        store.admit(capsule(
            "deleteChild",
            "obsolete cobalt summary",
            origin="INFERRED",
            derivation_parents=["deleteSource"],
        ))
        store.forget("deleteSource", reason="operator deletion", actor="operator")
        deleted = request(composer, "obsolete cobalt")
        case("B08 tombstoned-source-and-derived-never-enter-packet", lambda:
            require(deleted["disposition"] == "INSUFFICIENT", "deleted memory entered packet"))

        rich = request(
            composer,
            "derived sensor",
            required_memory_ids=["derived"],
            memory_budget_tokens=10000,
        )
        exact_budget = rich["used_memory_tokens"]
        fit = request(
            composer,
            "derived sensor",
            required_memory_ids=["derived"],
            memory_budget_tokens=exact_budget,
        )
        case("B09 exact-budget-seam", lambda: (
            require(fit["disposition"] == "READY", "exact budget should fit"),
            require(fit["used_memory_tokens"] == exact_budget, "budget accounting drift"),
        ))

        too_small = request(
            composer,
            "derived sensor",
            required_memory_ids=["derived"],
            memory_budget_tokens=max(0, exact_budget - 1),
        )
        case("B10 required-context-over-budget-is-insufficient", lambda: (
            require(too_small["disposition"] == "INSUFFICIENT", "partial required packet emitted"),
            require(too_small["items"] == [], "partial required content leaked"),
        ))

        missing = request(
            composer,
            "alpha continuity",
            required_memory_ids=["does-not-exist"],
        )
        case("B11 missing-required-memory-is-insufficient", lambda:
            require(missing["disposition"] == "INSUFFICIENT", "missing required memory ignored"))

        stale = request(composer, "alpha continuity", authority_status="STALE")
        case("B12 stale-authority-holds-before-retrieval", lambda: (
            require(stale["disposition"] == "HELD", "stale authority not held"),
            require(stale["items"] == [], "memory exposed under stale authority"),
        ))

        no_auth = request(composer, "alpha continuity", authority_status="DENIED")
        case("B13 denied-authority-denies-packet", lambda: (
            require(no_auth["disposition"] == "DENIED", "denial ignored"),
            require(no_auth["items"] == [], "memory exposed after denial"),
        ))

        d1 = request(composer, "alpha continuity")
        d2 = request(composer, "alpha continuity")
        case("B14 deterministic-packet-hash", lambda:
            require(d1["packet_hash"] == d2["packet_hash"], "packet hash drift"))

        swapped = request(composer, "alpha continuity", model_ref="fixture-model@2")
        case("B15 model-swap-recomposes-with-stable-genius", lambda: (
            require(swapped["genius_profile_ref"] == d1["genius_profile_ref"], "Genius identity changed"),
            require(swapped["packet_hash"] != d1["packet_hash"], "model-specific packet was reused"),
        ))

        none = request(composer, "words-not-present-anywhere")
        case("B16 empty-retrieval-is-insufficient-not-fabricated", lambda: (
            require(none["disposition"] == "INSUFFICIENT", "empty result looked successful"),
            require(none["items"] == [], "fabricated context"),
        ))

        first_hash = request(composer, "alpha continuity")["packet_hash"]
        store.close()
        store2 = DlamStore(db, clock=FixedClock())
        composer2 = ContextComposer(
            store2,
            tokenizer_id="fixture-regex-v1",
            token_counter=fixture_token_counter,
        )
        restart_hash = request(composer2, "alpha continuity")["packet_hash"]
        case("B17 cold-restart-recomposes-same-packet", lambda:
            require(first_hash == restart_hash, "restart changed packet without state change"))
        store2.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
