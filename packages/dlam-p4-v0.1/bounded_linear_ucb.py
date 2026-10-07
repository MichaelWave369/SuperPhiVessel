from __future__ import annotations

import hashlib
import json
import math
from collections import Counter, defaultdict
from typing import Any

from dlam_store import ValidationError, canonical, sha256_text
from routing_observatory import RoutingObservatory


class LearnerError(ValidationError):
    pass


FEATURE_SCHEMA = "p4a-pre-route-24-v0.1"
SNAPSHOT_SCHEMA = "superphivessel.dlam.p4a.linear-ucb-snapshot.v0.1"
PLAN_SCHEMA = "superphivessel.dlam.p4a.shadow-plan.v0.1"

FEATURE_NAMES = [
    "bias",
    "specialization_affinity",
    "model_local",
    "context_capacity",
    "vram_efficiency",
    "priority_preference",
    "route_support",
    "capability_breadth",
    *[f"profile_hash_{i}" for i in range(8)],
    *[f"model_hash_{i}" for i in range(8)],
]

if len(FEATURE_NAMES) != 24:
    raise RuntimeError("P4-A feature schema must remain exactly 24 features")


def _clip01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _hash_bucket(value: str, buckets: int = 8) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % buckets


def _round_matrix(matrix: list[list[float]]) -> list[list[float]]:
    return [[round(float(x), 12) for x in row] for row in matrix]


def _round_vector(vector: list[float]) -> list[float]:
    return [round(float(x), 12) for x in vector]


def _invert(matrix: list[list[float]]) -> list[list[float]]:
    n = len(matrix)
    if n == 0 or any(len(row) != n for row in matrix):
        raise LearnerError("matrix must be non-empty and square")
    aug = [
        [float(x) for x in matrix[i]]
        + [1.0 if i == j else 0.0 for j in range(n)]
        for i in range(n)
    ]
    eps = 1e-12
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < eps:
            raise LearnerError("ridge matrix is singular")
        if pivot != col:
            aug[col], aug[pivot] = aug[pivot], aug[col]
        scale = aug[col][col]
        aug[col] = [x / scale for x in aug[col]]
        for row in range(n):
            if row == col:
                continue
            factor = aug[row][col]
            if abs(factor) < eps:
                continue
            aug[row] = [
                aug[row][j] - factor * aug[col][j]
                for j in range(2 * n)
            ]
    return [row[n:] for row in aug]


def _mat_vec(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [
        sum(float(a) * float(b) for a, b in zip(row, vector))
        for row in matrix
    ]


def _dot(a: list[float], b: list[float]) -> float:
    return sum(float(x) * float(y) for x, y in zip(a, b))


class BoundedLinearUCB:
    """P4-A deterministic bounded linear-UCB shadow candidate.

    The learner only uses pre-route metadata and training-only support counts.
    Hard eligibility remains owned by P1-C. This class has no activation method.
    """

    POLICY_VERSION = "p4a-bounded-linear-ucb-v0.1"

    def __init__(self, observatory: RoutingObservatory) -> None:
        self.observatory = observatory
        self.runtime = observatory.runtime
        self.conn = observatory.conn
        self.genius_profiles = observatory.genius_profiles
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS p4a_snapshots(
              snapshot_id TEXT PRIMARY KEY,
              snapshot_hash TEXT NOT NULL UNIQUE,
              source_qualification_id TEXT NOT NULL,
              evidence_class TEXT NOT NULL,
              parent_snapshot_ref TEXT NOT NULL,
              snapshot_json TEXT NOT NULL
            );
            """
        )
        self.conn.commit()

    def _observation(self, observation_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT observation_json FROM p3_route_observations WHERE observation_id=?",
            (observation_id,),
        ).fetchone()
        if row is None:
            raise LearnerError(f"unknown P3 observation: {observation_id}")
        return json.loads(row["observation_json"])

    @staticmethod
    def route_signature(profile_ref: str, model_ref: str) -> str:
        return profile_ref + "|" + model_ref

    @staticmethod
    def route_key(task_class: str, profile_ref: str, model_ref: str) -> str:
        return task_class + "|" + BoundedLinearUCB.route_signature(profile_ref, model_ref)

    def _features(
        self,
        *,
        task_tags: list[str],
        profile_ref: str,
        model_ref: str,
        route_support: int,
        support_cap: int,
    ) -> list[float]:
        if profile_ref not in self.genius_profiles:
            raise LearnerError(f"unknown Genius profile: {profile_ref}")
        model = self.runtime.get_model(model_ref)
        identity = model["identity"]

        affinity = self.observatory._affinity(profile_ref, task_tags)
        locality = 1.0 if model["locality"] == "LOCAL" else 0.0
        context_capacity = _clip01(model["context_window"] / 131072.0)
        vram_efficiency = 1.0 - _clip01(model["max_vram_mb"] / 24576.0)
        priority = int(model["priority"])
        priority_preference = 1.0 if priority <= 0 else 1.0 / (1.0 + priority)
        support = _clip01(route_support / max(1, support_cap))
        capability_breadth = _clip01(len(identity["capabilities"]) / 16.0)

        features = [
            1.0,
            affinity,
            locality,
            context_capacity,
            vram_efficiency,
            priority_preference,
            support,
            capability_breadth,
        ]
        p_bucket = _hash_bucket(profile_ref)
        m_bucket = _hash_bucket(model_ref)
        features.extend([1.0 if i == p_bucket else 0.0 for i in range(8)])
        features.extend([1.0 if i == m_bucket else 0.0 for i in range(8)])
        if len(features) != 24:
            raise LearnerError("feature vector length drift")
        return features

    @staticmethod
    def _reward(
        observation: dict[str, Any],
        *,
        latency_ref_ms: int,
        cost_ref_micros: int,
        token_ref: int,
    ) -> float:
        if observation["governance_violation"] or observation["critical_miss"]:
            raise LearnerError("non-tradable breach cannot receive a trainable reward")
        latency_eff = 1.0 - _clip01(observation["latency_ms"] / max(1, latency_ref_ms))
        cost_eff = 1.0 - _clip01(
            observation["estimated_cost_micros"] / max(1, cost_ref_micros)
        )
        token_eff = 1.0 - _clip01(
            observation["context_tokens"] / max(1, token_ref)
        )
        calibration = 1.0 - _clip01(observation["brier_score"])
        reward = (
            0.35 * float(observation["quality_score"])
            + 0.25 * (1.0 if observation["success"] else 0.0)
            + 0.15 * (1.0 if observation["evidence_satisfied"] else 0.0)
            + 0.10 * calibration
            + 0.05 * (0.0 if observation["user_correction"] else 1.0)
            + 0.05 * latency_eff
            + 0.03 * cost_eff
            + 0.02 * token_eff
        )
        return _clip01(reward)

    @staticmethod
    def _validate_source(
        qualification: dict[str, Any],
        p4_packet: dict[str, Any],
    ) -> None:
        if qualification.get("schema") != "superphivessel.dlam.p3c.qualification.v0.1":
            raise LearnerError("invalid P3-C qualification")
        if p4_packet.get("schema") != "superphivessel.dlam.p4.evaluation-packet.v0.1":
            raise LearnerError("invalid P4 evaluation packet")
        if p4_packet.get("source_qualification_id") != qualification.get("qualification_id"):
            raise LearnerError("P4 packet qualification ID mismatch")
        if p4_packet.get("source_qualification_hash") != qualification.get("qualification_hash"):
            raise LearnerError("P4 packet qualification hash mismatch")
        if p4_packet.get("activation_allowed") is not False:
            raise LearnerError("source P4 packet illegally allows activation")
        if p4_packet.get("authority_granted") is not False:
            raise LearnerError("source P4 packet illegally grants authority")

    def train_snapshot(
        self,
        *,
        qualification: dict[str, Any],
        p4_packet: dict[str, Any],
        training_observation_ids: list[str],
        parent_snapshot_ref: str = "P1C_STATIC",
        ridge_lambda: float = 1.0,
        ucb_alpha: float = 0.15,
        minimum_route_support: int = 3,
        support_cap: int = 100,
        latency_ref_ms: int = 5000,
        cost_ref_micros: int = 100000,
        token_ref: int = 8192,
    ) -> dict[str, Any]:
        self._validate_source(qualification, p4_packet)
        if not isinstance(training_observation_ids, list) or not training_observation_ids:
            raise LearnerError("training_observation_ids must be non-empty")
        if len(set(training_observation_ids)) != len(training_observation_ids):
            raise LearnerError("duplicate training observation ID")
        allowed = set(p4_packet.get("source_observation_ids", []))
        if not set(training_observation_ids).issubset(allowed):
            raise LearnerError("training observation is outside the P3-C evidence frontier")
        if not isinstance(parent_snapshot_ref, str) or not parent_snapshot_ref:
            raise LearnerError("parent_snapshot_ref is required")
        if parent_snapshot_ref != "P1C_STATIC":
            row = self.conn.execute(
                "SELECT 1 FROM p4a_snapshots WHERE snapshot_id=?",
                (parent_snapshot_ref,),
            ).fetchone()
            if row is None:
                raise LearnerError("unknown parent snapshot")
        if isinstance(ridge_lambda, bool) or not isinstance(ridge_lambda, (int, float)) or ridge_lambda <= 0:
            raise LearnerError("ridge_lambda must be positive")
        if isinstance(ucb_alpha, bool) or not isinstance(ucb_alpha, (int, float)) or ucb_alpha < 0:
            raise LearnerError("ucb_alpha must be non-negative")
        for name, value in {
            "minimum_route_support": minimum_route_support,
            "support_cap": support_cap,
            "latency_ref_ms": latency_ref_ms,
            "cost_ref_micros": cost_ref_micros,
            "token_ref": token_ref,
        }.items():
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                raise LearnerError(f"{name} must be a positive integer")

        observations = [
            self._observation(x) for x in sorted(training_observation_ids)
        ]
        route_support = Counter(
            self.route_key(o["task_class"], o["profile_ref"], o["model_ref"])
            for o in observations
        )
        blocked_route_keys = sorted({
            self.route_key(o["task_class"], o["profile_ref"], o["model_ref"])
            for o in observations
            if o["governance_violation"] or o["critical_miss"]
        })

        by_class: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for obs in observations:
            by_class[obs["task_class"]].append(obs)

        class_models: dict[str, Any] = {}
        for task_class in sorted(by_class):
            clean = [
                o for o in by_class[task_class]
                if not o["governance_violation"] and not o["critical_miss"]
            ]
            if not clean:
                continue
            dim = len(FEATURE_NAMES)
            gram = [[0.0 for _ in range(dim)] for _ in range(dim)]
            target = [0.0 for _ in range(dim)]

            for obs in clean:
                key = self.route_key(
                    obs["task_class"], obs["profile_ref"], obs["model_ref"]
                )
                x = self._features(
                    task_tags=list(obs.get("task_tags", [])),
                    profile_ref=obs["profile_ref"],
                    model_ref=obs["model_ref"],
                    route_support=int(route_support[key]),
                    support_cap=support_cap,
                )
                y = self._reward(
                    obs,
                    latency_ref_ms=latency_ref_ms,
                    cost_ref_micros=cost_ref_micros,
                    token_ref=token_ref,
                )
                for i in range(dim):
                    target[i] += x[i] * y
                    for j in range(dim):
                        gram[i][j] += x[i] * x[j]

            for i in range(dim):
                gram[i][i] += float(ridge_lambda)
            inverse = _invert(gram)
            theta = _mat_vec(inverse, target)
            class_models[task_class] = {
                "observations": len(clean),
                "theta": _round_vector(theta),
                "inverse_gram": _round_matrix(inverse),
            }

        empirical_source = (
            qualification.get("status") == "READY_FOR_P4_EVALUATION"
            and qualification.get("p4_evaluation_allowed") is True
            and p4_packet.get("p4_evaluation_allowed") is True
            and qualification.get("evidence_class") != "SYNTHETIC_QUALIFICATION_FIXTURE"
        )
        status = (
            "EMPIRICAL_SHADOW_CANDIDATE"
            if empirical_source
            else "STRUCTURAL_FIXTURE_CANDIDATE"
        )

        body = {
            "schema": SNAPSHOT_SCHEMA,
            "policy_version": self.POLICY_VERSION,
            "feature_schema": FEATURE_SCHEMA,
            "feature_names": FEATURE_NAMES,
            "status": status,
            "source_qualification_id": qualification["qualification_id"],
            "source_qualification_hash": qualification["qualification_hash"],
            "source_p4_packet_id": p4_packet["packet_id"],
            "source_p4_packet_hash": p4_packet["packet_hash"],
            "source_evidence_class": qualification["evidence_class"],
            "training_observation_ids": sorted(training_observation_ids),
            "parent_snapshot_ref": parent_snapshot_ref,
            "rollback_target_ref": parent_snapshot_ref,
            "hyperparameters": {
                "ridge_lambda": float(ridge_lambda),
                "ucb_alpha": float(ucb_alpha),
                "minimum_route_support": minimum_route_support,
                "support_cap": support_cap,
                "latency_ref_ms": latency_ref_ms,
                "cost_ref_micros": cost_ref_micros,
                "token_ref": token_ref,
            },
            "reward_weights": {
                "quality": 0.35,
                "success": 0.25,
                "evidence_satisfied": 0.15,
                "calibration": 0.10,
                "no_user_correction": 0.05,
                "latency_efficiency": 0.05,
                "cost_efficiency": 0.03,
                "token_efficiency": 0.02,
            },
            "task_class_models": class_models,
            "route_support": dict(sorted(route_support.items())),
            "blocked_route_keys": blocked_route_keys,
            "empirical_source_gate_passed": empirical_source,
            "evaluation_mode": "SHADOW_ONLY",
            "activation_allowed": False,
            "automatic_activation_forbidden": True,
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "may_grant_authority": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P4A-SNAPSHOT|" + canonical(body))
        snapshot = {
            **body,
            "snapshot_id": "p4snap_" + digest[:32],
            "snapshot_hash": digest,
        }
        self.conn.execute(
            """
            INSERT OR IGNORE INTO p4a_snapshots(
              snapshot_id,snapshot_hash,source_qualification_id,evidence_class,
              parent_snapshot_ref,snapshot_json
            ) VALUES(?,?,?,?,?,?)
            """,
            (
                snapshot["snapshot_id"],
                digest,
                qualification["qualification_id"],
                qualification["evidence_class"],
                parent_snapshot_ref,
                canonical(snapshot),
            ),
        )
        self.conn.commit()
        return snapshot

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT snapshot_json FROM p4a_snapshots WHERE snapshot_id=?",
            (snapshot_id,),
        ).fetchone()
        if row is None:
            raise LearnerError("unknown P4-A snapshot")
        return json.loads(row["snapshot_json"])

    def _profile_shortlist(
        self,
        *,
        task_tags: list[str],
        candidate_profile_refs: list[str] | None,
        max_profiles: int,
    ) -> list[dict[str, Any]]:
        if not isinstance(max_profiles, int) or not 1 <= max_profiles <= 8:
            raise LearnerError("max_profiles must be between 1 and 8")
        if not isinstance(task_tags, list) or len(task_tags) > 32 or not all(
            isinstance(x, str) and x for x in task_tags
        ):
            raise LearnerError("invalid task_tags")
        if candidate_profile_refs is not None:
            if not candidate_profile_refs or len(candidate_profile_refs) > 8:
                raise LearnerError("candidate_profile_refs must contain 1..8 profiles")
            refs = list(dict.fromkeys(candidate_profile_refs))
            for ref in refs:
                if ref not in self.genius_profiles:
                    raise LearnerError(f"unknown Genius profile: {ref}")
        else:
            refs = list(self.genius_profiles)

        ranked = [
            {
                "profile_ref": ref,
                "specialization_affinity": self.observatory._affinity(ref, task_tags),
            }
            for ref in refs
        ]
        ranked.sort(
            key=lambda x: (-x["specialization_affinity"], x["profile_ref"])
        )
        return ranked[:max_profiles]

    def shadow_plan(
        self,
        snapshot: dict[str, Any],
        *,
        task_class: str,
        task_tags: list[str],
        authority_status: str,
        required_capabilities: list[str],
        preferred_capabilities: list[str] | None = None,
        local_only: bool = True,
        minimum_context_tokens: int = 0,
        max_vram_mb: int | None = None,
        allowed_model_refs: list[str] | None = None,
        candidate_profile_refs: list[str] | None = None,
        max_profiles: int = 4,
        max_routes: int = 8,
    ) -> dict[str, Any]:
        if snapshot.get("schema") != SNAPSHOT_SCHEMA:
            raise LearnerError("invalid P4-A snapshot")
        if snapshot.get("activation_allowed") is not False:
            raise LearnerError("P4-A snapshot illegally allows activation")
        if not isinstance(max_routes, int) or not 1 <= max_routes <= 8:
            raise LearnerError("max_routes must be between 1 and 8")

        if authority_status not in {"CURRENT", "STALE", "DENIED"}:
            raise LearnerError("invalid authority_status")
        if authority_status != "CURRENT":
            return {
                "schema": PLAN_SCHEMA,
                "disposition": "HELD" if authority_status == "STALE" else "DENIED",
                "snapshot_id": snapshot["snapshot_id"],
                "task_class": task_class,
                "profile_shortlist": [],
                "route_candidates": [],
                "shadow_selected_route": None,
                "selection_is_live": False,
                "may_activate_genius": False,
                "authority_granted": False,
            }

        profiles = self._profile_shortlist(
            task_tags=task_tags,
            candidate_profile_refs=candidate_profile_refs,
            max_profiles=max_profiles,
        )

        route_candidates = []
        for profile in profiles:
            plan = self.runtime.plan_static_route(
                profile_ref=profile["profile_ref"],
                authority_status=authority_status,
                required_capabilities=required_capabilities,
                preferred_capabilities=preferred_capabilities,
                local_only=local_only,
                minimum_context_tokens=minimum_context_tokens,
                max_vram_mb=max_vram_mb,
                allowed_model_refs=allowed_model_refs,
            )
            if plan["disposition"] != "PLANNED":
                continue
            for candidate in plan["eligible_candidates"]:
                route_candidates.append({
                    "profile_ref": profile["profile_ref"],
                    "specialization_affinity": profile["specialization_affinity"],
                    **candidate,
                })

        route_candidates.sort(
            key=lambda x: (
                -x["specialization_affinity"],
                -x["preferred_matches"],
                x["priority"],
                x["max_vram_mb"],
                x["profile_ref"],
                x["model_ref"],
            )
        )
        route_candidates = route_candidates[:max_routes]

        class_model = snapshot["task_class_models"].get(task_class)
        hp = snapshot["hyperparameters"]
        blocked_keys = set(snapshot["blocked_route_keys"])
        scored = []
        for candidate in route_candidates:
            key = self.route_key(
                task_class, candidate["profile_ref"], candidate["model_ref"]
            )
            support = int(snapshot["route_support"].get(key, 0))
            blocked = key in blocked_keys
            sufficient = support >= int(hp["minimum_route_support"])
            learned_eligible = bool(class_model) and sufficient and not blocked

            predicted = None
            uncertainty = None
            ucb = None
            feature_receipt = None
            if class_model is not None:
                x = self._features(
                    task_tags=task_tags,
                    profile_ref=candidate["profile_ref"],
                    model_ref=candidate["model_ref"],
                    route_support=support,
                    support_cap=int(hp["support_cap"]),
                )
                predicted = _clip01(_dot(class_model["theta"], x))
                inv_x = _mat_vec(class_model["inverse_gram"], x)
                uncertainty = math.sqrt(max(0.0, _dot(x, inv_x)))
                ucb = predicted + float(hp["ucb_alpha"]) * uncertainty
                feature_hash = sha256_text(
                    "PV-DLAM-P4A-FEATURES|" + canonical({
                        "schema": FEATURE_SCHEMA,
                        "task_class": task_class,
                        "profile_ref": candidate["profile_ref"],
                        "model_ref": candidate["model_ref"],
                        "features": _round_vector(x),
                    })
                )
                feature_receipt = "p4feat_" + feature_hash[:32] + ":" + feature_hash

            scored.append({
                **candidate,
                "route_signature": self.route_signature(
                    candidate["profile_ref"], candidate["model_ref"]
                ),
                "training_support": support,
                "blocked_by_non_tradable_breach": blocked,
                "minimum_support_satisfied": sufficient,
                "learned_eligible": learned_eligible,
                "predicted_utility": (
                    None if predicted is None else round(predicted, 12)
                ),
                "uncertainty": (
                    None if uncertainty is None else round(uncertainty, 12)
                ),
                "ucb_score": None if ucb is None else round(ucb, 12),
                "feature_receipt": feature_receipt,
                "activation_status": "SHADOW_ONLY_DORMANT",
                "authority": "NONE",
            })

        eligible_scored = [x for x in scored if x["learned_eligible"]]
        eligible_scored.sort(
            key=lambda x: (
                -float(x["ucb_score"]),
                -float(x["predicted_utility"]),
                x["profile_ref"],
                x["model_ref"],
            )
        )
        selected = eligible_scored[0] if eligible_scored else None

        body = {
            "schema": PLAN_SCHEMA,
            "disposition": (
                "SHADOW_RECOMMENDATION" if selected else "NO_SUPPORTED_LEARNED_ROUTE"
            ),
            "snapshot_id": snapshot["snapshot_id"],
            "snapshot_hash": snapshot["snapshot_hash"],
            "task_class": task_class,
            "task_tags": list(task_tags),
            "profile_shortlist": profiles,
            "route_candidates": scored,
            "shadow_selected_route": (
                None if selected is None else {
                    "profile_ref": selected["profile_ref"],
                    "model_ref": selected["model_ref"],
                    "route_signature": selected["route_signature"],
                    "predicted_utility": selected["predicted_utility"],
                    "uncertainty": selected["uncertainty"],
                    "ucb_score": selected["ucb_score"],
                    "training_support": selected["training_support"],
                }
            ),
            "live_router_remains": "P1C_STATIC",
            "selection_is_live": False,
            "may_activate_genius": False,
            "may_change_live_route": False,
            "may_change_live_thresholds": False,
            "authority_granted": False,
        }
        digest = sha256_text("PV-DLAM-P4A-PLAN|" + canonical(body))
        return {
            **body,
            "plan_id": "p4plan_" + digest[:32],
            "plan_hash": digest,
        }
