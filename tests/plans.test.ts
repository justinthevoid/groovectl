import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync, readFileSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Plans, savePrivate } from "../src/storage.js";
import { MusicService, fingerprint } from "../src/service.js";
import { TrackRef } from "../src/models.js";
import { fixture, A, B, P } from "./helpers.js";

test("restart retry returns the durable result without another playlist", async () => {
	const f = fixture(),
		p = await f.music.preview("Restart", [{ source: "native", id: A }]);
	const first = await f.music.apply(p.plan_id);
	f.plans.close();
	const plans = new Plans(f.root),
		restarted = new MusicService(f.native, f.music.catalog, plans);
	assert.deepEqual(await restarted.apply(p.plan_id), first);
	assert.equal(f.native.writes, 1);
	plans.close();
});
test("timeout after creation is not retried and retains accepted playlist ID", async () => {
	const f = fixture();
	f.native.failAfterCreate = true;
	const p = await f.music.preview("Timeout", [{ source: "native", id: A }]);
	await assert.rejects(
		f.music.apply(p.plan_id),
		/blocked from automatic retry/,
	);
	assert.equal(f.plans.get(p.plan_id).state, "unknown");
	assert.equal(f.plans.get(p.plan_id).result?.accepted_playlist_id, P);
	await assert.rejects(f.music.apply(p.plan_id), /state is unknown/);
	assert.equal(f.native.writes, 1);
	f.plans.close();
});
test("a changed playlist is rejected before append", async () => {
	const f = fixture();
	await f.native.create("Target", [A]);
	const p = await f.music.preview("", [{ source: "native", id: B }], "", P);
	f.native.items.get(P)!.name = "Changed";
	await assert.rejects(f.music.apply(p.plan_id), /changed since preview/);
	assert.equal(f.native.writes, 1);
	assert.equal(f.plans.get(p.plan_id).state, "ready");
	f.plans.close();
});
test("duplicate recording references are removed in preview", async () => {
	const f = fixture(),
		p = await f.music.preview("Dedup", [
			{ source: "native", id: A },
			{ source: "native", id: A },
		]);
	assert.equal(p.payload.tracks.length, 1);
	assert.equal(p.payload.duplicates_removed, 1);
	assert.equal(f.native.writes, 0);
	f.plans.close();
});
test("append omits existing recordings and preserves ordered track verification", async () => {
	const f = fixture();
	await f.native.create("Target", [A]);
	const p = await f.music.preview(
		"",
		[
			{ source: "native", id: A },
			{ source: "native", id: B },
		],
		"",
		P,
	);
	assert.deepEqual(
		p.payload.tracks.map((t) => t.id),
		[B],
	);
	assert.equal((await f.music.apply(p.plan_id)).state, "applied");
	assert.deepEqual(
		(await f.native.playlist(P)).tracks.map((t) => t.id),
		[A, B],
	);
	f.plans.close();
});
test("cancelled and expired plans cannot write", async () => {
	const f = fixture(),
		p = await f.music.preview("Cancel", [{ source: "native", id: A }]);
	f.plans.cancel(p.plan_id);
	await assert.rejects(f.music.apply(p.plan_id), /cancelled/);
	const expired = f.plans.create(p.payload, -1);
	await assert.rejects(f.music.apply(expired.plan_id), /expired/);
	assert.equal(f.native.writes, 0);
	f.plans.close();
});
test("invalid IDs and mixed source plans cannot write", async () => {
	const f = fixture();
	assert.throws(() => TrackRef.parse({ source: "native", id: "1234" }));
	await assert.rejects(
		f.music.preview("Mixed", [
			{ source: "native", id: A },
			{ source: "catalog", id: "1234" },
		]),
		/one source/,
	);
	assert.equal(f.native.writes, 0);
	f.plans.close();
});
test("deletion requires the exact owned name and unchanged playlist", async () => {
	const f = fixture(),
		p = await f.music.preview("Owned", [{ source: "native", id: A }]);
	await f.music.apply(p.plan_id);
	await assert.rejects(
		f.music.deleteCreated(p.plan_id, "Other"),
		/exactly match/,
	);
	f.native.items.get(P)!.tracks.push(f.native.songs.get(B)!);
	await assert.rejects(
		f.music.deleteCreated(p.plan_id, "Owned"),
		/changed after creation/,
	);
	f.native.items.get(P)!.tracks.pop();
	assert.equal(
		(await f.music.deleteCreated(p.plan_id, "Owned")).state,
		"deleted",
	);
	f.plans.close();
});
test("missing audio features are not invented; supplied slow tempos are audited", async () => {
	const f = fixture(),
		refs = [A, B].map((id) => ({ source: "native" as const, id }));
	const no = await f.music.preview("No estimates", refs);
	assert.deepEqual(no.payload.audit.adjacency_warnings, []);
	const yes = await f.music.preview("Estimates", refs, "", undefined, [
		{ id: A, bpm: 80 },
		{ id: B, bpm: 90 },
	]);
	assert.deepEqual(yes.payload.audit.adjacency_warnings, [
		{ from_position: 1, to_position: 2, rules: ["two_slow"] },
	]);
	f.plans.close();
});
test("configuration and journal files are private from creation on POSIX", () => {
	const f = fixture(),
		path = join(f.root, "private.json");
	savePrivate(path, { secret: "synthetic-fixture" });
	assert.equal(
		JSON.parse(readFileSync(path, "utf8")).secret,
		"synthetic-fixture",
	);
	if (process.platform !== "win32") {
		assert.equal(statSync(path).mode & 0o777, 0o600);
		assert.equal(statSync(join(f.root, "plans.sqlite3")).mode & 0o777, 0o600);
	}
	f.plans.close();
});
test("order mismatch becomes needs_review and cannot be reapplied", async () => {
	const f = fixture();
	f.native.reverseReadback = true;
	const p = await f.music.preview(
		"Order",
		[A, B].map((id) => ({ source: "native", id })),
	);
	assert.equal((await f.music.apply(p.plan_id)).state, "needs_review");
	await assert.rejects(f.music.apply(p.plan_id), /needs_review/);
	assert.equal(f.native.writes, 1);
	f.plans.close();
});
test("concurrent apply calls create only one playlist", async () => {
	const f = fixture(),
		p = await f.music.preview("Concurrent", [{ source: "native", id: A }]);
	const results = await Promise.all([
		f.music.apply(p.plan_id),
		f.music.apply(p.plan_id),
	]);
	assert.equal(f.native.writes, 1);
	assert.deepEqual(results[0], results[1]);
	f.plans.close();
});
test("a failed mutation-lock open does not deadlock later operations", {
	timeout: 3000,
}, async () => {
	const f = fixture(),
		file = join(f.root, "mutation.sqlite3");
	mkdirSync(file);
	await assert.rejects(f.plans.mutation(async () => true));
	rmdirSync(file);
	assert.equal(await f.plans.mutation(async () => "recovered"), "recovered");
	f.plans.close();
});
test("fingerprints match legacy Python including Unicode and punctuation", async () => {
	const f = fixture();
	await f.native.create('Crème 🎵, \"v1\": mix', [A, B]);
	const playlist = await f.native.playlist(P);
	const python = spawnSync(
		process.platform === "win32" ? "python" : "python3",
		[
			"-Xutf8",
			"-c",
			'import sys,json,hashlib;p=json.load(sys.stdin);print(hashlib.sha256(json.dumps([p["id"],p["name"],[(t["source"],t["id"]) for t in p["tracks"]]],sort_keys=True).encode()).hexdigest())',
		],
		{ input: JSON.stringify(playlist), encoding: "utf8" },
	);
	// The port runs without Python; this optional oracle checks compatibility when Python is installed.
	if (!python.error && python.status === 0)
		assert.equal(fingerprint(playlist), python.stdout.trim());
	assert.equal(
		fingerprint(playlist),
		"af2432b6ee031224bdbadba5b4478e85332fb6d56962cb61ebf8204169ed4207",
	);
	f.plans.close();
});
