# GA108 Stable Genius Roster

**Protocol:** PV-DLAM-0.1  
**Registry:** GA108  
**Status:** CANONICAL RUNTIME EXPORT / P0  
**Runtime wiring:** UNWIRED

The canonical Super Φ.Vessel `.54.10` runtime already contains a machine-readable Genius Atlas catalog:

- `GA108_CATEGORY_ORDER`
- `GA108_CATALOG_RAW`

P0 preserves that existing identity surface instead of inventing a replacement roster.

## Frozen result

The runtime contains exactly:

- **108 entries**
- **gaId 001 through 108**
- **18 categories**
- **6 entries per category**
- node types: `PERSON`, `SCHOOL`, `KNOWLEDGE_TRADITION`

The full snapshot is `genius-roster.json`.

## Stable identity

The canonical source identifier remains the runtime's existing three-digit `gaId`.

PV-DLAM adds only a collision-safe namespaced profile identity:

```text
gaId:        032
profileId:   ga108:032
memory:      genius.ga108.032
label:       Alan Turing
```

The namespaced ID does not replace or reinterpret `gaId`; it makes the existing ID safe to carry through memory, routing, receipts, and peer synchronization.

### Rules

- Existing `gaId` values MUST NOT be renumbered.
- Retired entries keep their IDs reserved.
- An old ID MUST NOT be reused for a different profile.
- Label changes do not change identity.
- Model changes do not change identity.
- Memory migrations do not change identity.
- Each profile starts with `authority=NONE`.
- Each profile starts with `modelBinding=null`.

## "Genius" does not mean "person"

GA108 is the runtime name for the routing catalog. The registry contains people, schools, and knowledge traditions.

A profile is therefore a **logical cognitive/routing lens**, not a claim that every entry is a person, autonomous agent, independent witness, or authority source.

Several profiles may execute through the same base model. Their outputs do not become independent corroboration merely because different GA108 roles were used.

## Memory continuity

Every entry receives a deterministic logical memory namespace:

```text
genius.ga108.<gaId>
```

This namespace can later hold profile-scoped episodes, procedures, routing outcomes, and admitted derived views without tying continuity to a model process.

The namespace is an address, not permission. Context admission still passes PV-DLAM current policy and authority checks.

## Model independence

A GA108 profile is intentionally born with no reserved model:

```json
{
  "authority": "NONE",
  "modelBinding": null
}
```

BrainC may later select an eligible model/recipe for the profile. A route receipt records that choice, but the selected model does not become the profile identity.

## Source custody

This export is pinned to:

- runtime: `v2.0-alpha.11.0.54.10`
- runtime SHA-256: `96767c267b0d9ed20be9f4d182c30129944311096c0959d20b5d80c89fb2c09e`
- Git blob SHA-1: `b44e0411f7477f2041cb3f130452a6d1f0410121`

Future roster changes require a versioned registry update and migration receipt rather than editing the historical snapshot in place.

## P0 consequence

This resolves the PV-DLAM blocker for **canonical full Genius roster count and stable-ID export**.

It does **not** activate learned routing, instantiate 108 models, create 108 databases, or change the canonical runtime.
