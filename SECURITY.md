# Security Policy

Super Φ.Vessel is an alpha research project. Treat it as experimental software, not as a hardened security boundary.

## Never commit

- API keys, access tokens, passwords, cookies, session exports, or OAuth material
- private keys or certificates containing private key material
- browser localStorage/sessionStorage/IndexedDB exports containing operator data
- private Vessel memory exports
- personal data, production logs, or private receipts
- provider secrets or deployment environment files

Use environment variables or platform-managed secret stores for deployment credentials.

## Authority model

A capability being available does not grant authority to use it.

Super Φ.Vessel is designed around explicit operator authorization, bounded grants, receipted execution, and fail-closed behavior. Security bugs that allow a model, tool, bridge, packet, memory record, or imported artifact to expand its own authority are considered high priority.

## Reporting a vulnerability

Do not open a public issue containing active credentials, private data, or an exploitable secret.

For ordinary security design concerns that do not expose sensitive material, a public issue is acceptable.

For sensitive vulnerabilities, contact the maintainer privately through an available GitHub private/security reporting channel when configured.

## Current status

No production-security guarantee is made. The project is under active architectural normalization and review.
