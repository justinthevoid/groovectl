# Privacy

Groovectl has no hosted music-account backend, built-in usage analytics or telemetry endpoint. The documentation website is static; its brief builder runs in the browser. The website host may retain ordinary access logs.

## Data flows

- Apple receives the catalog/account API requests needed for tools you call. Native Music.app and Windows media-session operations use the local player. Cider receives authenticated requests on loopback.
- Your agent/MCP client receives requested tool results, potentially including library, Replay, preference and playlist data. Its own privacy and retention rules apply.
- The explicitly selected image provider receives the creative prompt. CLI routes use the CLI's local account; BYOK routes use the configured provider API. Groovectl does not send the whole library to an image provider or automatically switch to another provider.

## Local records

Private operator storage contains configuration, account tokens, optional API keys, plans/receipts, briefs, snapshots and artwork. Existing Apple Music Hybrid storage is reused. POSIX files use restrictive modes; Windows operators should use a protected user profile/data directory. The optional Swift helper stores its local socket/application data on the Mac.

Plans and snapshots can reveal listening preferences. Backups, artwork/provider logs and exported playlists may be sensitive. Groovectl does not promise automatic expiration/deletion of all local records; retain/delete private data deliberately after checking active jobs and uncertain mutation receipts. Removing an app or repository does not revoke Apple/provider credentials or erase account playlists.

Revoke credentials through Apple/Cider/provider settings when appropriate. Never include operator directories, secrets or personal examples in a public source archive, bug report, site or plugin package. See SECURITY.md for private reporting.
