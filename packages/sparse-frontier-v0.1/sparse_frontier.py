from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

# The acceptance/runtime host adds the existing P1 package directory to
# sys.path. SFR deliberately reuses those contracts instead of forking them.
from dlam_store import ValidationError, canonical, sha256_text
from p1c_runtime import P1CRuntime


SIGNAL_FIELDS = {
    "novelty",
    "state_change_magnitude",
    "consequence",
    "provenance_gap",
    "missing_evidence",
    "irreversible_risk",
    "disagreement",
    "routing_confidence",
}
AUTHORITY_STATUS = {"CURRENT", "STALE", "DENIED"}
NBG_STATUS = {"DISABLED", "DETERMINISTIC_PROJECTED", "LEARNED_EXPERIMENTAL"}

_WORD = re.compile(r"[a-z0-9]+")
_STOP = {
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


def _tokens(value: str) -> set[str]:
    return {x for x in _WORD.findall(value.lower()) if len(x) > 2 and x not in _STOP}


class SparseFrontierRouter:
    """Sparse Frontier Routing v0.1 (internal nickname: Spider Layer).

    This is a deterministic escalation gate and telemetry layer. It does not
    invoke a frontier model, learn thresholds, activate a Genius, or grant
    authority. It answers a narrower question:

        Does this candidate decision deserve deeper investigation?

    Expensive attention remains sparse. The evidence needed to learn better
    escalation thresholds is recorded for later P3/P4 shadow qualification.
    """

    SCHEMA = "superphivessel.sparse-frontier.v0.1"
    POLICY_VERSION = "sfr-static-policy-v0.1"

    # Initial deterministic baseline, intentionally versioned and replaceable.
    # These are not claimed to be optimal learned thresholds.
    SOFT_THRESHOLD = 0.62
    HARD_IRREVERSIBLE = 0.85

    WEIGHTS = {
        "uncertainty": 0.19,
        "novelty": 0.11,
        "state_change_magnitude": 0.07,
        "consequence": 0.13,
        "provenance_gap": 0.09,
        "missing_evidence": 0.10,
        "disagreement": 0.08,
        "routing_uncertainty": 0.07,
        "prior_failure_rate": 0.06,
        "memory_inconsistency": 0.05,
        "deterministic_nbg": 0.05,
    }

    def __init__(self, runtime: P1CRuntime) -> None:
        self.runtime = runtime
        self.store = runtime.store
        self.conn = runtime.conn
        self.genius_profiles = runtime.genius_profiles
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sfr_decisions(
              decision_id TEXT PRIMARY KEY,
              candidate_id TEXT NOT NULL,
              task_id TEXT NOT NULL,
              disposition TEXT NOT NULL,
              escalated INTEGER NOT NULL CHECK(escalated IN (0,1)),
              score REAL NOT NULL,
              decision_hash TEXT NOT NULL UNIQUE,
              decision_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sfr_outcomes(
              outcome_id TEXT PRIMARY KEY,
              decision_id TEXT NOT NULL UNIQUE REFERENCES sfr_decisions(decision_id),
              frontier_used INTEGER NOT NULL CHECK(frontier_used IN (0,1)),
              changed_decision INTEGER NOT NULL CHECK(changed_decision IN (0,1)),
              discovered_missing_evidence INTEGER NOT NULL CHECK(discovered_missing_evidence IN (0,1)),
              caught_critical_issue INTEGER NOT NULL CHECK(caught_critical_issue IN (0,1)),
              critical_issue_present INTEGER NOT NULL CHECK(critical_issue_present IN (0,1)),
              eventual_success INTEGER NOT NULL CHECK(eventual_success IN (0,1)),
              governance_violation INTEGER NOT NULL CHECK(governance_violation IN (0,1)),
              latency_ms INTEGER NOT NULL,
              context_tokens INTEGER NOT NULL,
              estimated_cost_micros INTEGER NOT NULL,
              outcome_hash TEXT NOT NULL UNIQUE,
              outcome_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sfr_decision_task
              ON sfr_decisions(task_id);
            CREATE INDEX IF NOT EXISTS idx_sfr_decision_escalated
              ON sfr_decisions(escalated);
            """
        )
        self.conn.commit()

    def _validate_candidate(self, candidate: dict[str, Any]) -> None:
        required = {
            "candidate_id", "task_id", "cheap_prediction", "cheap_confidence",
            "memory_refs", "evidence_refs", "state_changes", "task_tags",
            "signals", "authority_decision_ref", "authority_status",
            "frontier_token_budget",
        }
        missing = sorted(required - candidate.keys())
        if missing:
            raise ValidationError("SFR candidate missing: " + ", ".join(missing))

        for field in ("candidate_id", "task_id", "authority_decision_ref"):
            if not isinstance(candidate[field], str) or not candidate[field]:
                raise ValidationError(f"{field} must be a non-empty string")
        if candidate["authority_status"] not in AUTHORITY_STATUS:
            raise ValidationError("invalid authority_status")
        if not isinstance(candidate["cheap_prediction"], dict):
            raise ValidationError("cheap_prediction must be an object")
        _unit(candidate["cheap_confidence"], "cheap_confidence")
        if not isinstance(candidate["frontier_token_budget"], int) or isinstance(candidate["frontier_token_budget"], bool) or candidate["frontier_token_budget"] < 0:
            raise ValidationError("frontier_token_budget must be a non-negative integer")

        for field in ("memory_refs", "evidence_refs", "state_changes", "task_tags"):
            if not isinstance(candidate[field], list):
                raise ValidationError(f"{field} must be a list")
        if len(candidate["memory_refs"]) > 64 or len(candidate["evidence_refs"]) > 64:
            raise ValidationError("SFR region refs exceed v0.1 bound")
        if len(candidate["state_changes"]) > 32 or len(candidate["task_tags"]) > 32:
            raise ValidationError("SFR state/tag list exceeds v0.1 bound")
        if not all(isinstance(x, str) and x for x in candidate["memory_refs"] + candidate["evidence_refs"] + candidate["task_tags"]):
            raise ValidationError("refs and task_tags must contain non-empty strings")
        if not all(isinstance(x, dict) for x in candidate["state_changes"]):
            raise ValidationError("state_changes entries must be objects")

        signals = candidate["signals"]
        if not isinstance(signals, dict):
            raise ValidationError("signals must be an object")
        missing_signals = sorted(SIGNAL_FIELDS - signals.keys())
        if missing_signals:
            raise ValidationError("signals missing: " + ", ".join(missing_signals))
        for name in SIGNAL_FIELDS:
            _unit(signals[name], name)
        for name in ("governance_concern", "authority_boundary"):
            if not isinstance(signals.get(name, False), bool):
                raise ValidationError(f"{name} must be boolean")

        nbg = candidate.get("nbg", {"status": "DISABLED"})
        if not isinstance(nbg, dict) or nbg.get("status") not in NBG_STATUS:
            raise ValidationError("invalid NBG signal status")
        if nbg.get("status") == "DETERMINISTIC_PROJECTED":
            if not isinstance(nbg.get("temporal_divergence", False), bool):
                raise ValidationError("temporal_divergence must be boolean")
            deps = nbg.get("unresolved_dependencies", 0)
            if not isinstance(deps, int) or isinstance(deps, bool) or deps < 0:
                raise ValidationError("unresolved_dependencies must be non-negative integer")
        if nbg.get("status") == "LEARNED_EXPERIMENTAL":
            anomaly = nbg.get("activation_anomaly", 0.0)
            _unit(anomaly, "activation_anomaly")

        cheap_model_ref = candidate.get("cheap_model_ref")
        cheap_route_decision_id = candidate.get("cheap_route_decision_id")
        if cheap_model_ref is not None:
            self.runtime.get_model(cheap_model_ref)
        if cheap_route_decision_id is not None:
            row = self.conn.execute(
                "SELECT model_ref FROM p1c_route_receipts WHERE decision_id=?",
                (cheap_route_decision_id,),
            ).fetchone()
            if row is None:
                raise ValidationError("unknown cheap_route_decision_id")
            if cheap_model_ref is not None and row["model_ref"] != cheap_model_ref:
                raise ValidationError("cheap route/model identity mismatch")

    def _memory_signals(self, memory_refs: list[str]) -> dict[str, Any]:
        contradictions: set[tuple[str, str]] = set()
        missing_provenance = 0
        active = 0
        for mid in sorted(set(memory_refs)):
            record = self.store.get_memory(mid)
            if record is None or record["tombstoned"] or record["blocked"]:
                continue
            active += 1
            for other in self.store.relation_refs(mid, "CONTRADICTS"):
                contradictions.add(tuple(sorted((mid, other))))
            prov = set(self.store.derivation_parent_refs(mid))
            prov.update(self.store.relation_refs(mid, "EVIDENCE"))
            if record["origin"] in {"INFERRED", "VERIFIED"} and not prov:
                missing_provenance += 1
        contradiction_count = len(contradictions)
        memory_inconsistency = min(1.0, contradiction_count / max(1, active))
        inferred_gap = min(1.0, missing_provenance / max(1, active))
        return {
            "active_memory_refs": active,
            "contradiction_count": contradiction_count,
            "memory_inconsistency": memory_inconsistency,
            "inferred_provenance_gap": inferred_gap,
        }

    def _prior_failure_rate(self, model_ref: str | None) -> tuple[float, int]:
        if not model_ref:
            return 0.0, 0
        rows = self.conn.execute(
            "SELECT success FROM p1c_route_outcomes WHERE model_ref=?",
            (model_ref,),
        ).fetchall()
        if not rows:
            return 0.0, 0
        failures = sum(1 for r in rows if int(r["success"]) == 0)
        return failures / len(rows), len(rows)

    def _nbg_signal(self, candidate: dict[str, Any]) -> tuple[float, dict[str, Any]]:
        nbg = dict(candidate.get("nbg", {"status": "DISABLED"}))
        status = nbg.get("status", "DISABLED")
        if status == "DETERMINISTIC_PROJECTED":
            temporal = 1.0 if nbg.get("temporal_divergence", False) else 0.0
            deps = min(1.0, float(nbg.get("unresolved_dependencies", 0)) / 3.0)
            return max(temporal, deps), {
                **nbg,
                "score_effect": "ENABLED_DETERMINISTIC",
            }
        if status == "LEARNED_EXPERIMENTAL":
            return 0.0, {
                **nbg,
                "score_effect": "LOG_ONLY_NOT_ROUTING",
            }
        return 0.0, {"status": "DISABLED", "score_effect": "NONE"}

    def recommend_geniuses(
        self,
        task_tags: list[str],
        *,
        max_count: int = 3,
        preferred_profile_refs: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        if not isinstance(max_count, int) or not 1 <= max_count <= 8:
            raise ValidationError("max_count must be between 1 and 8")
        tags = set()
        for tag in task_tags:
            tags.update(_tokens(tag))
        preferred = set(preferred_profile_refs or [])
        unknown = preferred - set(self.genius_profiles)
        if unknown:
            raise ValidationError("unknown preferred Genius: " + ", ".join(sorted(unknown)))

        ranked: list[tuple[int, str, dict[str, Any], list[str]]] = []
        for profile_ref, profile in self.genius_profiles.items():
            text = " ".join([
                profile.get("label", ""),
                profile.get("category", ""),
                profile.get("routingEmphasis", ""),
            ])
            words = _tokens(text)
            matched = sorted(tags & words)
            score = len(matched) * 10 + (100 if profile_ref in preferred else 0)
            if score > 0:
                ranked.append((score, profile_ref, profile, matched))
        ranked.sort(key=lambda x: (-x[0], x[1]))
        return [
            {
                "profile_ref": ref,
                "label": profile["label"],
                "category": profile["category"],
                "matched_tags": matched,
                "activation_status": "RECOMMENDED_DORMANT",
                "authority": "NONE",
            }
            for _, ref, profile, matched in ranked[:max_count]
        ]

    def assess(self, candidate: dict[str, Any]) -> dict[str, Any]:
        self._validate_candidate(candidate)
        authority_status = candidate["authority_status"]
        signals = candidate["signals"]
        cheap_confidence = _unit(candidate["cheap_confidence"], "cheap_confidence")
        memory = self._memory_signals(candidate["memory_refs"])
        prior_failure, prior_observations = self._prior_failure_rate(candidate.get("cheap_model_ref"))
        nbg_score, nbg_receipt = self._nbg_signal(candidate)

        uncertainty = 1.0 - cheap_confidence
        provenance_gap = max(
            _unit(signals["provenance_gap"], "provenance_gap"),
            memory["inferred_provenance_gap"],
        )
        features = {
            "uncertainty": uncertainty,
            "novelty": _unit(signals["novelty"], "novelty"),
            "state_change_magnitude": _unit(signals["state_change_magnitude"], "state_change_magnitude"),
            "consequence": _unit(signals["consequence"], "consequence"),
            "provenance_gap": provenance_gap,
            "missing_evidence": _unit(signals["missing_evidence"], "missing_evidence"),
            "irreversible_risk": _unit(signals["irreversible_risk"], "irreversible_risk"),
            "disagreement": _unit(signals["disagreement"], "disagreement"),
            "routing_uncertainty": 1.0 - _unit(signals["routing_confidence"], "routing_confidence"),
            "prior_failure_rate": prior_failure,
            "memory_inconsistency": memory["memory_inconsistency"],
            "deterministic_nbg": nbg_score,
        }

        weighted = sum(
            self.WEIGHTS[name] * features[name]
            for name in self.WEIGHTS
        )
        score = min(1.0, weighted)

        hard_reasons: list[str] = []
        if signals.get("governance_concern", False):
            hard_reasons.append("GOVERNANCE_CONCERN")
        if features["irreversible_risk"] >= self.HARD_IRREVERSIBLE:
            hard_reasons.append("IRREVERSIBLE_ACTION_RISK")
        if signals.get("authority_boundary", False) and features["consequence"] >= 0.65:
            hard_reasons.append("AUTHORITY_BOUNDARY_HIGH_CONSEQUENCE")
        if memory["contradiction_count"] > 0 and (
            uncertainty >= 0.25 or features["disagreement"] >= 0.35
        ):
            hard_reasons.append("CONTRADICTION_UNDER_UNCERTAINTY")
        if features["missing_evidence"] >= 0.80 and features["consequence"] >= 0.70:
            hard_reasons.append("MISSING_EVIDENCE_HIGH_CONSEQUENCE")

        if authority_status != "CURRENT":
            disposition = "HELD" if authority_status == "STALE" else "DENIED"
            escalated = False
        else:
            escalated = bool(hard_reasons) or score >= self.SOFT_THRESHOLD
            disposition = "ESCALATE_INVESTIGATION" if escalated else "LOCAL_RESOLVE"

        trigger_reasons = list(hard_reasons)
        if escalated and not hard_reasons:
            trigger_reasons.append("COMPOSITE_FRONTIER_SCORE")

        geniuses = self.recommend_geniuses(
            candidate["task_tags"] + trigger_reasons,
            max_count=min(3, max(1, len(candidate["task_tags"]) or 1)),
            preferred_profile_refs=candidate.get("preferred_profile_refs"),
        ) if escalated else []

        region = {
            "memory_refs": sorted(set(candidate["memory_refs"])),
            "evidence_refs": sorted(set(candidate["evidence_refs"])),
            "state_changes": candidate["state_changes"],
        }
        frontier_packet = None
        if escalated:
            packet_body = {
                "schema": "superphivessel.sfr.escalation-context.v0.1",
                "task_id": candidate["task_id"],
                "candidate_id": candidate["candidate_id"],
                "trigger": trigger_reasons,
                "bounded_region": region,
                "cheap_layer_prediction": candidate["cheap_prediction"],
                "cheap_layer_confidence": cheap_confidence,
                "signals": features,
                "memory_signal_receipt": memory,
                "nbg_signal_receipt": nbg_receipt,
                "authority_decision_ref": candidate["authority_decision_ref"],
                "authority_status": authority_status,
                "frontier_role": "INVESTIGATOR_ADVISOR",
                "recommended_geniuses": geniuses,
                "routing_evidence": {
                    "cheap_model_ref": candidate.get("cheap_model_ref"),
                    "cheap_route_decision_id": candidate.get("cheap_route_decision_id"),
                    "prior_failure_rate": prior_failure,
                    "prior_observations": prior_observations,
                },
                "token_budget": candidate["frontier_token_budget"],
                "reason_for_frontier_escalation": ";".join(trigger_reasons),
                "action_authority": "NONE",
            }
            packet_hash = sha256_text("PV-SFR-CONTEXT|" + canonical(packet_body))
            frontier_packet = {
                **packet_body,
                "packet_id": "sfrctx_" + packet_hash[:32],
                "packet_hash": packet_hash,
            }

        decision_body = {
            "schema": self.SCHEMA,
            "policy_version": self.POLICY_VERSION,
            "candidate_id": candidate["candidate_id"],
            "task_id": candidate["task_id"],
            "disposition": disposition,
            "escalated": escalated,
            "frontier_score": score,
            "hard_reasons": hard_reasons,
            "features": features,
            "memory_signal_receipt": memory,
            "nbg_signal_receipt": nbg_receipt,
            "cheap_model_ref": candidate.get("cheap_model_ref"),
            "cheap_route_decision_id": candidate.get("cheap_route_decision_id"),
            "recommended_geniuses": geniuses,
            "frontier_packet_ref": (
                f"{frontier_packet['packet_id']}:{frontier_packet['packet_hash']}"
                if frontier_packet else None
            ),
            "authority_decision_ref": candidate["authority_decision_ref"],
            "authority_status": authority_status,
            "authority_granted": False,
            "threshold_learning_active": False,
        }
        decision_hash = sha256_text("PV-SFR-DECISION|" + canonical(decision_body))
        decision = {
            **decision_body,
            "decision_id": "sfr_" + decision_hash[:32],
            "decision_hash": decision_hash,
            "frontier_packet": frontier_packet,
        }

        existing = self.conn.execute(
            "SELECT decision_hash FROM sfr_decisions WHERE decision_id=?",
            (decision["decision_id"],),
        ).fetchone()
        if existing is None:
            self.conn.execute(
                """
                INSERT INTO sfr_decisions(
                  decision_id,candidate_id,task_id,disposition,escalated,score,
                  decision_hash,decision_json
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    decision["decision_id"],
                    candidate["candidate_id"],
                    candidate["task_id"],
                    disposition,
                    1 if escalated else 0,
                    score,
                    decision_hash,
                    canonical({k: v for k, v in decision.items() if k != "frontier_packet"}),
                ),
            )
            self.conn.commit()
        return decision

    def record_outcome(
        self,
        decision_id: str,
        *,
        frontier_model_ref: str | None,
        genius_profile_refs: list[str],
        frontier_conclusion_ref: str | None,
        changed_decision: bool,
        discovered_missing_evidence: bool,
        caught_critical_issue: bool,
        critical_issue_present: bool,
        eventual_success: bool,
        governance_violation: bool,
        latency_ms: int,
        context_tokens: int,
        estimated_cost_micros: int = 0,
    ) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT decision_json,escalated FROM sfr_decisions WHERE decision_id=?",
            (decision_id,),
        ).fetchone()
        if row is None:
            raise ValidationError("unknown SFR decision")
        decision = json.loads(row["decision_json"])
        frontier_used = bool(row["escalated"])

        for name, value in {
            "changed_decision": changed_decision,
            "discovered_missing_evidence": discovered_missing_evidence,
            "caught_critical_issue": caught_critical_issue,
            "critical_issue_present": critical_issue_present,
            "eventual_success": eventual_success,
            "governance_violation": governance_violation,
        }.items():
            if not isinstance(value, bool):
                raise ValidationError(f"{name} must be boolean")
        for name, value in {
            "latency_ms": latency_ms,
            "context_tokens": context_tokens,
            "estimated_cost_micros": estimated_cost_micros,
        }.items():
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                raise ValidationError(f"{name} must be a non-negative integer")
        if not isinstance(genius_profile_refs, list):
            raise ValidationError("genius_profile_refs must be a list")
        for ref in genius_profile_refs:
            if ref not in self.genius_profiles:
                raise ValidationError(f"unknown Genius profile: {ref}")
        if frontier_used:
            if frontier_model_ref is None:
                raise ValidationError("frontier escalation outcome requires frontier_model_ref")
            self.runtime.get_model(frontier_model_ref)
        elif frontier_model_ref is not None:
            raise ValidationError("local-resolution outcome cannot claim frontier model use")

        body = {
            "schema": "superphivessel.sfr.outcome.v0.1",
            "decision_id": decision_id,
            "decision_hash": decision["decision_hash"],
            "frontier_used": frontier_used,
            "frontier_model_ref": frontier_model_ref,
            "genius_profile_refs": sorted(set(genius_profile_refs)),
            "frontier_conclusion_ref": frontier_conclusion_ref,
            "changed_decision": changed_decision,
            "discovered_missing_evidence": discovered_missing_evidence,
            "caught_critical_issue": caught_critical_issue,
            "critical_issue_present": critical_issue_present,
            "eventual_success": eventual_success,
            "governance_violation": governance_violation,
            "latency_ms": latency_ms,
            "context_tokens": context_tokens,
            "estimated_cost_micros": estimated_cost_micros,
            "authority_granted": False,
            "routing_learning_effect": "OBSERVATION_ONLY",
        }
        outcome_hash = sha256_text("PV-SFR-OUTCOME|" + canonical(body))
        outcome = {
            **body,
            "outcome_id": "sfro_" + outcome_hash[:32],
            "outcome_hash": outcome_hash,
        }
        self.conn.execute(
            """
            INSERT OR REPLACE INTO sfr_outcomes(
              outcome_id,decision_id,frontier_used,changed_decision,
              discovered_missing_evidence,caught_critical_issue,
              critical_issue_present,eventual_success,governance_violation,
              latency_ms,context_tokens,estimated_cost_micros,outcome_hash,outcome_json
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                outcome["outcome_id"],
                decision_id,
                1 if frontier_used else 0,
                1 if changed_decision else 0,
                1 if discovered_missing_evidence else 0,
                1 if caught_critical_issue else 0,
                1 if critical_issue_present else 0,
                1 if eventual_success else 0,
                1 if governance_violation else 0,
                latency_ms,
                context_tokens,
                estimated_cost_micros,
                outcome_hash,
                canonical(outcome),
            ),
        )
        self.conn.commit()
        return outcome

    def metrics(self) -> dict[str, Any]:
        decisions = self.conn.execute(
            """
            SELECT disposition,escalated,decision_json
            FROM sfr_decisions
            WHERE disposition IN ('LOCAL_RESOLVE','ESCALATE_INVESTIGATION')
            """
        ).fetchall()
        outcomes = self.conn.execute(
            "SELECT * FROM sfr_outcomes"
        ).fetchall()

        total = len(decisions)
        frontier = sum(int(r["escalated"]) for r in decisions)
        local = total - frontier
        completed_frontier = [r for r in outcomes if int(r["frontier_used"]) == 1]
        useful = [
            r for r in completed_frontier
            if int(r["changed_decision"]) or int(r["discovered_missing_evidence"]) or int(r["caught_critical_issue"])
        ]
        critical = [r for r in outcomes if int(r["critical_issue_present"]) == 1]
        critical_miss = [
            r for r in critical
            if not int(r["frontier_used"]) or not int(r["caught_critical_issue"])
        ]
        frontier_critical = [
            r for r in critical if int(r["frontier_used"]) == 1
        ]
        changed = sum(int(r["changed_decision"]) for r in completed_frontier)
        unnecessary = len(completed_frontier) - len(useful)
        governance_violations = sum(int(r["governance_violation"]) for r in outcomes)
        resolved = [r for r in outcomes if int(r["eventual_success"]) == 1]

        def ratio(num: int, den: int) -> float | None:
            return None if den == 0 else num / den

        return {
            "schema": "superphivessel.sfr.metrics.v0.1",
            "total_candidate_decisions": total,
            "frontier_investigations": frontier,
            "local_resolutions": local,
            "frontier_duty_cycle": ratio(frontier, total),
            "escalation_precision": ratio(len(useful), len(completed_frontier)),
            "critical_miss_rate": ratio(len(critical_miss), len(critical)),
            "critical_escalation_recall": ratio(len(frontier_critical), len(critical)),
            "avoided_frontier_calls": local,
            "frontier_calls_changed_outcome": changed,
            "frontier_calls_unnecessary": unnecessary,
            "governance_violations": governance_violations,
            "genius_activation_count": sum(
                len(json.loads(r["outcome_json"])["genius_profile_refs"])
                for r in completed_frontier
            ),
            "context_tokens_per_escalation": (
                ratio(sum(int(r["context_tokens"]) for r in completed_frontier), len(completed_frontier))
            ),
            "latency_per_resolved_decision_ms": (
                ratio(sum(int(r["latency_ms"]) for r in resolved), len(resolved))
            ),
            "cost_micros_per_resolved_decision": (
                ratio(sum(int(r["estimated_cost_micros"]) for r in resolved), len(resolved))
            ),
            "local_vs_frontier_resolution_ratio": (
                None if frontier == 0 else local / frontier
            ),
            "optimization_statement": (
                "minimize frontier_duty_cycle subject to decision-quality evidence, "
                "critical_miss_rate bounds, governance_violations=0, and provenance requirements"
            ),
            "threshold_learning_active": False,
        }

    def routing_knowledge_snapshot(self) -> dict[str, Any]:
        rows = self.conn.execute(
            """
            SELECT d.decision_json,o.outcome_json
            FROM sfr_decisions d
            JOIN sfr_outcomes o ON o.decision_id=d.decision_id
            ORDER BY d.decision_id
            """
        ).fetchall()
        by_trigger: dict[str, Counter] = defaultdict(Counter)
        by_genius: dict[str, Counter] = defaultdict(Counter)
        by_model: dict[str, Counter] = defaultdict(Counter)

        for row in rows:
            decision = json.loads(row["decision_json"])
            outcome = json.loads(row["outcome_json"])
            useful = bool(
                outcome["changed_decision"]
                or outcome["discovered_missing_evidence"]
                or outcome["caught_critical_issue"]
            )
            triggers = decision.get("hard_reasons") or (
                ["COMPOSITE_FRONTIER_SCORE"] if decision.get("escalated") else ["LOCAL_RESOLVE"]
            )
            for trigger in triggers:
                by_trigger[trigger]["observations"] += 1
                by_trigger[trigger]["useful"] += int(useful)
            for ref in outcome["genius_profile_refs"]:
                by_genius[ref]["observations"] += 1
                by_genius[ref]["useful"] += int(useful)
            model_ref = outcome.get("frontier_model_ref")
            if model_ref:
                by_model[model_ref]["observations"] += 1
                by_model[model_ref]["useful"] += int(useful)

        def freeze(source: dict[str, Counter]) -> dict[str, dict[str, int]]:
            return {
                key: {
                    "observations": int(value["observations"]),
                    "useful": int(value["useful"]),
                }
                for key, value in sorted(source.items())
            }

        body = {
            "schema": "superphivessel.sfr.routing-knowledge.v0.1",
            "by_trigger": freeze(by_trigger),
            "by_genius": freeze(by_genius),
            "by_model": freeze(by_model),
            "learning_mode": "SHADOW_OBSERVATION_ONLY",
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        snap_hash = sha256_text("PV-SFR-KNOWLEDGE|" + canonical(body))
        return {
            **body,
            "snapshot_id": "sfrk_" + snap_hash[:32],
            "snapshot_hash": snap_hash,
        }
