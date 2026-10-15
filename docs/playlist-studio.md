# Playlist studio

The home workflow is **brief → recordings → sequence → cover**, with a compact persistent player. Library is a reference surface; Activity is the write journal. It is an MCP App with OpenAI Extensions thread/global entry metadata. The [host UI contract](https://developers.openai.com/plugins/build/chatgpt-ui) and [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines) support compact inline and immersive fullscreen use.

## Implemented scope

Private saved briefs, optional quick/deep questions, over 200 inspiration choices across 13 topics, fresh host-agent suggestions, locks and random/reroll controls, bounded Surprise me concepts, catalog search, exact-ID selection, accessible ordering/removal, runtime, immutable previews, explicit creation/cancellation, recording inspection, alternate-version/uncertain-write warnings, multi-provider cover jobs and PNG/JPEG display, selected-player transport, API playlist browsing, Activity/setup state.

Host themes, keyboard focus, responsive layout, reduced motion and error-preserved form input are part of the implementation. A fake analytics dashboard or autoplaying player is not useful here.

The Library view loads the first 100 API playlists. Unsaved manual recording selection lives in the UI session until previewed; closing before preview loses that selection. Draft metadata persists locally. An agent can curate from a saved brief, save a preview, then the user can load its sequence from Activity. Deterministic code does not pretend to supply musical taste.

## Chapters, anchors and recipes

Ask get_playlist_studio with include_recipes:true for six starting points: three-act, Side A / Side B, taste bridge, album flight, rediscovery and time capsule. They supply useful questions and listening ideas. The host agent still chooses and resolves the recordings. A recipe does not claim to know a user's history, measure audio features or automatically select songs.

Pass an optional story to sequence_playlist. Chapter ranges use 1-based positions in the supplied pool, cover every recording exactly once, and determine membership before sequencing. Exact TrackRef anchors pin final positions within their chapter. A chapter with ordering:"preserve" keeps its input order, useful for an album mini-run. The sequencer reports conflicts when those constraints prevent ideal artist spacing; it never moves an anchor across a boundary.

For an already chosen six-recording mix, a story can contain:

```json
{
  "recipe": "side-a-side-b",
  "chapters": [
    { "title": "Side A — draw me in", "start": 1, "end": 3 },
    { "title": "Side B — open things up", "start": 4, "end": 6 }
  ],
  "runtime_budget_minutes": 25,
  "runtime_tolerance_minutes": 2
}
```

Add anchors only with real resolved recording references. The returned story and ordered tracks go together into preview_playlist. A structured preview rejects duplicate recordings instead of silently shrinking chapter ranges. Runtime is a report: it retains every recording, reports over/under budget, and marks missing durations incomplete. It does not truncate or substitute music to hit a target.

Stories are private Groovectl metadata, not an Apple playlist feature. After a verified write, they follow the playlist through reads, snapshots and JSON exports while the exact identity, name and recording order still match. External edits mark metadata stale; it is not attached to the changed mix. Import/restore revalidates both recordings and structure. M3U8 adds optional chapter-range comments; JSON preserves the full structure. Appending music does not guess new chapter ranges.

In the MCP App, Activity can load a structured plan into Sequence. Chapters and pins are visible, and Space artists respects them. Manual movement/removal is disabled until you explicitly remove the constraints; adding a new recording clears the old structure with a notice so you can ask the agent to rebuild it. Saved plans and Apple Music are unchanged by these draft edits.

## Optional interview flow

Do not force a questionnaire on a complete request. A 45-minute clean soul dinner playlist, no live versions, mostly 1970s already answers the high-impact questions. Save it and proceed with reasonable stated assumptions.

Quick asks at most two missing questions; deep asks up to five. Topics: context, anchors, duration, explicit preference, exclusions. Discovery balance and listening arc are fields. Unspecified explicit policy stays unspecified. Skipping a form never grants permission for playback, generation or writes.

An optional inspiration drawer covers name, occasion, mood, sound, anchors, era, duration, discovery, arc, voices, cover direction, explicit preference and exclusions. It shows six choices at a time, remembers seen IDs during the session and cycles when exhausted. Host agents can save up to 12 fresh typed suggestions per field through save_listening_brief; these take visible priority over the bank. No separate LLM service is needed. Ask my agent sends a user-clicked MCP Apps message; unsupported hosts can continue conversationally.

Clicking an idea or typing an answer locks it against rerolls. More ideas changes options without changing answers. Pick for me chooses an unlocked field; policy/exclusions require direct choice. Fill in the blanks leaves existing answers alone. Reroll unlocked ideas touches only creative fields, preserving original intent, anchors, duration, familiarity, voices and hard policies. These are draft changes until saved. Persistent locks travel with the brief; seen-option history stays in the UI session.

Bank filtering is literal, not semantic. The agent must reconcile a random era/texture with the original request. Original intent and constraints take precedence over generated inspiration. A brain-off request should get one coherent proposal and a reroll option, never a compulsory 13-question form.

`save_listening_brief` returns structured questions and a small JSON form schema. The dashboard has real form fields; text agents can ask conversationally or use their host's form tool. Native MCP elicitation is planned progressive enhancement: SDK 2's newer multi-round-trip protocol differs from legacy elicitation. A returned schema alone does not create a modal everywhere. Test accepted/declined/cancelled behavior in both eras before adding it.

## Creative recipes, not extra tools

| Recipe | Creative purpose | Grounding |
| --- | --- | --- |
| Three-act soundtrack | Establish a place, introduce contrast, land convincingly. | Ask about the destination only if it changes the music; do not claim measured energy. |
| Taste bridge | Connect two anchors through a musical hinge. | Exact verified endpoints; no invented collaborations. |
| Side A / Side B | Contrasting halves, purposeful hinge, strong opener/closer. | Real runtime with tolerance. |
| Rediscovery night | Familiar library anchors with neglected discoveries. | Bounded samples are not complete listening history. |
| Time capsule | An era/place with original-release context. | Distinguish recording era from rerelease date; verify claims. |
| Discovery dial | Familiar, balanced, adventurous around anchors. | A creative preference, not a numeric novelty score. |
| Commute with a landing | Fit a time window and closing mood. | Report actual duration and overrun/shortfall; no autoplay. |
| Cover first | Build an evocative sleeve, curate its soundtrack. | Generation, playlist creation and cover application stay separate. |

Surprise currently chooses among four original concepts with an integer seed. Caller exclusions and explicit policy remain intact. It is reproducible inspiration, not random catalog selection or claimed personalization.

The cover stage explicitly selects among configured Codex, experimental agy and BYOK providers and shows local attempts remaining. See [artwork setup and qualification](artwork.md). Activity distinguishes preference/library changes from playlist creation and displays accepted/unverified results without claiming completion.

## Next product work

Add recording inspectors with release/explicit/availability provenance, saved narrative sections, duration tolerance, cover history tied to brief revisions and a clear new-playlist/existing-owned-playlist choice. Keep the host's musical reasoning in conversation and concrete selections in the studio. Qualify offline, auth-missing, no-results, partial resolution, changed target, expired plan, uncertain write and unsupported player states. Check narrow phone and fullscreen desktop, light/dark and keyboard use.
