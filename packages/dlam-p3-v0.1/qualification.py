from __future__ import annotations

import json
from collections import Counter, defaultdict
from typing import Any

from dlam_store import ValidationError, canonical, sha256_text
from shadow_replay import ShadowReplayLab


class QualificationError(ValidationError):
    pass


DEFAULT_REQUIREMENTS = {
    "minimum_total_cases": 400,
    "minimum_task_classes": 4,
    "minimum_cases_per_task_class": 50,
    "minimum_unique_profiles": 8,
    "minimum_unique_models": 2,
    "minimum_seed_count": 5,
    "minimum_test_cases_per_seed": 50,
    "minimum_paired_support_coverage": 0.80,
    "maximum_candidate_non_tradable_breaches": 0,
    "minimum_sfr_linked_observations": 100,
    "minimum_sfr_completed_frontier": 30,
    "minimum_sfr_critical_issues": 20,
    "maximum_sfr_critical_miss_rate": 0.02,
    "minimum_sfr_escalation_precision": 0.50,
    "maximum_sfr_governance_violations": 0,
    "minimum_current_threshold_support_coverage": 1.0,
}


def _ratio(num: int | float, den: int) -> float | None:
    return None if den == 0 else float(num) / den


class P3QualificationGate:
    """P3-C qualification closeout and P4 evaluation-packet generator.

    This gate can establish structural/evidence sufficiency for later P4
    evaluation. It cannot activate learned routing, install thresholds, grant
    authority, or convert synthetic fixtures into empirical evidence.
    """

    SCHEMA = "superphivessel.dlam.p3c.qualification.v0.1"
    PACKET_SCHEMA = "superphivessel.dlam.p4.evaluation-packet.v0.1"

    def __init__(self, lab: ShadowReplayLab) -> None:
        self.lab = lab
        self.observatory = lab.observatory
        self.conn = lab.conn

    @staticmethod
    def _validate_requirements(requirements: dict[str, Any]) -> dict[str, Any]:
        merged = dict(DEFAULT_REQUIREMENTS)
        merged.update(requirements or {})
        for key, value in merged.items():
            if key.startswith("minimum_") and "coverage" not in key and "rate" not in key and "precision" not in key:
                if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                    raise QualificationError(f"{key} must be a non-negative integer")
            elif key.startswith("maximum_") and "rate" not in key:
                if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                    raise QualificationError(f"{key} must be a non-negative integer")
            else:
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise QualificationError(f"{key} must be numeric")
                if not 0.0 <= float(value) <= 1.0:
                    raise QualificationError(f"{key} must be in [0,1]")
        return merged

    def _case_coverage(self) -> dict[str, Any]:
        cases = self.lab._cases()
        class_counts = Counter(c["task_class"] for c in cases)
        observation_ids = sorted({
            oid for c in cases for oid in c["observation_ids"]
        })
        observations = [self.lab._observation(oid) for oid in observation_ids]
        profiles = sorted({o["profile_ref"] for o in observations})
        models = sorted({o["model_ref"] for o in observations})
        return {
            "total_cases": len(cases),
            "task_classes": dict(sorted(class_counts.items())),
            "task_class_count": len(class_counts),
            "minimum_cases_in_any_task_class": min(class_counts.values()) if class_counts else 0,
            "unique_profiles": profiles,
            "unique_profile_count": len(profiles),
            "unique_models": models,
            "unique_model_count": len(models),
            "source_observation_ids": observation_ids,
        }

    def _sfr_coverage(self, current_soft_threshold: float) -> dict[str, Any]:
        if isinstance(current_soft_threshold, bool) or not isinstance(current_soft_threshold, (int, float)):
            raise QualificationError("current_soft_threshold must be numeric")
        current_soft_threshold = float(current_soft_threshold)
        if not 0.0 <= current_soft_threshold <= 1.0:
            raise QualificationError("current_soft_threshold must be in [0,1]")

        linked = []
        by_task_class: Counter[str] = Counter()
        for row in self.conn.execute(
            "SELECT observation_json FROM p3_route_observations ORDER BY observation_id"
        ).fetchall():
            obs = json.loads(row["observation_json"])
            sfr = obs.get("sfr")
            if sfr is None:
                continue
            linked.append(sfr)
            by_task_class[obs["task_class"]] += 1

        completed_frontier = [
            s for s in linked if s["escalated"] and s["outcome_present"]
        ]
        useful = [s for s in completed_frontier if s["frontier_useful"] is True]
        critical = [
            s for s in linked
            if s["outcome_present"] and s["critical_issue_present"] is True
        ]
        critical_miss = [
            s for s in critical
            if (not s["escalated"]) or (s["caught_critical_issue"] is not True)
        ]
        governance = [
            s for s in linked
            if s["outcome_present"] and s["sfr_governance_violation"] is True
        ]

        threshold_report = self.lab.replay_sfr_threshold(
            candidate_soft_threshold=current_soft_threshold
        )
        return {
            "linked_observations": len(linked),
            "task_classes": dict(sorted(by_task_class.items())),
            "completed_frontier_investigations": len(completed_frontier),
            "useful_frontier_investigations": len(useful),
            "escalation_precision": _ratio(len(useful), len(completed_frontier)),
            "critical_issues": len(critical),
            "critical_misses": len(critical_miss),
            "critical_miss_rate": _ratio(len(critical_miss), len(critical)),
            "governance_violations": len(governance),
            "current_threshold": current_soft_threshold,
            "current_threshold_support_coverage": threshold_report["support_coverage"],
            "threshold_report_hash": threshold_report["report_hash"],
        }

    @staticmethod
    def _gate(gate_id: str, passed: bool, *, actual: Any, requirement: Any) -> dict[str, Any]:
        return {
            "gate_id": gate_id,
            "passed": bool(passed),
            "actual": actual,
            "requirement": requirement,
        }

    def assess(
        self,
        *,
        seeds: list[int],
        train_fraction: float = 0.70,
        minimum_route_observations: int = 20,
        current_sfr_soft_threshold: float = 0.62,
        requirements: dict[str, Any] | None = None,
        evidence_class: str,
        evidence_manifest_refs: list[str],
        fixture_mode: bool = False,
    ) -> dict[str, Any]:
        req = self._validate_requirements(requirements or {})
        if not isinstance(seeds, list) or not seeds or not all(
            isinstance(x, int) and not isinstance(x, bool) for x in seeds
        ):
            raise QualificationError("seeds must be a non-empty integer list")
        if len(set(seeds)) != len(seeds):
            raise QualificationError("seeds must be unique")
        if evidence_class not in {
            "SYNTHETIC_QUALIFICATION_FIXTURE",
            "REPLAY_BENCHMARK",
            "FIELD_OBSERVED",
        }:
            raise QualificationError("invalid evidence_class")
        if not isinstance(evidence_manifest_refs, list) or not evidence_manifest_refs:
            raise QualificationError("evidence_manifest_refs are required")
        if not all(isinstance(x, str) and x for x in evidence_manifest_refs):
            raise QualificationError("invalid evidence_manifest_refs")
        if not isinstance(fixture_mode, bool):
            raise QualificationError("fixture_mode must be boolean")

        coverage = self._case_coverage()
        seed_reports = []
        for seed in seeds:
            policy = self.lab.fit_route_policy(
                seed=seed,
                train_fraction=train_fraction,
                minimum_route_observations=minimum_route_observations,
            )
            report = self.lab.evaluate_route_policy(policy)
            seed_reports.append({
                "seed": seed,
                "policy_id": policy["policy_id"],
                "policy_hash": policy["policy_hash"],
                "report_id": report["report_id"],
                "report_hash": report["report_hash"],
                "test_cases": report["test_cases"],
                "paired_support_coverage": report["paired_support_coverage"],
                "candidate_non_tradable_breaches": report[
                    "candidate_non_tradable_breaches"
                ],
                "train_test_observation_leakage": report[
                    "train_test_observation_leakage"
                ],
                "preferred_task_classes": sorted(
                    k for k, v in policy["preferred_routes"].items() if v is not None
                ),
            })

        sfr = self._sfr_coverage(current_sfr_soft_threshold)

        min_test_cases = min((x["test_cases"] for x in seed_reports), default=0)
        min_support = min(
            (
                x["paired_support_coverage"]
                for x in seed_reports
                if x["paired_support_coverage"] is not None
            ),
            default=0.0,
        )
        breaches = sum(
            int(x["candidate_non_tradable_breaches"]) for x in seed_reports
        )
        any_leakage = any(x["train_test_observation_leakage"] for x in seed_reports)

        gates = [
            self._gate(
                "TOTAL_CASES",
                coverage["total_cases"] >= req["minimum_total_cases"],
                actual=coverage["total_cases"],
                requirement=f">={req['minimum_total_cases']}",
            ),
            self._gate(
                "TASK_CLASS_COUNT",
                coverage["task_class_count"] >= req["minimum_task_classes"],
                actual=coverage["task_class_count"],
                requirement=f">={req['minimum_task_classes']}",
            ),
            self._gate(
                "TASK_CLASS_FLOOR",
                coverage["minimum_cases_in_any_task_class"] >= req[
                    "minimum_cases_per_task_class"
                ],
                actual=coverage["minimum_cases_in_any_task_class"],
                requirement=f">={req['minimum_cases_per_task_class']}",
            ),
            self._gate(
                "PROFILE_COVERAGE",
                coverage["unique_profile_count"] >= req["minimum_unique_profiles"],
                actual=coverage["unique_profile_count"],
                requirement=f">={req['minimum_unique_profiles']}",
            ),
            self._gate(
                "MODEL_COVERAGE",
                coverage["unique_model_count"] >= req["minimum_unique_models"],
                actual=coverage["unique_model_count"],
                requirement=f">={req['minimum_unique_models']}",
            ),
            self._gate(
                "SEED_COUNT",
                len(seed_reports) >= req["minimum_seed_count"],
                actual=len(seed_reports),
                requirement=f">={req['minimum_seed_count']}",
            ),
            self._gate(
                "HELDOUT_CASE_FLOOR",
                min_test_cases >= req["minimum_test_cases_per_seed"],
                actual=min_test_cases,
                requirement=f">={req['minimum_test_cases_per_seed']}",
            ),
            self._gate(
                "PAIRED_SUPPORT_COVERAGE",
                min_support >= req["minimum_paired_support_coverage"],
                actual=min_support,
                requirement=f">={req['minimum_paired_support_coverage']}",
            ),
            self._gate(
                "NO_TRAIN_TEST_LEAKAGE",
                not any_leakage,
                actual=any_leakage,
                requirement=False,
            ),
            self._gate(
                "NON_TRADABLE_BREACHES",
                breaches <= req["maximum_candidate_non_tradable_breaches"],
                actual=breaches,
                requirement=f"<={req['maximum_candidate_non_tradable_breaches']}",
            ),
            self._gate(
                "SFR_LINKED_FLOOR",
                sfr["linked_observations"] >= req["minimum_sfr_linked_observations"],
                actual=sfr["linked_observations"],
                requirement=f">={req['minimum_sfr_linked_observations']}",
            ),
            self._gate(
                "SFR_FRONTIER_FLOOR",
                sfr["completed_frontier_investigations"] >= req[
                    "minimum_sfr_completed_frontier"
                ],
                actual=sfr["completed_frontier_investigations"],
                requirement=f">={req['minimum_sfr_completed_frontier']}",
            ),
            self._gate(
                "SFR_CRITICAL_FLOOR",
                sfr["critical_issues"] >= req["minimum_sfr_critical_issues"],
                actual=sfr["critical_issues"],
                requirement=f">={req['minimum_sfr_critical_issues']}",
            ),
            self._gate(
                "SFR_CRITICAL_MISS_RATE",
                (
                    sfr["critical_miss_rate"] is not None
                    and sfr["critical_miss_rate"] <= req["maximum_sfr_critical_miss_rate"]
                ),
                actual=sfr["critical_miss_rate"],
                requirement=f"<={req['maximum_sfr_critical_miss_rate']}",
            ),
            self._gate(
                "SFR_ESCALATION_PRECISION",
                (
                    sfr["escalation_precision"] is not None
                    and sfr["escalation_precision"] >= req[
                        "minimum_sfr_escalation_precision"
                    ]
                ),
                actual=sfr["escalation_precision"],
                requirement=f">={req['minimum_sfr_escalation_precision']}",
            ),
            self._gate(
                "SFR_GOVERNANCE",
                sfr["governance_violations"] <= req[
                    "maximum_sfr_governance_violations"
                ],
                actual=sfr["governance_violations"],
                requirement=f"<={req['maximum_sfr_governance_violations']}",
            ),
            self._gate(
                "SFR_CURRENT_THRESHOLD_SUPPORT",
                (
                    sfr["current_threshold_support_coverage"] is not None
                    and sfr["current_threshold_support_coverage"] >= req[
                        "minimum_current_threshold_support_coverage"
                    ]
                ),
                actual=sfr["current_threshold_support_coverage"],
                requirement=f">={req['minimum_current_threshold_support_coverage']}",
            ),
        ]

        technical_ready = all(g["passed"] for g in gates)
        empirical_evidence = (
            evidence_class != "SYNTHETIC_QUALIFICATION_FIXTURE"
            and fixture_mode is False
        )
        if not technical_ready:
            status = "BLOCKED_INSUFFICIENT_EVIDENCE"
        elif not empirical_evidence:
            status = "STRUCTURAL_PASS_SYNTHETIC_ONLY"
        else:
            status = "READY_FOR_P4_EVALUATION"

        body = {
            "schema": self.SCHEMA,
            "status": status,
            "requirements": req,
            "coverage": coverage,
            "seed_reports": seed_reports,
            "sfr_coverage": sfr,
            "gates": gates,
            "technical_gates_passed": technical_ready,
            "evidence_class": evidence_class,
            "evidence_manifest_refs": sorted(set(evidence_manifest_refs)),
            "fixture_mode": fixture_mode,
            "empirical_evidence_gate_passed": empirical_evidence,
            "p3_complete_structurally": technical_ready,
            "p4_evaluation_allowed": status == "READY_FOR_P4_EVALUATION",
            "learned_weights": None,
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P3C-QUAL|" + canonical(body))
        return {
            **body,
            "qualification_id": "p3qual_" + digest[:32],
            "qualification_hash": digest,
        }

    def p4_evaluation_packet(self, qualification: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(qualification, dict) or qualification.get("schema") != self.SCHEMA:
            raise QualificationError("invalid P3-C qualification")
        body = {
            "schema": self.PACKET_SCHEMA,
            "source_qualification_id": qualification["qualification_id"],
            "source_qualification_hash": qualification["qualification_hash"],
            "status": qualification["status"],
            "p4_evaluation_allowed": qualification["p4_evaluation_allowed"],
            "eligible_task_classes": sorted(
                qualification["coverage"]["task_classes"].keys()
            ),
            "source_observation_ids": qualification["coverage"][
                "source_observation_ids"
            ],
            "source_seed_report_hashes": sorted(
                x["report_hash"] for x in qualification["seed_reports"]
            ),
            "sfr_threshold_report_hash": qualification["sfr_coverage"][
                "threshold_report_hash"
            ],
            "evidence_class": qualification["evidence_class"],
            "evidence_manifest_refs": qualification["evidence_manifest_refs"],
            "p4_required_evaluation": {
                "minimum_heldout_tasks": 400,
                "minimum_distinct_seeds": 5,
                "minimum_relative_utility_improvement": 0.05,
                "utility_confidence_interval": "95_PERCENT_LOWER_BOUND_MUST_BE_POSITIVE",
                "governance_violations": 0,
                "critical_miss_rate": "MUST_NOT_REGRESS",
                "latency": "MUST_MEET_DECLARED_TASK_CLASS_THRESHOLD",
                "operator_activation_required": True,
                "rollback_snapshot_required": True,
                "automatic_activation_forbidden": True,
            },
            "candidate_learning_mode": "P4_SHADOW_CANDIDATE_ONLY",
            "activation_allowed": False,
            "operator_activation_required": True,
            "rollback_required": True,
            "learned_weights": None,
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P4-EVAL-PACKET|" + canonical(body))
        return {
            **body,
            "packet_id": "p4eval_" + digest[:32],
            "packet_hash": digest,
        }
