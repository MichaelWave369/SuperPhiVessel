# Contributing

Super Φ.Vessel is an experimental governed AI runtime. Contributions are welcome, but changes that blur authority, evidence, or provenance boundaries require especially careful review.

## Before proposing a change

Please identify:

1. **What capability changes?**
2. **What authority changes?**
3. **What evidence or provenance changes?**
4. **What new state is persisted?**
5. **What can fail, and does it fail closed?**
6. **What deterministic test or receipt demonstrates the intended behavior?**

A feature that adds capability but silently expands authority will not be treated as a harmless refactor.

## Pull requests

Keep changes focused and include:

- a concise problem statement
- the relevant subsystem/protocol
- tests or fixtures when behavior changes
- explicit notes for authority/provenance changes
- migration notes when persistent state changes
- screenshots only when they help review UI behavior

## Compatibility

The project is alpha. Backward compatibility is useful but not guaranteed.

## Generated/model-assisted contributions

Model-assisted code is welcome. The human contributor remains responsible for reviewing the resulting code, licensing compatibility, secrets, and behavior.
