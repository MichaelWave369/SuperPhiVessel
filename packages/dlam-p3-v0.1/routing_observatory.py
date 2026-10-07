from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from typing import Any

from dlam_store import ValidationError, canonical, sha256_text
from p1c_runtime import P1CRuntime


TASK_CLASS_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
WORD_RE = re.compile(r"[a-z0-9]+")
STOP = {
    "and", "the", "of", "a", "an", "for", "to", "in", "on", "with", "by",
    "systems", "system", "thinking", "theory", "historical", "practical",
}


def _unit(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"{name} must be numeric in [0,1]")
    value = float(value)
    if not 0.0 <= value <= 1.0:
        raise ValidationError(f"{name} must be in [0,1]")
    return value


def _nonnegative_int(value: Any, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValidationError(f"{name} must be a non-negative integer")
    return value


def _tokens(value: str) -> set[str]:
    return {
        x for x in WORD_RE.findall(value.lower())
        if len(x) > 2 and x not in STOP
    }


class RoutingObservatory:
    """PV-DLAM P3-A full-roster routing observability.

    P3-A records immutable, inspectable routing outcomes over exact P1-C route
    receipts and optional Sparse Frontier decisions. It may produce shadow
    scorecards/rankings, but it cannot alter P1-C static dispatch, SFR live
    thresholds, model qualification, Genius authority, or action authority.
    """

    SCHEMA = "superphivessel.dlam.p3a.v0.1"
    SNAPSHOT_SCHEMA = "superphivessel.dlam.p3a.scorecards.v0.1"
    SHADOW_POLICY = "p3a-descriptive-shadow-v0.1"

    def __init__(self, runtime: P1CRuntime) -> None:
        self.runtime = runtime
        self.conn = runtime.conn
        self.genius_profiles = runtime.genius_profiles
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS p3_route_observations(
              observation_id TEXT PRIMARY KEY,
              route_decision_id TEXT NOT NULL UNIQUE,
              task_id TEXT NOT NULL,
              task_class TEXT NOT NULL,
              profile_ref TEXT NOT NULL,
              model_ref TEXT NOT NULL,
              success INTEGER NOT NULL CHECK(success IN (0,1)),
              quality_score REAL NOT NULL,
              predicted_confidence REAL NOT NULL,
              brier_score REAL NOT NULL,
              evidence_satisfied INTEGER NOT NULL CHECK(evidence_satisfied IN (0,1)),
              governance_violation INTEGER NOT NULL CHECK(governance_violation IN (0,1)),
              critical_miss INTEGER NOT NULL CHECK(critical_miss IN (0,1)),
              user_correction INTEGER NOT NULL CHECK(user_correction IN (0,1)),
              latency_ms INTEGER NOT NULL,
              context_tokens INTEGER NOT NULL,
              estimated_cost_micros INTEGER NOT NULL,
              sfr_decision_id TEXT,
              observation_hash TEXT NOT NULL UNIQUE,
              observation_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_p3_profile_task
              ON p3_route_observations(profile_ref,task_class);
            CREATE INDEX IF NOT EXISTS idx_p3_model_task
              ON p3_route_observations(model_ref,task_class);
            CREATE INDEX IF NOT EXISTS idx_p3_sfr
              ON p3_route_observations(sfr_decision_id);
            """
        )
        self.conn.commit()

    def _route_receipt(self, decision_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT receipt_json FROM p1c_route_receipts WHERE decision_id=?",
            (decision_id,),
        ).fetchone()
        if row is None:
            raise ValidationError("unknown P1-C route_decision_id")
        return json.loads(row["receipt_json"])

    def _sfr_join(self, sfr_decision_id: str | None, *, task_id: str) -> dict[str, Any] | None:
        if sfr_decision_id is None:
            return None
        decision_row = self.conn.execute(
            "SELECT decision_json FROM sfr_decisions WHERE decision_id=?",
            (sfr_decision_id,),
        ).fetchone()
        if decision_row is None:
            raise ValidationError("unknown SFR decision")
        decision = json.loads(decision_row["decision_json"])
        if decision["task_id"] != task_id:
            raise ValidationError("SFR task does not match route task")

        outcome_row = self.conn.execute(
            "SELECT outcome_json FROM sfr_outcomes WHERE decision_id=?",
            (sfr_decision_id,),
        ).fetchone()
        outcome = json.loads(outcome_row["outcome_json"]) if outcome_row else None
        useful = None
        if outcome is not None and outcome.get("frontier_used"):
            useful = bool(
                outcome.get("changed_decision")
                or outcome.get("discovered_missing_evidence")
                or outcome.get("caught_critical_issue")
            )
        return {
            "decision_id": sfr_decision_id,
            "disposition": decision["disposition"],
            "escalated": bool(decision["escalated"]),
            "frontier_score": float(decision["frontier_score"]),
            "hard_reasons": list(decision.get("hard_reasons", [])),
            "recommended_geniuses": [
                x["profile_ref"] for x in decision.get("recommended_geniuses", [])
            ],
            "outcome_present": outcome is not None,
            "frontier_useful": useful,
            "frontier_model_ref": outcome.get("frontier_model_ref") if outcome else None,
            "changed_decision": bool(outcome.get("changed_decision")) if outcome else None,
            "discovered_missing_evidence": bool(outcome.get("discovered_missing_evidence")) if outcome else None,
            "caught_critical_issue": bool(outcome.get("caught_critical_issue")) if outcome else None,
            "critical_issue_present": bool(outcome.get("critical_issue_present")) if outcome else None,
            "sfr_governance_violation": bool(outcome.get("governance_violation")) if outcome else None,
        }

    def _affinity(self, profile_ref: str, task_tags: list[str]) -> float:
        profile = self.genius_profiles[profile_ref]
        task_words: set[str] = set()
        for tag in task_tags:
            task_words.update(_tokens(tag))
        if not task_words:
            return 0.0
        profile_words = _tokens(
            " ".join([
                profile.get("label", ""),
                profile.get("category", ""),
                profile.get("routingEmphasis", ""),
            ])
        )
        matched = task_words & profile_words
        return len(matched) / len(task_words)

    def record_observation(
        self,
        *,
        route_decision_id: str,
        task_class: str,
        success: bool,
        quality_score: float,
        predicted_confidence: float,
        evidence_satisfied: bool,
        governance_violation: bool,
        critical_miss: bool,
        user_correction: bool,
        latency_ms: int,
        context_tokens: int,
        estimated_cost_micros: int,
        outcome_source_refs: list[str],
        task_tags: list[str] | None = None,
        sfr_decision_id: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(route_decision_id, str) or not route_decision_id:
            raise ValidationError("route_decision_id is required")
        if not isinstance(task_class, str) or not TASK_CLASS_RE.match(task_class):
            raise ValidationError("task_class must match lowercase routing taxonomy")
        for name, value in {
            "success": success,
            "evidence_satisfied": evidence_satisfied,
            "governance_violation": governance_violation,
            "critical_miss": critical_miss,
            "user_correction": user_correction,
        }.items():
            if not isinstance(value, bool):
                raise ValidationError(f"{name} must be boolean")
        quality_score = _unit(quality_score, "quality_score")
        predicted_confidence = _unit(predicted_confidence, "predicted_confidence")
        latency_ms = _nonnegative_int(latency_ms, "latency_ms")
        context_tokens = _nonnegative_int(context_tokens, "context_tokens")
        estimated_cost_micros = _nonnegative_int(estimated_cost_micros, "estimated_cost_micros")
        if not isinstance(outcome_source_refs, list) or not outcome_source_refs:
            raise ValidationError("outcome_source_refs must contain at least one evidence ref")
        if len(outcome_source_refs) > 32 or not all(
            isinstance(x, str) and x for x in outcome_source_refs
        ):
            raise ValidationError("invalid outcome_source_refs")
        task_tags = list(dict.fromkeys(task_tags or []))
        if len(task_tags) > 32 or not all(isinstance(x, str) and x for x in task_tags):
            raise ValidationError("invalid task_tags")

        receipt = self._route_receipt(route_decision_id)
        task_id = receipt["task_id"]
        profile_ref = receipt["profile_ref"]
        model_ref = receipt["model_ref"]
        if profile_ref not in self.genius_profiles:
            raise ValidationError("route receipt references unknown Genius profile")
        self.runtime.get_model(model_ref)

        sfr = self._sfr_join(sfr_decision_id, task_id=task_id)
        brier = (predicted_confidence - (1.0 if success else 0.0)) ** 2
        affinity = self._affinity(profile_ref, task_tags)

        body = {
            "schema": self.SCHEMA,
            "route_decision_id": route_decision_id,
            "route_receipt_hash": receipt["receipt_hash"],
            "task_id": task_id,
            "task_class": task_class,
            "task_tags": task_tags,
            "profile_ref": profile_ref,
            "model_ref": model_ref,
            "routing_stats_key": receipt["routing_stats_key"],
            "success": success,
            "quality_score": quality_score,
            "predicted_confidence": predicted_confidence,
            "brier_score": brier,
            "evidence_satisfied": evidence_satisfied,
            "governance_violation": governance_violation,
            "critical_miss": critical_miss,
            "user_correction": user_correction,
            "latency_ms": latency_ms,
            "context_tokens": context_tokens,
            "estimated_cost_micros": estimated_cost_micros,
            "specialization_affinity": affinity,
            "outcome_source_refs": sorted(set(outcome_source_refs)),
            "sfr": sfr,
            "learning_mode": "SHADOW_OBSERVATION_ONLY",
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "authority_granted": False,
        }
        observation_hash = sha256_text("PV-DLAM-P3A-OBS|" + canonical(body))
        observation = {
            **body,
            "observation_id": "p3obs_" + observation_hash[:32],
            "observation_hash": observation_hash,
        }

        existing = self.conn.execute(
            "SELECT observation_hash,observation_json FROM p3_route_observations WHERE route_decision_id=?",
            (route_decision_id,),
        ).fetchone()
        if existing is not None:
            if existing["observation_hash"] != observation_hash:
                raise ValidationError(
                    "route already has a different finalized P3 observation; "
                    "observations are immutable"
                )
            return json.loads(existing["observation_json"])

        self.conn.execute(
            """
            INSERT INTO p3_route_observations(
              observation_id,route_decision_id,task_id,task_class,profile_ref,model_ref,
              success,quality_score,predicted_confidence,brier_score,evidence_satisfied,
              governance_violation,critical_miss,user_correction,latency_ms,context_tokens,
              estimated_cost_micros,sfr_decision_id,observation_hash,observation_json
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                observation["observation_id"],
                route_decision_id,
                task_id,
                task_class,
                profile_ref,
                model_ref,
                1 if success else 0,
                quality_score,
                predicted_confidence,
                brier,
                1 if evidence_satisfied else 0,
                1 if governance_violation else 0,
                1 if critical_miss else 0,
                1 if user_correction else 0,
                latency_ms,
                context_tokens,
                estimated_cost_micros,
                sfr_decision_id,
                observation_hash,
                canonical(observation),
            ),
        )
        self.conn.commit()
        return observation

    def _rows(self) -> list[dict[str, Any]]:
        return [
            dict(r) for r in self.conn.execute(
                "SELECT * FROM p3_route_observations ORDER BY observation_id"
            ).fetchall()
        ]

    @staticmethod
    def _aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
        n = len(rows)
        if n == 0:
            return {
                "observations": 0,
                "successes": 0,
                "success_rate": None,
                "posterior_success_mean": None,
                "mean_quality": None,
                "mean_brier": None,
                "mean_latency_ms": None,
                "mean_context_tokens": None,
                "mean_cost_micros": None,
                "evidence_satisfaction_rate": None,
                "user_correction_rate": None,
                "governance_violations": 0,
                "critical_misses": 0,
                "non_tradable_breach": False,
            }
        successes = sum(int(r["success"]) for r in rows)
        governance = sum(int(r["governance_violation"]) for r in rows)
        critical = sum(int(r["critical_miss"]) for r in rows)
        return {
            "observations": n,
            "successes": successes,
            "success_rate": successes / n,
            "posterior_success_mean": (successes + 1) / (n + 2),
            "mean_quality": sum(float(r["quality_score"]) for r in rows) / n,
            "mean_brier": sum(float(r["brier_score"]) for r in rows) / n,
            "mean_latency_ms": sum(int(r["latency_ms"]) for r in rows) / n,
            "mean_context_tokens": sum(int(r["context_tokens"]) for r in rows) / n,
            "mean_cost_micros": sum(int(r["estimated_cost_micros"]) for r in rows) / n,
            "evidence_satisfaction_rate": sum(int(r["evidence_satisfied"]) for r in rows) / n,
            "user_correction_rate": sum(int(r["user_correction"]) for r in rows) / n,
            "governance_violations": governance,
            "critical_misses": critical,
            "non_tradable_breach": bool(governance or critical),
        }

    def scorecard_snapshot(self) -> dict[str, Any]:
        rows = self._rows()

        by_profile: dict[str, list[dict[str, Any]]] = defaultdict(list)
        by_model: dict[str, list[dict[str, Any]]] = defaultdict(list)
        by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
        source_ids = []

        for row in rows:
            by_profile[row["profile_ref"]].append(row)
            by_model[row["model_ref"]].append(row)
            by_task[row["task_class"]].append(row)
            source_ids.append(row["observation_id"])

        geniuses = {}
        for profile_ref, profile in sorted(self.genius_profiles.items()):
            subset = by_profile.get(profile_ref, [])
            agg = self._aggregate(subset)
            model_counts = Counter(r["model_ref"] for r in subset)
            task_counts = Counter(r["task_class"] for r in subset)
            geniuses[profile_ref] = {
                "profile_ref": profile_ref,
                "label": profile["label"],
                "category": profile["category"],
                "routing_emphasis": profile["routingEmphasis"],
                "authority": "NONE",
                "evidence_status": "OBSERVED" if subset else "DORMANT_NO_EVIDENCE",
                **agg,
                "models_observed": dict(sorted(model_counts.items())),
                "task_classes_observed": dict(sorted(task_counts.items())),
            }

        models = {
            model_ref: {
                "model_ref": model_ref,
                **self._aggregate(subset),
                "profiles_observed": dict(sorted(Counter(r["profile_ref"] for r in subset).items())),
                "task_classes_observed": dict(sorted(Counter(r["task_class"] for r in subset).items())),
            }
            for model_ref, subset in sorted(by_model.items())
        }

        tasks = {
            task_class: {
                "task_class": task_class,
                **self._aggregate(subset),
                "profiles_observed": dict(sorted(Counter(r["profile_ref"] for r in subset).items())),
                "models_observed": dict(sorted(Counter(r["model_ref"] for r in subset).items())),
            }
            for task_class, subset in sorted(by_task.items())
        }

        sfr_rows = [
            json.loads(r["observation_json"])["sfr"]
            for r in rows
            if json.loads(r["observation_json"]).get("sfr") is not None
        ]
        frontier_completed = [x for x in sfr_rows if x["outcome_present"] and x["escalated"]]
        frontier_useful = [x for x in frontier_completed if x["frontier_useful"] is True]
        local_sfr = [x for x in sfr_rows if not x["escalated"]]

        body = {
            "schema": self.SNAPSHOT_SCHEMA,
            "policy": self.SHADOW_POLICY,
            "roster_size": len(self.genius_profiles),
            "observation_count": len(rows),
            "geniuses": geniuses,
            "models": models,
            "task_classes": tasks,
            "sfr_shadow": {
                "linked_observations": len(sfr_rows),
                "local_resolutions": len(local_sfr),
                "completed_frontier_investigations": len(frontier_completed),
                "useful_frontier_investigations": len(frontier_useful),
                "escalation_usefulness_rate": (
                    None if not frontier_completed
                    else len(frontier_useful) / len(frontier_completed)
                ),
            },
            "source_observation_ids": sorted(source_ids),
            "learning_mode": "SHADOW_OBSERVATION_ONLY",
            "learned_weights": None,
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3A-SNAPSHOT|" + canonical(body))
        return {
            **body,
            "snapshot_id": "p3snap_" + digest[:32],
            "snapshot_hash": digest,
        }

    def shadow_roster_rank(
        self,
        *,
        task_class: str,
        task_tags: list[str],
        limit: int = 8,
        minimum_observations: int = 3,
    ) -> dict[str, Any]:
        if not isinstance(task_class, str) or not TASK_CLASS_RE.match(task_class):
            raise ValidationError("invalid task_class")
        if not isinstance(limit, int) or not 1 <= limit <= 8:
            raise ValidationError("limit must be between 1 and 8")
        if not isinstance(minimum_observations, int) or minimum_observations < 1:
            raise ValidationError("minimum_observations must be positive")
        if len(task_tags) > 32 or not all(isinstance(x, str) and x for x in task_tags):
            raise ValidationError("invalid task_tags")

        rows = self._rows()
        by_profile_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            if row["task_class"] == task_class:
                by_profile_task[row["profile_ref"]].append(row)

        candidates = []
        for profile_ref, profile in sorted(self.genius_profiles.items()):
            subset = by_profile_task.get(profile_ref, [])
            agg = self._aggregate(subset)
            affinity = self._affinity(profile_ref, task_tags)
            sufficient = len(subset) >= minimum_observations
            breach = bool(agg["non_tradable_breach"])
            rank_key = (
                0 if sufficient and not breach else 1,
                -(agg["mean_quality"] if agg["mean_quality"] is not None else -1.0),
                -(agg["posterior_success_mean"] if agg["posterior_success_mean"] is not None else -1.0),
                agg["mean_brier"] if agg["mean_brier"] is not None else math.inf,
                -affinity,
                profile_ref,
            )
            candidates.append((
                rank_key,
                {
                    "profile_ref": profile_ref,
                    "label": profile["label"],
                    "category": profile["category"],
                    "observations_for_task_class": len(subset),
                    "evidence_sufficient": sufficient,
                    "non_tradable_breach": breach,
                    "mean_quality": agg["mean_quality"],
                    "posterior_success_mean": agg["posterior_success_mean"],
                    "mean_brier": agg["mean_brier"],
                    "specialization_affinity": affinity,
                    "activation_status": "SHADOW_ONLY_DORMANT",
                    "authority": "NONE",
                },
            ))
        candidates.sort(key=lambda x: x[0])
        selected = [item for _, item in candidates[:limit]]
        body = {
            "schema": "superphivessel.dlam.p3a.shadow-roster-rank.v0.1",
            "task_class": task_class,
            "task_tags": list(task_tags),
            "minimum_observations": minimum_observations,
            "candidates": selected,
            "policy": self.SHADOW_POLICY,
            "ranking_is_live": False,
            "may_activate_genius": False,
            "may_change_live_route": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3A-RANK|" + canonical(body))
        return {
            **body,
            "rank_id": "p3rank_" + digest[:32],
            "rank_hash": digest,
        }
