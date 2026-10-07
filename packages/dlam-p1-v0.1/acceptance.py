from __future__ import annotations

import tempfile
from pathlib import Path

from dlam_store import DlamStore, MemoryConflictError

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
        return f"2026-10-07T16:30:{self.i:02d}Z"


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
        "allowed_targets": kw.pop("allowed_targets", ["local_operator"]),
        "allowed_purposes": kw.pop("allowed_purposes", ["analysis"]),
        "retention_rule": kw.pop("retention_rule", "retain_until_tombstoned"),
        **kw,
    }


def main():
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "memory.db"
        clock = FixedClock()
        store = DlamStore(db, clock=clock)

        case("C01 WAL_FULL_FTS5", lambda: (
            require(store.dependency_report()["journal_mode"] == "WAL", "not WAL"),
            require(store.dependency_report()["synchronous"] == 2, "not FULL"),
            require(store.dependency_report()["fts5"] is True, "FTS5 unavailable"),
        ))

        receipt = store.admit(capsule("m1", "alpha continuity anchor"))
        case("C02 durable-admit-no-authority", lambda: (
            require(receipt["durability"] == "DURABLE_LOCAL", "bad durability"),
            require(receipt["authority_granted"] is False, "authority leak"),
        ))

        store.admit(capsule("dream1", "luminous impossible bridge", origin="DREAMED", kind="hypothesis"))
        case("C03 dreamed-origin-preserved", lambda:
            require(store.get_memory("dream1")["origin"] == "DREAMED", "origin changed"))

        store.admit(capsule("claimA", "reactor state is stable"))
        store.admit(capsule("claimB", "reactor state is unstable", conflict_refs=["claimA"]))
        case("C04 contradiction-preserved", lambda: (
            require(store.relation_exists("claimB", "CONTRADICTS", "claimA"), "relation missing"),
            require(len(store.recall(
                "reactor state",
                namespace_id="genius.ga108.001",
                purpose="analysis",
                target="local_operator",
            )) == 2, "both claims were not retained"),
        ))

        store.admit(capsule(
            "private1",
            "violet secret orchard",
            allowed_targets=["private_surface"],
            allowed_purposes=["private_analysis"],
        ))
        case("C05 policy-filtered-recall", lambda:
            require(
                not any(x["memory_id"] == "private1" for x in store.recall(
                    "violet secret",
                    namespace_id="genius.ga108.001",
                    purpose="analysis",
                    target="local_operator",
                )),
                "forbidden plaintext leaked",
            ))

        store.admit(capsule("source1", "source theorem delta"))
        store.admit(capsule(
            "summary1",
            "summary theorem delta",
            origin="INFERRED",
            derivation_parents=["source1"],
        ))
        store.admit(capsule(
            "summary2",
            "compressed theorem delta",
            origin="INFERRED",
            derivation_parents=["summary1"],
        ))
        tomb = store.forget("source1", reason="operator deletion", actor="operator")
        case("C06 tombstone-blocks-derived-closure", lambda: (
            require(tomb["affected"] == ["source1", "summary1", "summary2"], "bad affected closure"),
            require(
                len(store.recall(
                    "theorem delta",
                    namespace_id="genius.ga108.001",
                    purpose="analysis",
                    target="local_operator",
                )) == 0,
                "derived memory leaked",
            ),
        ))

        case("C07 tombstone-keeps-exact-ledger", lambda: (
            require(store.get_memory("source1") is not None, "memory hard-deleted"),
            require(
                any(e["operation"] == "TOMBSTONE" and e["subject_memory_id"] == "source1"
                    for e in store.ledger("genius.ga108.001")),
                "tombstone event missing",
            ),
        ))

        before = len(store.ledger("genius.ga108.001"))
        idem = store.admit(capsule("m1", "alpha continuity anchor"))
        case("C08 idempotent-admit-no-new-event", lambda: (
            require(idem["idempotent"] is True, "not idempotent"),
            require(len(store.ledger("genius.ga108.001")) == before, "ledger grew"),
        ))

        def reject_conflict():
            try:
                store.admit(capsule("m1", "changed content"))
            except MemoryConflictError:
                return
            raise AssertionError("conflicting rewrite was accepted")

        case("C09 conflicting-memory-id-fails-closed", reject_conflict)

        case("C10 lexical-recall", lambda:
            require(
                [x["memory_id"] for x in store.recall(
                    "alpha continuity",
                    namespace_id="genius.ga108.001",
                    purpose="analysis",
                    target="local_operator",
                )] == ["m1"],
                "lexical recall mismatch",
            ))

        store.close()
        store = DlamStore(db, clock=clock)
        case("C11 cold-restart-continuity", lambda: (
            require(store.get_memory("m1") is not None, "active memory lost"),
            require(store.get_memory("source1")["tombstoned"] == 1, "tombstone lost"),
            require(store.get_memory("summary2")["blocked"] == 1, "derived block lost"),
        ))

        case("C12 genius-identity-model-independent", lambda: (
            require(store.get_memory("m1")["genius_id"] == "ga108:001", "genius identity lost"),
            require("model_ref" not in store.get_memory("m1"), "fixed model binding stored"),
        ))

        tomb2 = store.forget("source1", reason="operator deletion", actor="operator")
        case("C13 idempotent-tombstone", lambda:
            require(tomb2["idempotent"] is True, "tombstone not idempotent"))

        store.close()

    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        def build(root):
            s = DlamStore(Path(root) / "m.db", clock=FixedClock())
            s.admit(capsule("d1", "deterministic one"))
            s.admit(capsule("d2", "deterministic two", origin="INFERRED", derivation_parents=["d1"]))
            s.forget("d1", reason="test", actor="operator")
            hashes = [e["event_hash"] for e in s.ledger("genius.ga108.001")]
            s.close()
            return hashes

        case("C14 deterministic-ledger-hashes", lambda:
            require(build(a) == build(b), "hash mismatch"))

    with tempfile.TemporaryDirectory() as td:
        s = DlamStore(Path(td) / "m.db", clock=FixedClock())
        s.admit(capsule("n1", "shared word", namespace_id="project.one"))
        s.admit(capsule("n2", "shared word", namespace_id="project.two"))
        got = s.recall(
            "shared word",
            namespace_id="project.one",
            purpose="analysis",
            target="local_operator",
        )
        case("C15 namespace-isolation", lambda:
            require([x["memory_id"] for x in got] == ["n1"], "namespace leak"))
        s.close()

    print(f"SUMMARY {passed}/{total} PASS")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
