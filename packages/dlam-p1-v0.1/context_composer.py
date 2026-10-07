from __future__ import annotations

from collections import Counter, deque
from typing import Any, Callable

from dlam_store import DlamStore, ORIGINS, ValidationError, canonical, sha256_text

AUTHORITY_STATUSES = {"CURRENT", "STALE", "DENIED"}


class ContextComposer:
    """PV-DLAM P1-B bounded context composition.

    The composer consumes an already-adjudicated authority status/reference. It
    never mints authority. Token counting is injected so model-specific adapters
    can provide an exact tokenizer without coupling memory identity to a model.
    """

    SCHEMA = "superphivessel.dlam.context-packet.v0.1"

    def __init__(
        self,
        store: DlamStore,
        *,
        tokenizer_id: str,
        token_counter: Callable[[str], int],
    ) -> None:
        if not tokenizer_id:
            raise ValidationError("tokenizer_id is required")
        self.store = store
        self.tokenizer_id = tokenizer_id
        self.token_counter = token_counter

    def _count(self, text: str) -> int:
        count = self.token_counter(text)
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            raise ValidationError("token_counter must return a non-negative integer")
        return count

    @staticmethod
    def _validate_request(
        *,
        query: str,
        task_id: str,
        namespace_id: str,
        agent_id: str,
        model_ref: str,
        purpose: str,
        target_surface: str,
        policy_epoch: int,
        authority_decision_ref: str,
        authority_status: str,
        memory_budget_tokens: int,
        provenance_depth: int,
    ) -> None:
        fields = {
            "query": query,
            "task_id": task_id,
            "namespace_id": namespace_id,
            "agent_id": agent_id,
            "model_ref": model_ref,
            "purpose": purpose,
            "target_surface": target_surface,
            "authority_decision_ref": authority_decision_ref,
        }
        for name, value in fields.items():
            if not isinstance(value, str) or not value:
                raise ValidationError(f"{name} must be a non-empty string")
        if authority_status not in AUTHORITY_STATUSES:
            raise ValidationError(f"invalid authority_status: {authority_status}")
        if not isinstance(policy_epoch, int) or isinstance(policy_epoch, bool) or policy_epoch < 0:
            raise ValidationError("policy_epoch must be a non-negative integer")
        if not isinstance(memory_budget_tokens, int) or isinstance(memory_budget_tokens, bool) or memory_budget_tokens < 0:
            raise ValidationError("memory_budget_tokens must be a non-negative integer")
        if not isinstance(provenance_depth, int) or not 0 <= provenance_depth <= 4:
            raise ValidationError("provenance_depth must be between 0 and 4")

    def _admissible(
        self,
        memory_id: str,
        *,
        namespace_id: str,
        purpose: str,
        target_surface: str,
        allowed_origins: set[str],
    ) -> dict[str, Any] | None:
        return self.store.get_admissible_memory(
            memory_id,
            namespace_id=namespace_id,
            purpose=purpose,
            target=target_surface,
            allowed_origins=allowed_origins,
        )

    def _safe_reason(
        self,
        memory_id: str,
        *,
        namespace_id: str,
        allowed_origins: set[str],
    ) -> str:
        raw = self.store.get_memory(memory_id)
        if raw is None:
            return "MISSING"
        if raw["namespace_id"] != namespace_id:
            return "WRONG_NAMESPACE"
        if raw["tombstoned"]:
            return "TOMBSTONED"
        if raw["blocked"]:
            return "BLOCKED"
        if raw["origin"] not in allowed_origins:
            return "ORIGIN_NOT_ADMITTED"
        return "PURPOSE_OR_TARGET_DENIED"

    def _item(
        self,
        record: dict[str, Any],
        *,
        role: str,
    ) -> dict[str, Any]:
        memory_id = record["memory_id"]
        links = {
            "contradicts": self.store.relation_refs(memory_id, "CONTRADICTS"),
            "evidence": self.store.relation_refs(memory_id, "EVIDENCE"),
            "derivation_parents": self.store.derivation_parent_refs(memory_id),
        }
        return {
            "memory_id": memory_id,
            "role": role,
            "kind": record["kind"],
            "origin": record["origin"],
            "source_status": record["source_status"],
            "content": record["content"],
            "content_sha256": record["content_sha256"],
            "admitted_event_id": record["admitted_event_id"],
            "admitted_sequence": int(record["admitted_sequence"]),
            "links": links,
        }

    def _build_group(
        self,
        root_memory_id: str,
        *,
        namespace_id: str,
        purpose: str,
        target_surface: str,
        allowed_origins: set[str],
        provenance_depth: int,
    ) -> dict[str, Any]:
        root = self._admissible(
            root_memory_id,
            namespace_id=namespace_id,
            purpose=purpose,
            target_surface=target_surface,
            allowed_origins=allowed_origins,
        )
        if root is None:
            return {
                "ok": False,
                "root": root_memory_id,
                "reason": self._safe_reason(
                    root_memory_id,
                    namespace_id=namespace_id,
                    allowed_origins=allowed_origins,
                ),
                "items": [],
                "omitted_dependencies": [],
            }

        roles: dict[str, str] = {root_memory_id: "PRIMARY"}
        records: dict[str, dict[str, Any]] = {root_memory_id: root}
        omitted: list[dict[str, str]] = []

        # Contradictions are strict: a visible claim may not silently shed a
        # known contradictory companion merely because that is convenient.
        queue = deque([root_memory_id])
        seen_contradictions: set[str] = set()
        while queue:
            current = queue.popleft()
            if current in seen_contradictions:
                continue
            seen_contradictions.add(current)
            for ref in self.store.relation_refs(current, "CONTRADICTS"):
                companion = self._admissible(
                    ref,
                    namespace_id=namespace_id,
                    purpose=purpose,
                    target_surface=target_surface,
                    allowed_origins=allowed_origins,
                )
                if companion is None:
                    return {
                        "ok": False,
                        "root": root_memory_id,
                        "reason": "CONTRADICTION_COMPANION_UNAVAILABLE",
                        "blocked_ref": ref,
                        "items": [],
                        "omitted_dependencies": [],
                    }
                if ref not in records:
                    records[ref] = companion
                    roles[ref] = "CONTRADICTION"
                    queue.append(ref)

        # Provenance is expanded conservatively to a bounded depth. Inaccessible
        # provenance is reported by opaque ref/reason only; its content never
        # enters the packet.
        if provenance_depth > 0:
            pq = deque((mid, 0) for mid in sorted(records))
            seen_provenance: set[tuple[str, int]] = set()
            while pq:
                current, depth = pq.popleft()
                if (current, depth) in seen_provenance or depth >= provenance_depth:
                    continue
                seen_provenance.add((current, depth))
                refs = set(self.store.derivation_parent_refs(current))
                refs.update(self.store.relation_refs(current, "EVIDENCE"))
                for ref in sorted(refs):
                    if ref in records:
                        continue
                    parent = self._admissible(
                        ref,
                        namespace_id=namespace_id,
                        purpose=purpose,
                        target_surface=target_surface,
                        allowed_origins=allowed_origins,
                    )
                    if parent is None:
                        omitted.append({
                            "memory_id": ref,
                            "reason": self._safe_reason(
                                ref,
                                namespace_id=namespace_id,
                                allowed_origins=allowed_origins,
                            ),
                            "relation": "PROVENANCE",
                        })
                        continue
                    records[ref] = parent
                    roles[ref] = "PROVENANCE"
                    pq.append((ref, depth + 1))

        priority = {"PRIMARY": 0, "CONTRADICTION": 1, "PROVENANCE": 2}
        items = [
            self._item(records[mid], role=roles[mid])
            for mid in sorted(
                records,
                key=lambda m: (
                    priority[roles[m]],
                    -int(records[m]["admitted_sequence"]),
                    m,
                ),
            )
        ]
        return {
            "ok": True,
            "root": root_memory_id,
            "items": items,
            "omitted_dependencies": sorted(
                omitted,
                key=lambda x: (x["memory_id"], x["reason"]),
            ),
        }

    def _seal(
        self,
        body: dict[str, Any],
    ) -> dict[str, Any]:
        packet_hash = sha256_text("PV-DLAM-CONTEXT|" + canonical(body))
        return {
            **body,
            "packet_id": "ctx_" + packet_hash[:32],
            "packet_hash": packet_hash,
        }

    def compose(
        self,
        query: str,
        *,
        task_id: str,
        namespace_id: str,
        agent_id: str,
        genius_profile_ref: str | None,
        model_ref: str,
        purpose: str,
        target_surface: str,
        policy_epoch: int,
        authority_decision_ref: str,
        authority_status: str,
        memory_budget_tokens: int,
        allowed_origins: set[str] | None = None,
        required_memory_ids: list[str] | None = None,
        candidate_limit: int = 20,
        provenance_depth: int = 2,
    ) -> dict[str, Any]:
        self._validate_request(
            query=query,
            task_id=task_id,
            namespace_id=namespace_id,
            agent_id=agent_id,
            model_ref=model_ref,
            purpose=purpose,
            target_surface=target_surface,
            policy_epoch=policy_epoch,
            authority_decision_ref=authority_decision_ref,
            authority_status=authority_status,
            memory_budget_tokens=memory_budget_tokens,
            provenance_depth=provenance_depth,
        )
        if not 1 <= candidate_limit <= 100:
            raise ValidationError("candidate_limit must be between 1 and 100")

        origins = set(allowed_origins if allowed_origins is not None else ORIGINS)
        if not origins or not origins.issubset(ORIGINS):
            raise ValidationError("allowed_origins must be a non-empty subset of known origins")
        required = list(dict.fromkeys(required_memory_ids or []))
        frontier = self.store.ledger_frontier(namespace_id)
        base = {
            "schema_version": "1",
            "schema": self.SCHEMA,
            "task_id": task_id,
            "namespace_id": namespace_id,
            "agent_id": agent_id,
            "genius_profile_ref": genius_profile_ref,
            "model_ref": model_ref,
            "purpose": purpose,
            "target_surface": target_surface,
            "policy_epoch": policy_epoch,
            "authority_decision_ref": authority_decision_ref,
            "authority_status": authority_status,
            "ledger_frontier_ref": frontier["ref"],
            "index_manifest_ref": f"fts5:{namespace_id}:{frontier['event_hash']}",
            "router_snapshot_ref": None,
            "tokenizer_id": self.tokenizer_id,
            "memory_budget_tokens": memory_budget_tokens,
            "query_hash": sha256_text(query),
            "allowed_origins": sorted(origins),
            "action_authority": "NONE",
        }

        if authority_status != "CURRENT":
            return self._seal({
                **base,
                "disposition": "HELD" if authority_status == "STALE" else "DENIED",
                "used_memory_tokens": 0,
                "items": [],
                "excluded": [],
                "omitted_dependencies": [],
                "epistemic_mix": {},
            })

        recalled = self.store.recall(
            query,
            namespace_id=namespace_id,
            purpose=purpose,
            target=target_surface,
            limit=candidate_limit,
        )
        roots = required + [
            row["memory_id"]
            for row in recalled
            if row["memory_id"] not in required
        ]

        selected: dict[str, dict[str, Any]] = {}
        selected_cost: dict[str, int] = {}
        excluded: list[dict[str, str]] = []
        omitted_dependencies: list[dict[str, str]] = []
        used = 0

        def add_group(root: str, *, is_required: bool) -> bool:
            nonlocal used
            group = self._build_group(
                root,
                namespace_id=namespace_id,
                purpose=purpose,
                target_surface=target_surface,
                allowed_origins=origins,
                provenance_depth=provenance_depth,
            )
            if not group["ok"]:
                excluded.append({
                    "memory_id": root,
                    "reason": group["reason"],
                    "required": str(is_required).lower(),
                })
                return False

            new_items = [
                item for item in group["items"]
                if item["memory_id"] not in selected
            ]
            costs = {
                item["memory_id"]: self._count(canonical(item))
                for item in new_items
            }
            group_cost = sum(costs.values())
            if used + group_cost > memory_budget_tokens:
                excluded.append({
                    "memory_id": root,
                    "reason": "BUDGET",
                    "required": str(is_required).lower(),
                })
                return False

            for item in new_items:
                selected[item["memory_id"]] = item
                selected_cost[item["memory_id"]] = costs[item["memory_id"]]
            used += group_cost
            omitted_dependencies.extend(group["omitted_dependencies"])
            return True

        for root in required:
            if not add_group(root, is_required=True):
                return self._seal({
                    **base,
                    "disposition": "INSUFFICIENT",
                    "used_memory_tokens": 0,
                    "items": [],
                    "excluded": sorted(excluded, key=lambda x: (x["memory_id"], x["reason"])),
                    "omitted_dependencies": [],
                    "epistemic_mix": {},
                })

        for root in roots:
            if root in required or root in selected:
                continue
            add_group(root, is_required=False)

        if not selected:
            return self._seal({
                **base,
                "disposition": "INSUFFICIENT",
                "used_memory_tokens": 0,
                "items": [],
                "excluded": sorted(excluded, key=lambda x: (x["memory_id"], x["reason"])),
                "omitted_dependencies": sorted(
                    {canonical(x): x for x in omitted_dependencies}.values(),
                    key=lambda x: (x["memory_id"], x["reason"]),
                ),
                "epistemic_mix": {},
            })

        items = list(selected.values())
        mix = dict(sorted(Counter(item["origin"] for item in items).items()))
        dedup_omitted = {
            canonical(x): x for x in omitted_dependencies
        }
        return self._seal({
            **base,
            "disposition": "READY",
            "used_memory_tokens": used,
            "items": items,
            "excluded": sorted(excluded, key=lambda x: (x["memory_id"], x["reason"])),
            "omitted_dependencies": sorted(
                dedup_omitted.values(),
                key=lambda x: (x["memory_id"], x["reason"]),
            ),
            "epistemic_mix": mix,
        })
