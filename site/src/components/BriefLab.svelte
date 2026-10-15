<script lang="ts">
 import { gsap } from "gsap";
 import { onMount } from "svelte";
 let ready = $state(false);
 onMount(() => { ready = true; });
 const questions = [
  { key: "scene", label: "Where are we listening?", options: ["The long way home", "Dinner with the windows open", "A quiet Sunday morning", "A tiny kitchen dance floor", "A midnight train", "An afternoon with nowhere to be", "A rain-soaked city walk", "The last hour of a road trip"] },
  { key: "sound", label: "What should it feel like?", options: ["Warm, textured and a little unexpected", "Tender, spacious and unhurried", "Restless, bright and full of left turns", "Dusty soul meeting modern electronics", "Guitars that slowly turn into a daydream", "Jazz around the edges", "A gentle lift into a joyful finish", "Soft voices and beautifully strange details"] },
  { key: "journey", label: "How adventurous?", options: ["Mostly discoveries, with a few familiar anchors", "An even mix of favorites and new finds", "Start familiar, then take me somewhere new", "An album flight: a few recordings from each of four artists", "A taste bridge between two musical worlds", "Side A draws me in; Side B opens things up", "Rediscover forgotten corners of my library", "A time capsule with a few present-day echoes"] },
 ] as const;
 type Key = typeof questions[number]["key"];
 let answers = $state<Record<Key,string>>({ scene: questions[0].options[0], sound: questions[1].options[0], journey: questions[2].options[0] });
 let locked = $state<Record<Key,boolean>>({ scene: false, sound: false, journey: false });
 let exclusions = $state("No live versions. Avoid consecutive songs by the same artist.");
 let copied = $state(false), copyError = $state("");
 let suggestionStatus = $state("");
 const brief = $derived("Make me a 60-minute Apple Music playlist for: " + answers.scene.toLowerCase() + ".\n\n" + answers.sound + ". " + answers.journey + ".\n\n" + exclusions.trim() + "\n\nChoose exact recordings, explain the listening flow, and show me the playlist before creating it. Suggest an original cover direction too.");
 const allLocked = $derived(Object.values(locked).every(Boolean));
 function reroll(key: Key) {
  if(locked[key]) return;
  const alternatives = questions.find(q => q.key === key)!.options.filter(option => option !== answers[key]);
  answers[key] = alternatives[Math.floor(Math.random() * alternatives.length)]!;
  copied = false; copyError = "";
  suggestionStatus = questions.find(q => q.key === key)!.label + " " + answers[key];
 }
 function acknowledge(event: MouseEvent) {
  const icon = (event.currentTarget as HTMLElement).querySelector("svg");
  if (!icon || document.documentElement.classList.contains("motion-paused") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.killTweensOf(icon);
  gsap.fromTo(icon, { rotation: 0 }, { rotation: 180, duration: 0.22, ease: "expo.out", clearProps: "transform" });
  gsap.fromTo(".brief-output", { backgroundColor: "#f2e4d3" }, { backgroundColor: "#faf7ef", duration: 0.4, ease: "power2.out", clearProps: "backgroundColor" });
 }
 function surprise(event: MouseEvent) {
  for (const q of questions) reroll(q.key);
  suggestionStatus = "New suggestions chosen. Kept answers and exclusions are unchanged.";
  acknowledge(event);
 }
 async function copy() {
  try { await navigator.clipboard.writeText(brief); copied = true; copyError = ""; }
  catch { copyError = "Clipboard access is unavailable. Select the brief below and copy it."; }
 }
</script>

<div class="brief-lab">
 <fieldset class="questions" disabled={!ready}>
  <legend class="sr-only">Listening brief choices</legend>
  {#each questions as question}
   <div class="question">
    <div class="question-heading">
     <label for={"demo-" + question.key}>{question.label}</label>
     <label class="lock"><input type="checkbox" aria-label={"Keep answer: " + question.label} bind:checked={locked[question.key]} /> Keep this</label>
    </div>
    <div class="answer-row">
     <select id={"demo-" + question.key} bind:value={answers[question.key]} onchange={() => copied = false}>
      {#each question.options as option}<option>{option}</option>{/each}
     </select>
     <button class="reroll" type="button" disabled={locked[question.key]} aria-label={"Reroll " + question.label.toLowerCase()} onclick={(event) => { reroll(question.key); acknowledge(event); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6"/></svg>
     </button>
    </div>
   </div>
  {/each}
  <label class="exclusions" for="demo-exclusions">Anything to keep out?</label>
  <textarea id="demo-exclusions" rows="2" bind:value={exclusions} oninput={() => copied = false}></textarea>
  <button class="button secondary" type="button" onclick={surprise} disabled={allLocked}>
   {allLocked ? "All choices kept" : "Surprise me"}
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 4-3 4 3 4-3 4 3v10l-4 3-4-3-4 3-4-3zM8 4v13m4-10v10m4-13v13"/></svg>
  </button>
  <p class="small">Keep the parts you like. Reroll the rest. Your choices stay in this browser.</p>
  <p class="sr-only" aria-live="polite" aria-atomic="true">{suggestionStatus}</p>
 </fieldset>
 <div class="brief-output">
  <div class="output-heading"><span>{ready ? "Your listening brief" : "Sample listening brief"}</span><span class="duration">60 min</span></div>
  <div role="region" aria-label="Your listening brief" tabindex="0" class="brief-text">{brief}</div>
  <button class="button primary" type="button" onclick={copy} disabled={!ready}>
   {copied ? "Brief copied" : "Copy listening brief"}
   <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg>
  </button>
  <p class="small" aria-live="polite">{copyError || (copied ? "Paste it into your connected agent to start curating." : "Try it with Groovectl in your agent. This demo composes a brief; it does not access an account.")}</p>
 </div>
</div>
