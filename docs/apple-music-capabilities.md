# Apple Music control: what is actually possible?

Primary-source review: October 14–15, 2026. Apple Docs 2 MCP supplied Apple Developer DocC pages; the installed macOS 27.2 SDK and Music.app scripting dictionary supplied method-level desktop evidence. Documented availability, implemented behavior, and live qualification are separate claims.

## Architecture

Use the **Apple Music API for identity and account data**, a **player adapter for transport**, and the **host agent for musical judgment**. A saved playlist, a temporary queue, and playback are different resources. A MusicKit web player owns its own session; it does not become a remote for arbitrary desktop players.

## Capability matrix

| Goal | Apple surface and limits | Groovectl implementation / decision |
| --- | --- | --- |
| Search songs, artists, albums, playlists, stations, videos | [Catalog API](https://developer.apple.com/documentation/applemusicapi), with storefront availability. | Implemented bounded searches and entity reads. |
| Resolve releases or territory availability | [ISRC lookup](https://developer.apple.com/documentation/applemusicapi/get-multiple-catalog-songs-by-isrc) can return several releases; [equivalent IDs](https://developer.apple.com/documentation/applemusicapi/get-equivalent-ids-for-the-albums-3ce20) map to available content in a storefront. | New `find_recording_alternatives` covers both, preserving Apple's mapping. Review album/version before replacement. |
| Browse personal music | iCloud library includes imports/purchases, sometimes without a catalog counterpart. Personal data needs Music User Token plus developer token. | API library search/browse/read across OSes; Mac native search by persistent ID. Unreleased source accepts mixed catalog/API-library songs, including imports without catalog counterparts; contract-tested, live mixed-write qualification pending. |
| Create playlist / append tracks | [Playlist collection](https://developer.apple.com/documentation/applemusicapi/playlists-api); accepts catalog/library songs and music videos. | Already implemented and live verified for catalog songs via REST and native library tracks via Music.app. Journal claims once and verifies order/count. Mixed API library/catalog song plans are implemented in unreleased source with alias-aware readback; videos remain outside write plans. |
| Rename, reorder, remove entries | Reviewed REST collection documents create/append, but no general update/delete/reorder endpoint. | Arbitrary editing/removal is not implemented. Studio resequencing makes a new preview; it does not reorder an existing saved playlist. Native deletion stays restricted to unchanged journal-owned playlists. |
| Swift MusicLibrary writes | [Edit method](https://developer.apple.com/documentation/musickit/musiclibrary/edit(_:name:description:authordisplayname:items:)) edits playlists created by the calling app. Installed SDK explicitly marks add/create/edit overloads unavailable on macOS. | Class availability on macOS does not imply method availability. Our working REST/automation routes remain valid. |
| Playlist folders | Playlist collection includes folder reads/relationships/creation and parent relationships. | Unreleased source browses folders, previews creation and chooses/verifies a parent for new API playlists. Contract-tested; this account returned an empty root identity in the live read, so no root is invented. Folder writes remain live-unqualified. |
| Add catalog resources to library | [Library addition](https://developer.apple.com/documentation/applemusicapi/add-a-resource-to-a-library): 202, empty body, delayed appearance, may ignore unaddable IDs. | Implemented typed preview/apply for songs, albums, playlists and videos. Accepted/unverified receipt, no replay. Contract-tested; no personal library writes made for qualification. |
| Favorites | [Add favorites](https://developer.apple.com/documentation/applemusicapi/add-resource-to-favorites): 202 empty response; favorite songs join Favorite Songs. | Typed preview/apply for songs, albums and playlists; accepted/unverified. No invented remove-favorite endpoint. Contract-tested, live write qualification pending. |
| Ratings | [Ratings API](https://developer.apple.com/documentation/applemusicapi/ratings-api): 1 like, -1 dislike, DELETE clears. | Read plus cohesive preview/apply for catalog/library resource ratings. Before-state check, durable partial progress, readback and blocked unknown states. Contract-tested. Ratings, favorites and native star ratings remain distinct; personal taste is not changed for testing. |
| Personalized discovery | Recommendations, heavy rotation, recent tracks, recently added. | Implemented bounded views. These are not a complete listening event archive. |
| Replay | [Music summaries](https://developer.apple.com/documentation/applemusicapi/get-the-user's-replay-data): latest eligible year and top songs/albums/artists. | New `get_replay_summary`; no arbitrary-year or lifetime history claim. Eligibility may produce no result. |
| Mac playback | Music.app scripting supports transport, volume, seek, shuffle, repeat. [ApplicationMusicPlayer](https://developer.apple.com/documentation/musickit/applicationmusicplayer) plays our own app's session; [SystemMusicPlayer](https://developer.apple.com/documentation/musickit/systemmusicplayer) excludes macOS. | Music.app automation controls the actual player. Compatibility bridge qualified; current Swift helper compiled and passed all four tests under the shared gate; its desktop permission/runtime qualification remains separate. |
| Windows playback | Official Apple Music media session capabilities vary with active app/session. | Experimental SMTC status/transport/seek, no targeted catalog play or session volume. Interactive desktop qualification pending; SSH is insufficient. |
| Cider playback/queue | Authenticated local [RPC API](https://github.com/ciderapp/docs/blob/main/docs/1.client/rpc.md), version-dependent. | Transport, targeted song play, queue. Loopback-only/token protected. Contract tests pass; live Windows Cider needs its application token configured. |
| AirPlay, EQ, crossfade, audio quality settings | Player/device features, not a general REST surface. | Research adapter-specific controls only for concrete use cases. No universal tool claim. |
| Lyrics, audio, BPM/key/energy | [Song attributes](https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary) include duration, ISRC, genres, lyrics presence and availability; no general BPM/key/energy/valence or full-lyrics export surface. | Never invent audio features or infer full-audio download access from previews. Supplied estimates retain provenance. Native BPM may be zero/absent. |
| Generate original cover | Separate from catalog artwork; REST playlist creation attributes document name/description, not upload. | Codex and experimental agy CLI, optional BYOK OpenAI/Gemini/OpenRouter. PNG/JPEG image/resource/export; local caps and 429 cooldown. Codex has live macOS evidence; agy trial produced no image; BYOK contract-tested without charged live calls. |
| Apply a cover | No custom-cover upload in reviewed REST playlist surface. Music.app dictionary describes writable artwork, but runtime behavior matters. | Empty disposable-playlist probe failed with -2710, Can't make class artwork; test playlist removed. Export/manual application supported. Existing-artwork replacement and UI handoff remain experiments. |

## Identity and write safety

Catalog song IDs, API library IDs, and native 16-digit persistent IDs are distinct. Cider takes catalog IDs. Uploaded songs may have no catalog counterpart. [Append requests](https://developer.apple.com/documentation/applemusicapi/libraryplaylisttracksrequest/data-data.dictionary) accept songs, library-songs, music-videos and library-music-videos.

Unreleased source separates the backend from recording namespaces, preserves direct Apple aliases for deduplication/readback, and retains legacy payload verification and fingerprint encoding. Relaxing numeric validation alone would break exact-order verification. ISRC/equivalent matches remain candidates: review versions, explicit status, availability and missing matches before substitution.

Mutations need preview, target identity/fingerprint, a durable claim before IO, accepted-ID persistence before readback, then verification or an honest pending/unknown state. A timeout never authorizes a second write. The JSON helper explicitly handles 202 empty acceptance and 204 empty deletion. Neither means a verified resource. Rating writes journal each attempted ID so a partial failure cannot silently replay the batch. Apple's RatingRequest object specifies type ratings while one endpoint example uses singular rating; the implementation follows the typed object and requires live qualification before claiming that ambiguity resolved.

## Tool budget and next implementation

0.4 extends existing brief/studio/artwork schemas and adds three cohesive preference/library tools: read preferences, preview a change, apply that plan. Installed 0.4 has 50 tools; unreleased full source adds one cohesive folder-browser tool, for 51. API-only mode omits playback tools. No separate tool per interview question, reroll, image provider or rating endpoint. Existing names remain compatible. No generic HTTP, raw script, shell, cookie scraping or arbitrary executable tool is exposed.

Priorities:

1. Live mixed catalog/library and folder qualification when a suitable requested write exists. Video writes remain outside the song-focused plan model.
2. Owned native playlist metadata edits and new-copy resequencing, with fingerprints; define safe entry-removal semantics before exposing removal.
3. Live qualification of requested library/preferences writes, then useful folder organization.
4. Qualified Windows media sessions and authenticated Cider; documented album/station targets.
5. Cover application only after a supported route passes a disposable live test. An owned web player is a larger optional product, not a hidden remote-control fallback.

Extend workflow schemas before adding one wrapper per endpoint. Keep compatible tools/profiles while learning which discovery wrappers can be consolidated.

The unreleased curation checkpoint adds listening stories through existing tools: contiguous chapters, fixed recording anchors, preserved album runs, runtime reports and six recipe guides. No extra wrapper per recipe. Story metadata is local, verified against the current playlist identity/order, and retained in snapshots and JSON exports. It does not claim Apple-native chapter markers, measured audio features or complete listening-history knowledge.
