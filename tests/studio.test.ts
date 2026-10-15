import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFileSync, writeFileSync, symlinkSync } from "node:fs";
import {
	Studio,
	ListeningBrief,
	BriefPatch,
	interview,
	surpriseBrief,
	coverPrompt,
} from "../src/studio.js";
import { Artwork, imageInfo, artworkEnvironment } from "../src/artwork.js";
import { savePrivate } from "../src/storage.js";
import { root, fixture } from "./helpers.js";
import { createTools } from "../src/tools.js";
import { Cider } from "../src/players.js";

const brief = () =>
	ListeningBrief.parse({
		title: "Dinner",
		intent: "Clean 1970s soul, no live versions",
		context: "dinner",
		duration_minutes: 45,
		anchors: ["Al Green"],
		exclude: ["live"],
		explicit: "avoid",
	});
import { pngHeader } from "./artwork-fixture.js";

test("complete brief skips questions; quick and deep interviews stay bounded", () => {
	assert.deepEqual(interview(brief(), "deep").questions, []);
	const minimal = ListeningBrief.parse({
		title: "Tonight",
		intent: "something good",
	});
	assert.equal(interview(minimal, "quick").questions.length, 2);
	assert.equal(interview(minimal, "deep").questions.length, 5);
	assert.equal(interview(minimal, "surprise").questions.length, 0);
	assert.equal(minimal.explicit, "unspecified");
});
test("surprise is reproducible and preserves exclusions and policy", () => {
	const a = surpriseBrief(2, { exclude: ["covers"], explicit: "avoid" });
	assert.deepEqual(
		a,
		surpriseBrief(2, { exclude: ["covers"], explicit: "avoid" }),
	);
	assert.deepEqual(a.exclude, ["covers"]);
	assert.equal(a.explicit, "avoid");
	assert.notEqual(a.title, surpriseBrief(3).title);
});
test("brief patches preserve supplied preferences, save across restarts, reject path IDs", () => {
	const directory = root(),
		studio = new Studio(directory),
		saved = studio.save(brief(), "deep");
	const patch = BriefPatch.parse({ context: "friends over" });
	assert.equal(patch.explicit, undefined);
	assert.equal(patch.anchors, undefined);
	const updated = studio.save(
		ListeningBrief.parse({ ...saved.brief, ...patch }),
		"quick",
		saved.draft_id,
	);
	assert.equal(
		new Studio(directory).get(saved.draft_id).brief.explicit,
		"avoid",
	);
	assert.deepEqual(updated.brief.anchors, ["Al Green"]);
	assert.equal(studio.list().length, 1);
	assert.throws(() => studio.get("../../credentials"));
	assert.match(coverPrompt(updated.brief), /No lettering/);
});
test("tool-level patch does not materialize defaults over earlier constraints", async () => {
	const f = fixture();
	try {
		const tools = createTools(
			f.music,
			{
				name: "native",
				status: () => f.native.status(),
				playback: (r) => f.native.playback(r),
			},
			new Cider("http://127.0.0.1:10767"),
		);
		const save = tools.find((t) => t.name === "save_listening_brief")!;
		const first = await save.execute({ brief: brief(), mode: "deep" });
		const second = await save.execute({
			draft_id: first.draft_id,
			brief: { context: "patio" },
		});
		assert.equal((second.brief as ReturnType<typeof brief>).explicit, "avoid");
		assert.equal(f.native.writes, 0);
	} finally {
		f.plans.close();
	}
});
test("artwork is opt-in, same-request deduplicated, changed prompt rejected", () => {
	const a = new Artwork(root()),
		request = randomUUID();
	let launches = 0;
	assert.throws(() => a.create("night", request, () => launches++), /disabled/);
	a.configure(process.execPath);
	const first = a.create("night", request, () => launches++);
	assert.equal(
		a.create("night", request, () => launches++).artwork_id,
		first.artwork_id,
	);
	assert.equal(launches, 1);
	assert.throws(
		() => a.create("different", request, () => launches++),
		/different artwork brief/,
	);
	assert.equal(first.applied_to_playlist, false);
	assert.throws(() => a.image(first.artwork_id), /not complete/);
});
test("failed artwork startup remains inspectable and is never replayed", () => {
	const a = new Artwork(root());
	a.configure(process.execPath);
	const request = randomUUID();
	const first = a.create("night", request, () => {
		throw new Error("launch");
	});
	assert.equal(first.state, "failed");
	assert.equal(
		a.create("night", request, () => {
			throw new Error("replayed");
		}).state,
		"failed",
	);
});
test("PNG budget rejects HTML, oversized dimensions and mismatched aspect ratio", () => {
	assert.throws(
		() => imageInfo(Buffer.from("<html>not a cover</html>")),
		/PNG/,
	);
	const b = pngHeader();
	assert.equal(imageInfo(b).width, 1024);
	b.writeUInt32BE(1000, 16);
	assert.throws(() => imageInfo(b), /square/);
	b.writeUInt32BE(8192, 16);
	b.writeUInt32BE(8192, 20);
	assert.throws(() => imageInfo(b), /square/);
	assert.throws(() => imageInfo(Buffer.alloc(9 * 1024 * 1024)), /PNG/);
});
test("returned artwork is immutable and cannot be replaced with a symlink", {
	skip: process.platform === "win32",
}, () => {
	const a = new Artwork(root());
	a.configure(process.execPath);
	const job = a.create("night", randomUUID(), () => {});
	const folder = join(a.root, "artwork", job.artwork_id),
		file = join(folder, "cover.png"),
		bytes = pngHeader();
	writeFileSync(file, bytes);
	const metadata = JSON.parse(readFileSync(join(folder, "job.json"), "utf8"));
	savePrivate(join(folder, "job.json"), {
		...metadata,
		...imageInfo(bytes),
		state: "complete",
	});
	assert.equal(a.image(job.artwork_id).data, bytes.toString("base64"));
	writeFileSync(file, Buffer.concat([bytes, Buffer.from("changed")]));
	assert.throws(() => a.image(job.artwork_id), /changed/);
	const other = join(folder, "other.png");
	writeFileSync(other, bytes);
	unlink(file);
	symlinkSync(other, file);
	assert.throws(() => a.image(job.artwork_id), /Invalid/);
});
import { unlinkSync as unlink } from "node:fs";
test("artwork worker refuses API-key/unrecognized login without generating", async () => {
	const a = new Artwork(root());
	a.configure(process.execPath);
	const job = a.create("night", randomUUID(), () => {});
	await a.run(job.artwork_id);
	assert.equal(a.get(job.artwork_id).state, "failed");
	assert.match(a.get(job.artwork_id).error!, /signed in using ChatGPT/);
});
test("child environment strips credentials and keeps local authentication configuration", () => {
	const env = artworkEnvironment(
		{
			PATH: "bin",
			HOME: "home",
			CODEX_HOME: "codex",
			OPENAI_API_KEY: "secret",
			CIDER_API_TOKEN: "secret",
			MUSICKIT_KEY_PATH: "secret",
			OTHER_SECRET: "secret",
		},
		"jobtmp",
	);
	assert.equal(env.CODEX_HOME, "codex");
	assert.equal(env.PATH, "bin");
	assert.equal(env.OPENAI_API_KEY, undefined);
	assert.equal(env.CIDER_API_TOKEN, undefined);
	assert.equal(env.TMPDIR, "jobtmp");
});
