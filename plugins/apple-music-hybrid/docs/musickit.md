# Connect Apple Music

Groovectl has two independent connections:

- **Local playback:** Music.app on macOS, Apple Music’s media session on Windows, or Cider’s authenticated local API. Native Mac playback and library playlists do not require a developer key.
- **Apple’s catalog and account API:** your own MusicKit developer key, plus a one-time Apple Music user authorization for personal library access and playlist creation. These work on macOS, Windows and Linux.

An Apple Music subscription is needed for subscription content. Creating a MusicKit key requires access to the relevant Apple Developer account; Groovectl does not provide a shared developer key or bypass Apple’s requirements.

## 1. Create a dedicated MusicKit key

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list/mediaId).
2. Create a **Media ID** for your installation/application. Choose a reverse-domain identifier you control.
3. Open **Keys**, create a key, enable **MusicKit**, and configure it for your Media ID. Download its `.p8` file. Apple offers the download once; store a backup privately.
4. Note the ten-character **Key ID** and **Team ID**. The Team ID appears in your developer account’s membership details.

Use a dedicated key so it can be revoked independently. Never commit, upload, or paste the `.p8` contents or Music-User-Token into a chat.

Apple’s references: [MusicKit](https://developer.apple.com/musickit/), [Developer token authentication](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens), and [user authentication](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit).

## 2. Configure locally

Guided setup:

```sh
groovectl setup
```

Or supply the **path and identifiers**, never private-key contents:

```sh
chmod 600 "$HOME/.config/groovectl/keys/AuthKey_EXAMPLE.p8"
groovectl configure --key-path "$HOME/.config/groovectl/keys/AuthKey_EXAMPLE.p8" --key-id ABC1234567 --team-id DEF1234567 --storefront us
groovectl authorize
groovectl doctor
```

Create the `keys` directory and place the key there first. The example IDs are placeholders. Configuration validates the P-256 key and keeps the original key at its chosen path. On Windows, place it inside your private user profile and check its NTFS ACL; POSIX `chmod` does not secure Windows files.

`authorize` opens a ten-minute, nonce-bound HTTP callback on `127.0.0.1` with an automatically chosen port. The page loads MusicKit JS directly from Apple. Sign in with Apple in your browser and approve the requested access. Touch ID, account verification and OS permission prompts remain human steps.

Groovectl verifies the returned token against Apple’s `/v1/me/storefront` endpoint before saving it. It checks the callback Host and Origin, bounds request size, disables caching and does not log tokens or callback requests. The developer token expires in one hour and is refreshed in memory as needed.

## Storage and migration

Default locations are `~/.config/groovectl` on macOS/Linux and `%APPDATA%/Groovectl` on Windows. Use `GROOVECTL_DATA` for a private alternate directory.

Existing Apple Music Hybrid installations automatically reuse `~/.config/apple-music-hybrid` when its MusicKit configuration exists. `APPLE_MUSIC_HYBRID_DATA` also remains supported. The original SQLite journal, accepted write receipts, key path and user authorization stay available; no new login or private-key copy is required for this migration. `doctor` reports the actual directory and whether legacy configuration is being reused.

On POSIX, configuration and journal files are created with mode `0600`, inside a `0700` directory. On Windows they inherit the private user profile’s NTFS access rules; check those rules if using a custom directory. These files are local credentials, not encrypted vault storage. Keep them out of shared/cloud project folders. Revoking an Apple key or account authorization requires fresh setup.

## Common problems

| Symptom | Action |
| --- | --- |
| Catalog search says setup is pending | Configure a MusicKit-enabled `.p8` key, its Key ID and Team ID. |
| Apple returns 401 | Check the key, IDs, clock and whether the key was revoked. |
| Personal library returns 403 | Run `authorize` again and check subscription/account permissions. |
| A recording is absent | Search the configured storefront. Availability and alternate editions vary by region. |
| A write times out | Inspect the saved plan and your library. An `applying`, `unknown` or `needs_review` plan is blocked from automatic replay. |
| Music.app refuses automation | Allow the responsible host in System Settings → Privacy & Security → Automation. With the Swift helper installed, that host is Groovectl Helper. |

There is no Apple ID/password tool, web-session token scraper, shared key, or hosted credential service.
