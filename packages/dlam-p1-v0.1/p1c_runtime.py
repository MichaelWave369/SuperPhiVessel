from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from context_composer import ContextComposer
from dlam_store import DlamStore, ValidationError, canonical, sha256_text

MODEL_STATUS = {"QUALIFIED", "UNQUALIFIED", "DISABLED"}
AUTHORITY_STATUS = {"CURRENT", "STALE", "DENIED"}
CHECKPOINT_STATUS = {"PAUSED_FOR_SWAP", "RESUMED_AFTER_SWAP", "PAUSED", "COMPLETE"}

FORBIDDEN_CHECKPOINT_KEYS = {
    "kv_cache",
    "kvcache",
    "hidden_state",
    "hidden_states",
    "activations",
    "activation",
    "logits",
    "model_state",
    "opaque_model_state",
    "attention_cache",
    "past_key_values",
}


class NoEligibleRouteError(ValidationError):
    pass


class CheckpointError(ValidationError):
    pass


def _assert_jsonable(value: Any) -> None:
    try:
        canonical(value)
    except Exception as exc:
        raise ValidationError("value must be JSON-serializable") from exc


def _scan_forbidden_keys(value: Any, *, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            norm = str(key).strip().lower()
            if norm in FORBIDDEN_CHECKPOINT_KEYS:
                raise CheckpointError(f"opaque model state forbidden at {path}.{key}")
            _scan_forbidden_keys(child, path=f"{path}.{key}")
    elif isinstance(value, list):
        for idx, child in enumerate(value):
            _scan_forbidden_keys(child, path=f"{path}[{idx}]")


class P1CRuntime:
    """PV-DLAM P1-C static routing + task checkpoint/model-swap continuity.

    The runtime is deliberately local and deterministic:
    - it validates GA108 identities from the frozen roster;
    - it registers exact model artifacts by immutable identity hash;
    - it performs hard-filtered static routing only;
    - it finalizes P0-compatible route receipts after context composition;
    - it checkpoints task state without opaque model state;
    - it can resume a checkpoint on a different qualified model while preserving
      task/Genius/memory identity and recomposing context for the replacement.
    """

    SCHEMA = "superphivessel.dlam.p1c.v0.1"
    FEATURE_SCHEMA_VERSION = "p1c-static-features-v1"

    def __init__(
        self,
        store: DlamStore,
        *,
        genius_roster_path: str | Path,
    ) -> None:
        self.store = store
        self.conn = store.conn
        self.genius_roster_path = Path(genius_roster_path)
        self.genius_profiles = self._load_genius_roster()
        self.tokenizers: dict[str, Callable[[str], int]] = {}
        self._init_schema()

    def _load_genius_roster(self) -> dict[str, dict[str, Any]]:
        payload = json.loads(self.genius_roster_path.read_text(encoding="utf-8"))
        if payload.get("schema") != "superphivessel.genius-roster.ga108.v0.1":
            raise ValidationError("unexpected Genius roster schema")
        entries = payload.get("entries")
        if not isinstance(entries, list) or len(entries) != 108:
            raise ValidationError("canonical GA108 roster must contain 108 entries")
        profiles: dict[str, dict[str, Any]] = {}
        for entry in entries:
            profile_ref = entry.get("profileId")
            if not isinstance(profile_ref, str) or not profile_ref:
                raise ValidationError("GA108 profileId missing")
            if entry.get("authority") != "NONE":
                raise ValidationError(f"Genius authority must be NONE: {profile_ref}")
            if entry.get("modelBinding") is not None:
                raise ValidationError(f"Genius modelBinding must be null: {profile_ref}")
            if profile_ref in profiles:
                raise ValidationError(f"duplicate Genius profile: {profile_ref}")
            profiles[profile_ref] = entry
        return profiles

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS p1c_model_artifacts(
              model_ref TEXT PRIMARY KEY,
              identity_hash TEXT NOT NULL UNIQUE,
              identity_json TEXT NOT NULL,
              status TEXT NOT NULL,
              locality TEXT NOT NULL CHECK(locality IN ('LOCAL','REMOTE')),
              priority INTEGER NOT NULL,
              context_window INTEGER NOT NULL,
              max_vram_mb INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS p1c_route_receipts(
              decision_id TEXT PRIMARY KEY,
              task_id TEXT NOT NULL,
              profile_ref TEXT NOT NULL,
              model_ref TEXT NOT NULL,
              receipt_hash TEXT NOT NULL UNIQUE,
              receipt_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS p1c_task_checkpoints(
              checkpoint_id TEXT PRIMARY KEY,
              task_id TEXT NOT NULL,
              sequence INTEGER NOT NULL,
              checkpoint_hash TEXT NOT NULL UNIQUE,
              checkpoint_json TEXT NOT NULL,
              UNIQUE(task_id, sequence)
            );

            CREATE TABLE IF NOT EXISTS p1c_route_outcomes(
              outcome_id TEXT PRIMARY KEY,
              decision_id TEXT NOT NULL,
              model_ref TEXT NOT NULL,
              success INTEGER NOT NULL CHECK(success IN (0,1)),
              latency_ms INTEGER NOT NULL,
              outcome_hash TEXT NOT NULL UNIQUE,
              outcome_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_p1c_route_task
              ON p1c_route_receipts(task_id);
            CREATE INDEX IF NOT EXISTS idx_p1c_checkpoint_task_seq
              ON p1c_task_checkpoints(task_id, sequence);
            CREATE INDEX IF NOT EXISTS idx_p1c_outcome_model
              ON p1c_route_outcomes(model_ref);
            """
        )
        self.conn.commit()

    def register_tokenizer(
        self,
        tokenizer_id: str,
        counter: Callable[[str], int],
    ) -> None:
        if not isinstance(tokenizer_id, str) or not tokenizer_id:
            raise ValidationError("tokenizer_id is required")
        if not callable(counter):
            raise ValidationError("tokenizer counter must be callable")
        self.tokenizers[tokenizer_id] = counter

    @staticmethod
    def _validate_digest(name: str, value: str | None, *, optional: bool = False) -> None:
        if value is None and optional:
            return
        if not isinstance(value, str) or not value:
            raise ValidationError(f"{name} must be a non-empty digest/identity string")

    def register_model(self, spec: dict[str, Any]) -> dict[str, Any]:
        required = {
            "name",
            "provider",
            "runtime",
            "runtime_version",
            "weights_digest",
            "quantization",
            "adapter_digest",
            "prompt_template_digest",
            "tokenizer_id",
            "context_window",
            "capabilities",
            "locality",
            "priority",
            "max_vram_mb",
            "status",
        }
        missing = sorted(required - spec.keys())
        if missing:
            raise ValidationError("model spec missing: " + ", ".join(missing))

        for field in ("name", "provider", "runtime", "runtime_version", "quantization", "tokenizer_id"):
            if not isinstance(spec[field], str) or not spec[field]:
                raise ValidationError(f"{field} must be a non-empty string")
        self._validate_digest("weights_digest", spec["weights_digest"])
        self._validate_digest("adapter_digest", spec["adapter_digest"], optional=True)
        self._validate_digest("prompt_template_digest", spec["prompt_template_digest"])
        if spec["locality"] not in {"LOCAL", "REMOTE"}:
            raise ValidationError("locality must be LOCAL or REMOTE")
        if spec["status"] not in MODEL_STATUS:
            raise ValidationError("invalid model status")
        if not isinstance(spec["priority"], int) or isinstance(spec["priority"], bool):
            raise ValidationError("priority must be an integer")
        for field in ("context_window", "max_vram_mb"):
            if not isinstance(spec[field], int) or isinstance(spec[field], bool) or spec[field] < 0:
                raise ValidationError(f"{field} must be a non-negative integer")
        capabilities = spec["capabilities"]
        if not isinstance(capabilities, list) or not capabilities or not all(
            isinstance(x, str) and x for x in capabilities
        ):
            raise ValidationError("capabilities must be a non-empty string list")

        identity = {
            "name": spec["name"],
            "provider": spec["provider"],
            "runtime": spec["runtime"],
            "runtime_version": spec["runtime_version"],
            "weights_digest": spec["weights_digest"],
            "quantization": spec["quantization"],
            "adapter_digest": spec["adapter_digest"],
            "prompt_template_digest": spec["prompt_template_digest"],
            "tokenizer_id": spec["tokenizer_id"],
            "context_window": spec["context_window"],
            "capabilities": sorted(set(capabilities)),
            "locality": spec["locality"],
            "max_vram_mb": spec["max_vram_mb"],
        }
        identity_hash = sha256_text("PV-DLAM-MODEL|" + canonical(identity))
        model_ref = "model:" + identity_hash[:32]
        row = self.conn.execute(
            "SELECT * FROM p1c_model_artifacts WHERE model_ref=?",
            (model_ref,),
        ).fetchone()
        if row is None:
            self.conn.execute(
                """
                INSERT INTO p1c_model_artifacts(
                  model_ref,identity_hash,identity_json,status,locality,priority,
                  context_window,max_vram_mb
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    model_ref,
                    identity_hash,
                    canonical(identity),
                    spec["status"],
                    spec["locality"],
                    spec["priority"],
                    spec["context_window"],
                    spec["max_vram_mb"],
                ),
            )
            self.conn.commit()
        else:
            if row["identity_hash"] != identity_hash:
                raise ValidationError("model_ref identity collision")
            # Qualification state/priority may be updated without changing exact
            # artifact identity; these are deployment observations, not weights.
            self.conn.execute(
                """
                UPDATE p1c_model_artifacts
                SET status=?, priority=?
                WHERE model_ref=?
                """,
                (spec["status"], spec["priority"], model_ref),
            )
            self.conn.commit()
        return self.get_model(model_ref)

    def get_model(self, model_ref: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT * FROM p1c_model_artifacts WHERE model_ref=?",
            (model_ref,),
        ).fetchone()
        if row is None:
            raise ValidationError(f"unknown model_ref: {model_ref}")
        identity = json.loads(row["identity_json"])
        return {
            "model_ref": row["model_ref"],
            "identity_hash": row["identity_hash"],
            "identity": identity,
            "status": row["status"],
            "locality": row["locality"],
            "priority": int(row["priority"]),
            "context_window": int(row["context_window"]),
            "max_vram_mb": int(row["max_vram_mb"]),
            "routing_stats_key": "stats:" + row["identity_hash"],
            "prior_observations": self.model_observation_count(row["model_ref"]),
        }

    def model_observation_count(self, model_ref: str) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) FROM p1c_route_outcomes WHERE model_ref=?",
            (model_ref,),
        ).fetchone()
        return int(row[0])

    def _validate_profile(self, profile_ref: str) -> dict[str, Any]:
        profile = self.genius_profiles.get(profile_ref)
        if profile is None:
            raise ValidationError(f"unknown GA108 profile: {profile_ref}")
        return profile

    def _candidate_evaluation(
        self,
        model: dict[str, Any],
        *,
        required_capabilities: set[str],
        preferred_capabilities: set[str],
        local_only: bool,
        minimum_context_tokens: int,
        max_vram_mb: int | None,
        allowed_model_refs: set[str] | None,
    ) -> dict[str, Any]:
        identity = model["identity"]
        reasons: list[str] = []
        capabilities = set(identity["capabilities"])
        if model["status"] != "QUALIFIED":
            reasons.append("MODEL_NOT_QUALIFIED")
        if local_only and model["locality"] != "LOCAL":
            reasons.append("REMOTE_NOT_ALLOWED")
        missing = sorted(required_capabilities - capabilities)
        if missing:
            reasons.append("MISSING_CAPABILITIES:" + ",".join(missing))
        if model["context_window"] < minimum_context_tokens:
            reasons.append("CONTEXT_WINDOW_TOO_SMALL")
        if max_vram_mb is not None and model["max_vram_mb"] > max_vram_mb:
            reasons.append("VRAM_BUDGET_EXCEEDED")
        if allowed_model_refs is not None and model["model_ref"] not in allowed_model_refs:
            reasons.append("MODEL_NOT_IN_ALLOWED_SET")
        if identity["tokenizer_id"] not in self.tokenizers:
            reasons.append("TOKENIZER_ADAPTER_UNAVAILABLE")
        preferred_matches = len(preferred_capabilities & capabilities)
        return {
            "model_ref": model["model_ref"],
            "eligible": not reasons,
            "reasons": reasons,
            "preferred_matches": preferred_matches,
            "priority": model["priority"],
            "context_window": model["context_window"],
            "max_vram_mb": model["max_vram_mb"],
            "routing_stats_key": model["routing_stats_key"],
            "prior_observations": model["prior_observations"],
        }

    def plan_static_route(
        self,
        *,
        profile_ref: str,
        authority_status: str,
        required_capabilities: list[str],
        preferred_capabilities: list[str] | None = None,
        local_only: bool = True,
        minimum_context_tokens: int = 0,
        max_vram_mb: int | None = None,
        allowed_model_refs: list[str] | None = None,
    ) -> dict[str, Any]:
        profile = self._validate_profile(profile_ref)
        if authority_status not in AUTHORITY_STATUS:
            raise ValidationError("invalid authority_status")
        if authority_status != "CURRENT":
            return {
                "disposition": "HELD" if authority_status == "STALE" else "DENIED",
                "profile_ref": profile_ref,
                "memory_namespace": profile["memoryNamespace"],
                "selected_model_ref": None,
                "eligible_candidates": [],
                "excluded_candidates": [],
                "authority_granted": False,
            }
        required = set(required_capabilities)
        preferred = set(preferred_capabilities or [])
        if not required or not all(isinstance(x, str) and x for x in required):
            raise ValidationError("required_capabilities must be a non-empty string list")
        if not all(isinstance(x, str) and x for x in preferred):
            raise ValidationError("preferred_capabilities must contain strings")
        if not isinstance(minimum_context_tokens, int) or minimum_context_tokens < 0:
            raise ValidationError("minimum_context_tokens must be non-negative")
        if max_vram_mb is not None and (
            not isinstance(max_vram_mb, int) or isinstance(max_vram_mb, bool) or max_vram_mb < 0
        ):
            raise ValidationError("max_vram_mb must be a non-negative integer or null")
        allowed = set(allowed_model_refs) if allowed_model_refs is not None else None

        rows = self.conn.execute(
            "SELECT model_ref FROM p1c_model_artifacts ORDER BY model_ref"
        ).fetchall()
        evaluations = [
            self._candidate_evaluation(
                self.get_model(row["model_ref"]),
                required_capabilities=required,
                preferred_capabilities=preferred,
                local_only=local_only,
                minimum_context_tokens=minimum_context_tokens,
                max_vram_mb=max_vram_mb,
                allowed_model_refs=allowed,
            )
            for row in rows
        ]
        eligible = [x for x in evaluations if x["eligible"]]
        excluded = [x for x in evaluations if not x["eligible"]]
        if not eligible:
            return {
                "disposition": "BLOCKED",
                "profile_ref": profile_ref,
                "memory_namespace": profile["memoryNamespace"],
                "selected_model_ref": None,
                "eligible_candidates": [],
                "excluded_candidates": excluded,
                "authority_granted": False,
            }

        # Static, inspectable selection only. No learned score participates.
        eligible.sort(
            key=lambda x: (
                -x["preferred_matches"],
                x["priority"],
                x["max_vram_mb"],
                x["model_ref"],
            )
        )
        selected = eligible[0]
        router_body = {
            "schema": self.SCHEMA,
            "mode": "STATIC",
            "feature_schema_version": self.FEATURE_SCHEMA_VERSION,
            "profile_ref": profile_ref,
            "required_capabilities": sorted(required),
            "preferred_capabilities": sorted(preferred),
            "local_only": bool(local_only),
            "minimum_context_tokens": minimum_context_tokens,
            "max_vram_mb": max_vram_mb,
            "allowed_model_refs": sorted(allowed) if allowed is not None else None,
            "candidate_order": [x["model_ref"] for x in eligible],
        }
        router_hash = sha256_text("PV-DLAM-STATIC-ROUTER|" + canonical(router_body))
        return {
            "disposition": "PLANNED",
            "profile_ref": profile_ref,
            "memory_namespace": profile["memoryNamespace"],
            "selected_model_ref": selected["model_ref"],
            "eligible_candidates": eligible,
            "excluded_candidates": excluded,
            "router_snapshot_ref": "static:" + router_hash,
            "authority_granted": False,
        }

    def _seal_route_receipt(
        self,
        *,
        task_id: str,
        profile_ref: str,
        model_ref: str,
        recipe_ref: str,
        plan: dict[str, Any],
        packet: dict[str, Any],
        policy_epoch: int,
        authority_decision_ref: str,
        resource_state: dict[str, Any],
    ) -> dict[str, Any]:
        model = self.get_model(model_ref)
        body = {
            "schema_version": "1",
            "schema": "superphivessel.dlam.route-decision.p1c.v0.1",
            "task_id": task_id,
            "profile_ref": profile_ref,
            "model_ref": model_ref,
            "recipe_ref": recipe_ref,
            "eligible_candidates": plan["eligible_candidates"],
            "excluded_candidates": plan["excluded_candidates"],
            "feature_schema_version": self.FEATURE_SCHEMA_VERSION,
            "router_snapshot_ref": plan["router_snapshot_ref"],
            "selection_probability": 1.0,
            "resource_state": resource_state,
            "context_manifest_ref": f"{packet['packet_id']}:{packet['packet_hash']}",
            "policy_frontier_ref": f"{authority_decision_ref}@epoch:{policy_epoch}",
            "index_manifest_ref": packet["index_manifest_ref"],
            "routing_mode": "STATIC",
            "routing_stats_key": model["routing_stats_key"],
            "prior_observations": model["prior_observations"],
            "authority_granted": False,
        }
        receipt_hash = sha256_text("PV-DLAM-ROUTE|" + canonical(body))
        receipt = {
            **body,
            "decision_id": "route_" + receipt_hash[:32],
            "receipt_hash": receipt_hash,
        }
        self.conn.execute(
            """
            INSERT OR IGNORE INTO p1c_route_receipts(
              decision_id,task_id,profile_ref,model_ref,receipt_hash,receipt_json
            ) VALUES(?,?,?,?,?,?)
            """,
            (
                receipt["decision_id"],
                task_id,
                profile_ref,
                model_ref,
                receipt_hash,
                canonical(receipt),
            ),
        )
        self.conn.commit()
        return receipt

    def prepare_task(
        self,
        *,
        task_id: str,
        query: str,
        profile_ref: str,
        agent_id: str,
        recipe_ref: str,
        purpose: str,
        target_surface: str,
        policy_epoch: int,
        authority_decision_ref: str,
        authority_status: str,
        memory_budget_tokens: int,
        required_capabilities: list[str],
        preferred_capabilities: list[str] | None = None,
        local_only: bool = True,
        minimum_context_tokens: int = 0,
        max_vram_mb: int | None = None,
        allowed_model_refs: list[str] | None = None,
        allowed_origins: set[str] | None = None,
        required_memory_ids: list[str] | None = None,
        provenance_depth: int = 2,
    ) -> dict[str, Any]:
        for field_name, value in {
            "task_id": task_id,
            "query": query,
            "agent_id": agent_id,
            "recipe_ref": recipe_ref,
            "purpose": purpose,
            "target_surface": target_surface,
            "authority_decision_ref": authority_decision_ref,
        }.items():
            if not isinstance(value, str) or not value:
                raise ValidationError(f"{field_name} must be a non-empty string")

        plan = self.plan_static_route(
            profile_ref=profile_ref,
            authority_status=authority_status,
            required_capabilities=required_capabilities,
            preferred_capabilities=preferred_capabilities,
            local_only=local_only,
            minimum_context_tokens=minimum_context_tokens,
            max_vram_mb=max_vram_mb,
            allowed_model_refs=allowed_model_refs,
        )
        if plan["disposition"] != "PLANNED":
            return {
                "schema": self.SCHEMA,
                "disposition": plan["disposition"],
                "task_id": task_id,
                "profile_ref": profile_ref,
                "memory_namespace": plan["memory_namespace"],
                "plan": plan,
                "packet": None,
                "route_receipt": None,
                "authority_granted": False,
            }

        model = self.get_model(plan["selected_model_ref"])
        tokenizer_id = model["identity"]["tokenizer_id"]
        composer = ContextComposer(
            self.store,
            tokenizer_id=tokenizer_id,
            token_counter=self.tokenizers[tokenizer_id],
        )
        packet = composer.compose(
            query,
            task_id=task_id,
            namespace_id=plan["memory_namespace"],
            agent_id=agent_id,
            genius_profile_ref=profile_ref,
            model_ref=model["model_ref"],
            purpose=purpose,
            target_surface=target_surface,
            policy_epoch=policy_epoch,
            authority_decision_ref=authority_decision_ref,
            authority_status=authority_status,
            memory_budget_tokens=memory_budget_tokens,
            allowed_origins=allowed_origins,
            required_memory_ids=required_memory_ids,
            provenance_depth=provenance_depth,
        )
        if packet["disposition"] != "READY":
            return {
                "schema": self.SCHEMA,
                "disposition": packet["disposition"],
                "task_id": task_id,
                "profile_ref": profile_ref,
                "memory_namespace": plan["memory_namespace"],
                "plan": plan,
                "packet": packet,
                "route_receipt": None,
                "authority_granted": False,
            }

        resource_state = {
            "local_only": bool(local_only),
            "max_vram_mb": max_vram_mb,
            "selected_model_max_vram_mb": model["max_vram_mb"],
            "selected_model_context_window": model["context_window"],
            "tokenizer_id": tokenizer_id,
        }
        receipt = self._seal_route_receipt(
            task_id=task_id,
            profile_ref=profile_ref,
            model_ref=model["model_ref"],
            recipe_ref=recipe_ref,
            plan=plan,
            packet=packet,
            policy_epoch=policy_epoch,
            authority_decision_ref=authority_decision_ref,
            resource_state=resource_state,
        )
        request_envelope = {
            "task_id": task_id,
            "query": query,
            "profile_ref": profile_ref,
            "agent_id": agent_id,
            "recipe_ref": recipe_ref,
            "purpose": purpose,
            "target_surface": target_surface,
            "policy_epoch": policy_epoch,
            "authority_decision_ref": authority_decision_ref,
            "authority_status": authority_status,
            "memory_budget_tokens": memory_budget_tokens,
            "required_capabilities": list(required_capabilities),
            "preferred_capabilities": list(preferred_capabilities or []),
            "local_only": bool(local_only),
            "minimum_context_tokens": minimum_context_tokens,
            "max_vram_mb": max_vram_mb,
            "allowed_model_refs": list(allowed_model_refs) if allowed_model_refs is not None else None,
            "allowed_origins": sorted(allowed_origins) if allowed_origins is not None else None,
            "required_memory_ids": list(required_memory_ids or []),
            "provenance_depth": provenance_depth,
        }
        return {
            "schema": self.SCHEMA,
            "disposition": "READY",
            "task_id": task_id,
            "profile_ref": profile_ref,
            "memory_namespace": plan["memory_namespace"],
            "model_ref": model["model_ref"],
            "plan": plan,
            "packet": packet,
            "route_receipt": receipt,
            "request_envelope": request_envelope,
            "authority_granted": False,
        }

    def _next_checkpoint_sequence(self, task_id: str) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(MAX(sequence),0)+1 FROM p1c_task_checkpoints WHERE task_id=?",
            (task_id,),
        ).fetchone()
        return int(row[0])

    def checkpoint_task(
        self,
        prepared: dict[str, Any],
        *,
        work_state: dict[str, Any],
        status: str = "PAUSED",
        previous_checkpoint_ref: str | None = None,
        opaque_state_transferred: bool = False,
    ) -> dict[str, Any]:
        if prepared.get("disposition") != "READY":
            raise CheckpointError("only READY tasks can be checkpointed")
        if status not in CHECKPOINT_STATUS:
            raise CheckpointError("invalid checkpoint status")
        if opaque_state_transferred:
            raise CheckpointError("opaque model state transfer is forbidden")
        if not isinstance(work_state, dict):
            raise CheckpointError("work_state must be an object")
        _scan_forbidden_keys(work_state)
        _assert_jsonable(work_state)

        task_id = prepared["task_id"]
        sequence = self._next_checkpoint_sequence(task_id)
        body = {
            "schema": "superphivessel.dlam.task-checkpoint.p1c.v0.1",
            "task_id": task_id,
            "sequence": sequence,
            "status": status,
            "profile_ref": prepared["profile_ref"],
            "memory_namespace": prepared["memory_namespace"],
            "model_ref": prepared["model_ref"],
            "route_decision_id": prepared["route_receipt"]["decision_id"],
            "route_receipt_hash": prepared["route_receipt"]["receipt_hash"],
            "context_packet_id": prepared["packet"]["packet_id"],
            "context_packet_hash": prepared["packet"]["packet_hash"],
            "ledger_frontier_ref": prepared["packet"]["ledger_frontier_ref"],
            "index_manifest_ref": prepared["packet"]["index_manifest_ref"],
            "policy_frontier_ref": prepared["route_receipt"]["policy_frontier_ref"],
            "request_envelope": prepared["request_envelope"],
            "work_state": work_state,
            "previous_checkpoint_ref": previous_checkpoint_ref,
            "opaque_state_transferred": False,
            "authority_granted": False,
        }
        checkpoint_hash = sha256_text("PV-DLAM-CHECKPOINT|" + canonical(body))
        checkpoint = {
            **body,
            "checkpoint_id": "ckpt_" + checkpoint_hash[:32],
            "checkpoint_hash": checkpoint_hash,
        }
        self.conn.execute(
            """
            INSERT INTO p1c_task_checkpoints(
              checkpoint_id,task_id,sequence,checkpoint_hash,checkpoint_json
            ) VALUES(?,?,?,?,?)
            """,
            (
                checkpoint["checkpoint_id"],
                task_id,
                sequence,
                checkpoint_hash,
                canonical(checkpoint),
            ),
        )
        self.conn.commit()
        return checkpoint

    def get_checkpoint(self, checkpoint_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            "SELECT checkpoint_json FROM p1c_task_checkpoints WHERE checkpoint_id=?",
            (checkpoint_id,),
        ).fetchone()
        if row is None:
            raise CheckpointError(f"unknown checkpoint_id: {checkpoint_id}")
        return json.loads(row["checkpoint_json"])

    def record_outcome(
        self,
        decision_id: str,
        *,
        success: bool,
        latency_ms: int,
    ) -> dict[str, Any]:
        if not isinstance(success, bool):
            raise ValidationError("success must be boolean")
        if not isinstance(latency_ms, int) or isinstance(latency_ms, bool) or latency_ms < 0:
            raise ValidationError("latency_ms must be a non-negative integer")
        row = self.conn.execute(
            "SELECT model_ref,receipt_hash FROM p1c_route_receipts WHERE decision_id=?",
            (decision_id,),
        ).fetchone()
        if row is None:
            raise ValidationError(f"unknown decision_id: {decision_id}")
        body = {
            "schema": "superphivessel.dlam.route-outcome.p1c.v0.1",
            "decision_id": decision_id,
            "route_receipt_hash": row["receipt_hash"],
            "model_ref": row["model_ref"],
            "success": success,
            "latency_ms": latency_ms,
        }
        outcome_hash = sha256_text("PV-DLAM-OUTCOME|" + canonical(body))
        outcome = {
            **body,
            "outcome_id": "out_" + outcome_hash[:32],
            "outcome_hash": outcome_hash,
        }
        self.conn.execute(
            """
            INSERT OR IGNORE INTO p1c_route_outcomes(
              outcome_id,decision_id,model_ref,success,latency_ms,outcome_hash,outcome_json
            ) VALUES(?,?,?,?,?,?,?)
            """,
            (
                outcome["outcome_id"],
                decision_id,
                row["model_ref"],
                1 if success else 0,
                latency_ms,
                outcome_hash,
                canonical(outcome),
            ),
        )
        self.conn.commit()
        return outcome

    def swap_model(
        self,
        checkpoint_id: str,
        *,
        replacement_model_ref: str,
    ) -> dict[str, Any]:
        checkpoint = self.get_checkpoint(checkpoint_id)
        if replacement_model_ref == checkpoint["model_ref"]:
            raise CheckpointError("replacement model must be a different exact model identity")

        replacement = self.get_model(replacement_model_ref)
        if replacement["status"] != "QUALIFIED":
            raise NoEligibleRouteError("replacement model is not qualified")

        request = dict(checkpoint["request_envelope"])
        request["allowed_model_refs"] = [replacement_model_ref]
        allowed_origins = request.get("allowed_origins")
        if allowed_origins is not None:
            request["allowed_origins"] = set(allowed_origins)

        prepared = self.prepare_task(**request)
        if prepared["disposition"] != "READY":
            raise NoEligibleRouteError(
                f"replacement could not resume task: {prepared['disposition']}"
            )
        if prepared["model_ref"] != replacement_model_ref:
            raise NoEligibleRouteError("replacement selection drift")

        resumed = self.checkpoint_task(
            prepared,
            work_state=checkpoint["work_state"],
            status="RESUMED_AFTER_SWAP",
            previous_checkpoint_ref=checkpoint_id,
            opaque_state_transferred=False,
        )
        return {
            "schema": self.SCHEMA,
            "disposition": "RESUMED_AFTER_SWAP",
            "previous_checkpoint": checkpoint,
            "prepared": prepared,
            "checkpoint": resumed,
            "authority_granted": False,
        }
