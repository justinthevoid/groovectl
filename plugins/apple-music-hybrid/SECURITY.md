# Security policy

## Reporting

Use the repository's [private vulnerability report](https://github.com/justinthevoid/groovectl/security/advisories/new). Private reporting is enabled. Do not include exploitable details, .p8 keys, tokens, BYOK credentials or personal listening data in a public issue. If that flow is unavailable, open a minimal issue requesting a private contact with no sensitive details.

Include the affected version/commit, operating system, backend, a synthetic reproduction and impact. Do not send real credentials as proof. The maintainer will acknowledge and investigate reports as capacity permits; no response-time or bounty promise is made.

## Supported scope

Before 1.0, fixes target the latest released version. Older private development builds and unqualified player/provider experiments should not be treated as supported production releases. The qualification ledger records the evidence available for each checkpoint.

Security-sensitive areas include MusicKit authorization, token/key storage, local helper access, Cider loopback authentication, CLI subprocess boundaries, image provider output validation, journal claims, package contents and app CSP. Metadata and model-generated suggestions are untrusted content.

A dedicated MusicKit key can be revoked independently. Keep keys and tokens out of MCP arguments and chat as well as source. POSIX modes do not replace Windows NTFS ACLs; custom operator directories must remain private.

Groovectl is a local/operator-controlled tool, not a multi-tenant hosted service. No unauthenticated public HTTP music-control endpoint is supported. Processes with access to the same user account can read its private files; file modes are not an OS sandbox. Protect the host, client/plugin supply chain and backups.

See PRIVACY.md and docs/architecture.md. Never replay an unknown account mutation while investigating a report.
