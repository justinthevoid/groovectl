# Optional interviews and inspiration

The user's brief is the source of truth. If it already specifies 45 minutes of clean 1970s soul for dinner without live recordings, proceed. Ask only questions whose answers change the music. Quick mode returns up to two missing questions; deep returns up to five. The user may answer freely, skip, ask you to choose, or request more ideas.

`get_playlist_studio` accepts draft_id, field, seed and seen option IDs. It returns up to six choices from over 200 starting points across 13 topics. include_questions requests all topics for a form; avoid sending the whole bank in ordinary conversation. Choices are inspiration, not verified songs or a taste profile.

For fresh choices, use your own ChatGPT/Codex/host reasoning. No new LLM service is needed. Read the saved intent, anchors, exclusions and answers, then save up to 12 label/value suggestions per field with save_listening_brief.suggestions. Values are typed: anchors/exclude arrays; duration integer; arc/discovery/explicit/vocals valid enum values. Each field replaces its custom list; an empty array clears it. Saving suggestions changes no answers and authorizes no music write.

Offer 3–6 distinct directions grounded in the brief: a natural fit, a neighboring style, a surprising but plausible turn, a quieter choice or a bolder one. Use specific space/rhythm/timbre ideas for a dub brief rather than generic happy/sad/energetic lists. Artist choices are seeds; resolve exact recordings later. Remember seen IDs to avoid immediate repeats. Do not dump the whole bank into a conversation.

## Random and reroll

save_listening_brief.randomize fills empty creative fields by default; only_empty:false rerolls unlocked creative answers. locked persists selected fields. Global remixes touch title, occasion, mood, textures, era, arc and cover direction; intent, anchors, duration, exclusions, explicit policy, familiarity and vocals remain unchanged. A single-field pick is also available. Explicit policy and exclusions cannot be randomized.

The bank does literal exclusion filtering, not semantic comprehension. Reconcile ideas with the original request: “1970s soul” wins over a random 1990s era; “no vocals” wins over a suggested vocal texture. Treat generated fields as provisional inspiration. Reject conflicts; never relax a user constraint because a reroll suggested it. Silence grants no image-generation, creation, playback or deletion permission.

The dashboard has six idea buttons, More ideas, Pick for me, a lock, Fill in the blanks and Reroll unlocked ideas. Changes stay in the draft until saved. Ask my agent sends a user-initiated host message; support depends on the host. If unsupported, ask conversationally. Refresh after the agent saves suggestions.

## Short interview examples

- Dinner: ask about familiar warmth versus discoveries, then duration if missing.
- A taste bridge: ask whether groove, voice, atmosphere or production should connect the two anchors.
- Brain-off request: choose one coherent concept and a reasonable length, show a short description and offer a reroll. Do not ask all 13 questions.
- Cover: offer a place, still life, abstract material, photographic scene or paper sculpture shaped by the music. Browse directions before spending image quota.
