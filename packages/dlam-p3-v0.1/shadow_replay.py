from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from typing import Any

from dlam_store import ValidationError, canonical, sha256_text
from routing_observatory import RoutingObservatory


class ReplayError(ValidationError):
    pass


def _ratio(num: float, den: int) -> float | None:
    return None if den == 0 else num / den


class ShadowReplayLab:
    """PV-DLAM P3-B held-out paired shadow replay.

    This layer deliberately distinguishes:
      * observed paired alternatives, which can be compared on held-out cases;
      * unobserved alternatives, which are UNSUPPORTED_COUNTERFACTUALS.

    It never changes P1-C routing or SFR thresholds.
    """

    CASE_SCHEMA = "superphivessel.dlam.p3b.replay-case.v0.1"
    POLICY_SCHEMA = "superphivessel.dlam.p3b.shadow-policy.v0.1"
    REPORT_SCHEMA = "superphivessel.dlam.p3b.replay-report.v0.1"
    SFR_REPORT_SCHEMA = "superphivessel.dlam.p3b.sfr-threshold-replay.v0.1"
    POLICY_VERSION = "p3b-paired-shadow-v0.1"

    def __init__(self, observatory: RoutingObservatory) -> None:
        self.observatory = observatory
        self.runtime = observatory.runtime
        self.conn = observatory.conn
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS p3b_replay_cases(
              case_id TEXT PRIMARY KEY,
              case_ref TEXT NOT NULL UNIQUE,
              partition_group_ref TEXT NOT NULL,
              task_id TEXT NOT NULL,
              task_class TEXT NOT NULL,
              baseline_observation_id TEXT NOT NULL,
              case_hash TEXT NOT NULL UNIQUE,
              case_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_p3b_group
              ON p3b_replay_cases(partition_group_ref);
            CREATE INDEX IF NOT EXISTS idx_p3b_task_class
              ON p3b_replay_cases(task_class);
            """
        )
        self.conn.commit()

    def _observation(self, observation_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT observation_json FROM p3_route_observations WHERE observation_id=?",
            (observation_id,),
        ).fetchone()
        if row is None:
            raise ReplayError(f"unknown P3 observation: {observation_id}")
        return json.loads(row["observation_json"])

    @staticmethod
    def route_signature(observation: dict[str, Any]) -> str:
        return observation["profile_ref"] + "|" + observation["model_ref"]

    def register_case(
        self,
        *,
        case_ref: str,
        partition_group_ref: str,
        baseline_observation_id: str,
        alternative_observation_ids: list[str],
    ) -> dict[str, Any]:
        for name, value in {
            "case_ref": case_ref,
            "partition_group_ref": partition_group_ref,
            "baseline_observation_id": baseline_observation_id,
        }.items():
            if not isinstance(value, str) or not value:
                raise ReplayError(f"{name} must be a non-empty string")
        if not isinstance(alternative_observation_ids, list) or not alternative_observation_ids:
            raise ReplayError("at least one paired alternative observation is required")
        if len(alternative_observation_ids) > 16:
            raise ReplayError("paired alternative count exceeds v0.1 bound")
        if baseline_observation_id in alternative_observation_ids:
            raise ReplayError("baseline cannot also be an alternative")
        if len(set(alternative_observation_ids)) != len(alternative_observation_ids):
            raise ReplayError("duplicate alternative observation")

        ids = [baseline_observation_id, *alternative_observation_ids]
        observations = [self._observation(x) for x in ids]
        task_ids = {x["task_id"] for x in observations}
        task_classes = {x["task_class"] for x in observations}
        if len(task_ids) != 1:
            raise ReplayError("paired observations must share the same task_id")
        if len(task_classes) != 1:
            raise ReplayError("paired observations must share the same task_class")
        signatures = [self.route_signature(x) for x in observations]
        if len(set(signatures)) != len(signatures):
            raise ReplayError("paired case must contain distinct route signatures")

        body = {
            "schema": self.CASE_SCHEMA,
            "case_ref": case_ref,
            "partition_group_ref": partition_group_ref,
            "task_id": observations[0]["task_id"],
            "task_class": observations[0]["task_class"],
            "baseline_observation_id": baseline_observation_id,
            "alternative_observation_ids": sorted(alternative_observation_ids),
            "observation_ids": sorted(ids),
            "route_signatures": sorted(signatures),
            "raw_task_text_stored": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3B-CASE|" + canonical(body))
        case = {
            **body,
            "case_id": "p3case_" + digest[:32],
            "case_hash": digest,
        }

        existing = self.conn.execute(
            "SELECT case_hash,case_json FROM p3b_replay_cases WHERE case_ref=?",
            (case_ref,),
        ).fetchone()
        if existing is not None:
            if existing["case_hash"] != digest:
                raise ReplayError("case_ref already finalized with different evidence")
            return json.loads(existing["case_json"])

        self.conn.execute(
            """
            INSERT INTO p3b_replay_cases(
              case_id,case_ref,partition_group_ref,task_id,task_class,
              baseline_observation_id,case_hash,case_json
            ) VALUES(?,?,?,?,?,?,?,?)
            """,
            (
                case["case_id"],
                case_ref,
                partition_group_ref,
                case["task_id"],
                case["task_class"],
                baseline_observation_id,
                digest,
                canonical(case),
            ),
        )
        self.conn.commit()
        return case

    @staticmethod
    def partition_for_group(
        partition_group_ref: str,
        *,
        seed: int,
        train_fraction: float,
    ) -> str:
        if not isinstance(partition_group_ref, str) or not partition_group_ref:
            raise ReplayError("partition_group_ref is required")
        if not isinstance(seed, int) or isinstance(seed, bool):
            raise ReplayError("seed must be an integer")
        if isinstance(train_fraction, bool) or not isinstance(train_fraction, (int, float)):
            raise ReplayError("train_fraction must be numeric")
        train_fraction = float(train_fraction)
        if not 0.05 <= train_fraction <= 0.95:
            raise ReplayError("train_fraction must be in [0.05,0.95]")
        digest = hashlib.sha256(
            f"PV-DLAM-P3B-SPLIT|{seed}|{partition_group_ref}".encode("utf-8")
        ).digest()
        value = int.from_bytes(digest[:8], "big") / float(2**64)
        return "TRAIN" if value < train_fraction else "TEST"

    def _cases(self) -> list[dict[str, Any]]:
        return [
            json.loads(r["case_json"])
            for r in self.conn.execute(
                "SELECT case_json FROM p3b_replay_cases ORDER BY case_ref"
            ).fetchall()
        ]

    def dataset_snapshot(self, *, seed: int, train_fraction: float = 0.70) -> dict[str, Any]:
        cases = self._cases()
        entries = []
        by_group: dict[str, str] = {}
        for case in cases:
            group = case["partition_group_ref"]
            partition = self.partition_for_group(
                group, seed=seed, train_fraction=train_fraction
            )
            prior = by_group.setdefault(group, partition)
            if prior != partition:
                raise ReplayError("partition group leaked across train/test")
            entries.append({
                "case_id": case["case_id"],
                "case_ref": case["case_ref"],
                "partition_group_ref": group,
                "partition": partition,
                "task_class": case["task_class"],
                "observation_ids": case["observation_ids"],
            })

        train_groups = sorted(g for g, p in by_group.items() if p == "TRAIN")
        test_groups = sorted(g for g, p in by_group.items() if p == "TEST")
        body = {
            "schema": "superphivessel.dlam.p3b.dataset.v0.1",
            "seed": seed,
            "train_fraction": float(train_fraction),
            "entries": entries,
            "train_groups": train_groups,
            "test_groups": test_groups,
            "group_leakage": bool(set(train_groups) & set(test_groups)),
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3B-DATASET|" + canonical(body))
        return {
            **body,
            "dataset_id": "p3data_" + digest[:32],
            "dataset_hash": digest,
        }

    @staticmethod
    def _aggregate_route(rows: list[dict[str, Any]]) -> dict[str, Any]:
        n = len(rows)
        breaches = sum(
            1 for r in rows
            if r["governance_violation"] or r["critical_miss"]
        )
        return {
            "observations": n,
            "success_rate": _ratio(sum(1 for r in rows if r["success"]), n),
            "mean_quality": _ratio(sum(float(r["quality_score"]) for r in rows), n),
            "mean_brier": _ratio(sum(float(r["brier_score"]) for r in rows), n),
            "evidence_satisfaction_rate": _ratio(
                sum(1 for r in rows if r["evidence_satisfied"]), n
            ),
            "user_correction_rate": _ratio(
                sum(1 for r in rows if r["user_correction"]), n
            ),
            "mean_latency_ms": _ratio(sum(int(r["latency_ms"]) for r in rows), n),
            "mean_context_tokens": _ratio(sum(int(r["context_tokens"]) for r in rows), n),
            "mean_cost_micros": _ratio(
                sum(int(r["estimated_cost_micros"]) for r in rows), n
            ),
            "non_tradable_breaches": breaches,
        }

    def fit_route_policy(
        self,
        *,
        seed: int,
        train_fraction: float = 0.70,
        minimum_route_observations: int = 2,
    ) -> dict[str, Any]:
        if (
            not isinstance(minimum_route_observations, int)
            or isinstance(minimum_route_observations, bool)
            or minimum_route_observations < 1
        ):
            raise ReplayError("minimum_route_observations must be positive")
        dataset = self.dataset_snapshot(seed=seed, train_fraction=train_fraction)
        case_by_id = {x["case_id"]: x for x in self._cases()}
        rows_by_task_route: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        training_obs_ids: set[str] = set()
        training_case_ids: list[str] = []

        for entry in dataset["entries"]:
            if entry["partition"] != "TRAIN":
                continue
            case = case_by_id[entry["case_id"]]
            training_case_ids.append(case["case_id"])
            for obs_id in case["observation_ids"]:
                obs = self._observation(obs_id)
                training_obs_ids.add(obs_id)
                key = (obs["task_class"], self.route_signature(obs))
                rows_by_task_route[key].append(obs)

        task_classes = sorted({k[0] for k in rows_by_task_route})
        preferred_routes: dict[str, Any] = {}
        route_stats: dict[str, Any] = {}

        for task_class in task_classes:
            candidates = []
            for (tc, signature), rows in sorted(rows_by_task_route.items()):
                if tc != task_class:
                    continue
                agg = self._aggregate_route(rows)
                sufficient = agg["observations"] >= minimum_route_observations
                clean = agg["non_tradable_breaches"] == 0
                profile_ref, model_ref = signature.split("|", 1)
                item = {
                    "route_signature": signature,
                    "profile_ref": profile_ref,
                    "model_ref": model_ref,
                    **agg,
                    "evidence_sufficient": sufficient,
                    "clean_for_shadow_selection": clean,
                }
                route_stats[f"{task_class}|{signature}"] = item
                if sufficient and clean:
                    rank_key = (
                        -(agg["mean_quality"] or 0.0),
                        -(agg["success_rate"] or 0.0),
                        agg["mean_brier"] if agg["mean_brier"] is not None else 1.0,
                        -(agg["evidence_satisfaction_rate"] or 0.0),
                        agg["user_correction_rate"] if agg["user_correction_rate"] is not None else 1.0,
                        agg["mean_latency_ms"] if agg["mean_latency_ms"] is not None else float("inf"),
                        agg["mean_cost_micros"] if agg["mean_cost_micros"] is not None else float("inf"),
                        signature,
                    )
                    candidates.append((rank_key, item))
            candidates.sort(key=lambda x: x[0])
            preferred_routes[task_class] = (
                None if not candidates else candidates[0][1]["route_signature"]
            )

        body = {
            "schema": self.POLICY_SCHEMA,
            "policy_version": self.POLICY_VERSION,
            "dataset_hash": dataset["dataset_hash"],
            "seed": seed,
            "train_fraction": float(train_fraction),
            "minimum_route_observations": minimum_route_observations,
            "training_case_ids": sorted(training_case_ids),
            "training_source_observation_ids": sorted(training_obs_ids),
            "preferred_routes": preferred_routes,
            "route_stats": route_stats,
            "counterfactual_rule": "PAIRED_OBSERVED_ONLY",
            "learning_mode": "SHADOW_REPLAY_ONLY",
            "policy_is_live": False,
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3B-POLICY|" + canonical(body))
        return {
            **body,
            "policy_id": "p3pol_" + digest[:32],
            "policy_hash": digest,
        }

    def evaluate_route_policy(self, policy: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(policy, dict) or policy.get("schema") != self.POLICY_SCHEMA:
            raise ReplayError("invalid P3-B policy")
        if policy.get("policy_is_live") is not False:
            raise ReplayError("P3-B cannot evaluate a live-marked policy")

        dataset = self.dataset_snapshot(
            seed=int(policy["seed"]),
            train_fraction=float(policy["train_fraction"]),
        )
        if dataset["dataset_hash"] != policy["dataset_hash"]:
            raise ReplayError("dataset changed after policy fit")

        case_by_id = {x["case_id"]: x for x in self._cases()}
        results = []
        supported = []
        test_source_ids: set[str] = set()

        for entry in dataset["entries"]:
            if entry["partition"] != "TEST":
                continue
            case = case_by_id[entry["case_id"]]
            observations = {
                obs_id: self._observation(obs_id)
                for obs_id in case["observation_ids"]
            }
            test_source_ids.update(observations)
            baseline = observations[case["baseline_observation_id"]]
            preferred = policy["preferred_routes"].get(case["task_class"])

            candidate = None
            if preferred is not None:
                for obs in observations.values():
                    if self.route_signature(obs) == preferred:
                        candidate = obs
                        break

            if preferred is None:
                result = {
                    "case_id": case["case_id"],
                    "case_ref": case["case_ref"],
                    "task_class": case["task_class"],
                    "status": "NO_SUPPORTED_POLICY",
                    "preferred_route_signature": None,
                    "baseline_observation_id": baseline["observation_id"],
                    "candidate_observation_id": None,
                }
            elif candidate is None:
                result = {
                    "case_id": case["case_id"],
                    "case_ref": case["case_ref"],
                    "task_class": case["task_class"],
                    "status": "UNSUPPORTED_COUNTERFACTUAL",
                    "preferred_route_signature": preferred,
                    "baseline_observation_id": baseline["observation_id"],
                    "candidate_observation_id": None,
                }
            else:
                result = {
                    "case_id": case["case_id"],
                    "case_ref": case["case_ref"],
                    "task_class": case["task_class"],
                    "status": "SUPPORTED_PAIRED",
                    "preferred_route_signature": preferred,
                    "baseline_observation_id": baseline["observation_id"],
                    "candidate_observation_id": candidate["observation_id"],
                    "candidate_non_tradable_breach": bool(
                        candidate["governance_violation"] or candidate["critical_miss"]
                    ),
                    "delta": {
                        "success": int(candidate["success"]) - int(baseline["success"]),
                        "quality": float(candidate["quality_score"]) - float(baseline["quality_score"]),
                        "brier": float(candidate["brier_score"]) - float(baseline["brier_score"]),
                        "evidence_satisfied": int(candidate["evidence_satisfied"]) - int(baseline["evidence_satisfied"]),
                        "user_correction": int(candidate["user_correction"]) - int(baseline["user_correction"]),
                        "latency_ms": int(candidate["latency_ms"]) - int(baseline["latency_ms"]),
                        "context_tokens": int(candidate["context_tokens"]) - int(baseline["context_tokens"]),
                        "estimated_cost_micros": int(candidate["estimated_cost_micros"]) - int(baseline["estimated_cost_micros"]),
                    },
                }
                supported.append(result)
            results.append(result)

        n_test = len(results)
        n_supported = len(supported)
        candidate_breaches = sum(
            1 for r in supported if r["candidate_non_tradable_breach"]
        )

        def mean_delta(name: str) -> float | None:
            if not supported:
                return None
            return sum(float(r["delta"][name]) for r in supported) / len(supported)

        training_ids = set(policy["training_source_observation_ids"])
        leakage = bool(training_ids & test_source_ids)

        body = {
            "schema": self.REPORT_SCHEMA,
            "policy_id": policy["policy_id"],
            "policy_hash": policy["policy_hash"],
            "dataset_hash": dataset["dataset_hash"],
            "test_cases": n_test,
            "supported_paired_cases": n_supported,
            "unsupported_counterfactual_cases": sum(
                1 for r in results if r["status"] == "UNSUPPORTED_COUNTERFACTUAL"
            ),
            "no_supported_policy_cases": sum(
                1 for r in results if r["status"] == "NO_SUPPORTED_POLICY"
            ),
            "paired_support_coverage": _ratio(n_supported, n_test),
            "candidate_non_tradable_breaches": candidate_breaches,
            "mean_paired_delta": {
                "success": mean_delta("success"),
                "quality": mean_delta("quality"),
                "brier": mean_delta("brier"),
                "evidence_satisfied": mean_delta("evidence_satisfied"),
                "user_correction": mean_delta("user_correction"),
                "latency_ms": mean_delta("latency_ms"),
                "context_tokens": mean_delta("context_tokens"),
                "estimated_cost_micros": mean_delta("estimated_cost_micros"),
            },
            "results": results,
            "training_source_observation_ids": sorted(training_ids),
            "test_source_observation_ids": sorted(test_source_ids),
            "train_test_observation_leakage": leakage,
            "causal_claim": "NONE",
            "counterfactual_rule": "UNOBSERVED_ROUTE_OUTCOMES_ARE_UNSUPPORTED",
            "promotion_eligible": False,
            "learning_mode": "SHADOW_REPLAY_ONLY",
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3B-REPORT|" + canonical(body))
        return {
            **body,
            "report_id": "p3report_" + digest[:32],
            "report_hash": digest,
        }

    def replay_sfr_threshold(self, *, candidate_soft_threshold: float) -> dict[str, Any]:
        if (
            isinstance(candidate_soft_threshold, bool)
            or not isinstance(candidate_soft_threshold, (int, float))
        ):
            raise ReplayError("candidate_soft_threshold must be numeric")
        threshold = float(candidate_soft_threshold)
        if not 0.0 <= threshold <= 1.0:
            raise ReplayError("candidate_soft_threshold must be in [0,1]")

        results = []
        for row in self.conn.execute(
            "SELECT observation_json FROM p3_route_observations ORDER BY observation_id"
        ).fetchall():
            obs = json.loads(row["observation_json"])
            sfr = obs.get("sfr")
            if sfr is None:
                continue

            disposition = sfr["disposition"]
            if disposition in {"HELD", "DENIED"}:
                results.append({
                    "observation_id": obs["observation_id"],
                    "status": "AUTHORITY_FIXED",
                    "logged_disposition": disposition,
                    "candidate_disposition": disposition,
                    "supported": True,
                })
                continue

            hard = bool(sfr.get("hard_reasons"))
            candidate_escalated = hard or float(sfr["frontier_score"]) >= threshold
            logged_escalated = bool(sfr["escalated"])
            same = candidate_escalated == logged_escalated
            results.append({
                "observation_id": obs["observation_id"],
                "status": "ON_POLICY_AGREEMENT" if same else "UNSUPPORTED_COUNTERFACTUAL",
                "logged_disposition": disposition,
                "logged_escalated": logged_escalated,
                "candidate_escalated": candidate_escalated,
                "frontier_score": float(sfr["frontier_score"]),
                "hard_reasons": list(sfr.get("hard_reasons", [])),
                "frontier_useful_observed": sfr.get("frontier_useful"),
                "supported": same,
            })

        supported = sum(1 for r in results if r["supported"])
        body = {
            "schema": self.SFR_REPORT_SCHEMA,
            "candidate_soft_threshold": threshold,
            "linked_observations": len(results),
            "supported_observations": supported,
            "unsupported_counterfactuals": len(results) - supported,
            "support_coverage": _ratio(supported, len(results)),
            "results": results,
            "counterfactual_rule": (
                "A THRESHOLD FLIP IS NOT SCORED UNLESS BOTH ESCALATED AND "
                "LOCAL OUTCOMES WERE ACTUALLY OBSERVED"
            ),
            "causal_claim": "NONE",
            "threshold_is_live": False,
            "may_change_live_thresholds": False,
            "may_change_live_route": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3B-SFR|" + canonical(body))
        return {
            **body,
            "report_id": "p3sfr_" + digest[:32],
            "report_hash": digest,
        }
