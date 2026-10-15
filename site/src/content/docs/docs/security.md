---
title: Security and privacy
---

Groovectl runs with the permissions of the account that starts it. Its file modes and fixed tool schemas protect ordinary operation; they do not sandbox malicious code already running under that same account.

## What leaves your computer

Apple receives catalog and personal-library API requests. Your MCP client/agent receives the tool results you request, which can include listening information. A selected image provider receives the creative prompt sent to it; a CLI provider uses that CLI's existing local account. Your agent host and providers have their own retention rules.

The static website brief builder stays in the browser. It contains no account sign-in, music mutation backend or Groovectl analytics. Hosting infrastructure can still keep ordinary request logs.

## Local data

MusicKit configuration, user tokens, Cider credentials, optional BYOK keys, write plans, briefs, snapshots and artwork are private operator data. POSIX private files are created with restrictive permissions. On Windows, protect the user profile/data directory using Windows account and filesystem permissions. Existing Apple Music Hybrid data remains compatible.

Do not include these files, raw provider logs or personal listening receipts in an issue, public repository, plugin ZIP or website deployment. Backups are sensitive too.

## Account changes

Playlist and preference changes start with a reviewed immutable plan. A durable claim precedes writes. Returned resource IDs and batch progress are retained before later reads. Successful apply calls can return their saved result; uncertain writes are blocked from replay. Acceptance-only API responses are labeled unverified.

Playback is an immediate action and should be requested by the user. Native deletion is narrowly limited to unchanged playlists created by a recorded plan. No arbitrary script, shell or HTTP proxy tool is exposed.

## Image costs

Provider choice is explicit. Local attempt counters are guardrails, not a balance meter or a spending guarantee. Groovectl does not fall back to a paid route automatically. BYOK billing and provider/CLI quotas remain the operator's responsibility.

## Report a vulnerability

Use the repository's private vulnerability reporting feature when available. Never put a key, token, personal library dump or exploitable detail into a public issue. If private reporting is unavailable, request a private maintainer contact without including sensitive details. The repository SECURITY.md describes scope and reporting expectations.
