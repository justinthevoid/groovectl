import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	openSync,
	closeSync,
	readFileSync,
	writeFileSync,
	renameSync,
	unlinkSync,
	fsyncSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { Playlist, Source, Track } from "./models.js";

export function dataDir(): string {
	const legacy = join(homedir(), ".config/apple-music-hybrid");
	const root =
		process.env.GROOVECTL_DATA ??
		process.env.APPLE_MUSIC_HYBRID_DATA ??
		(existsSync(join(legacy, "musickit.json"))
			? legacy
			: process.platform === "win32"
				? join(process.env.APPDATA ?? homedir(), "Groovectl")
				: join(homedir(), ".config/groovectl"));
	mkdirSync(root, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") chmodSync(root, 0o700);
	return root;
}
export function savePrivate(file: string, value: unknown): void {
	mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
	const temp = join(dirname(file), `.write-${randomUUID()}`);
	const fd = openSync(temp, "wx", 0o600);
	try {
		writeFileSync(fd, JSON.stringify(value));
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	try {
		renameSync(temp, file);
	} finally {
		if (existsSync(temp)) unlinkSync(temp);
	}
}
export function loadPrivate(file: string): unknown {
	return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

const Payload = z
	.object({
		operation: z.enum(["create", "append", "change"]),
		source: Source,
		name: z.string(),
		description: z.string(),
		tracks: z.array(Track),
		playlist_id: z.string().nullish(),
		before_fingerprint: z.string().nullish(),
		expected_ids: z.array(z.string()),
		expected_tracks: z.array(Track).optional(),
		audit: z.record(z.string(), z.unknown()),
		duplicates_removed: z.number(),
	})
	.passthrough();
export type PlanPayload = z.infer<typeof Payload>;
export const Plan = z.object({
	plan_id: z.string(),
	payload: Payload,
	expires_at: z.number(),
	state: z.enum([
		"ready",
		"applying",
		"applied",
		"accepted",
		"needs_review",
		"unknown",
		"cancelled",
		"deleting",
		"deleted",
	]),
	result: z.record(z.string(), z.unknown()).nullable(),
});
export type Plan = z.infer<typeof Plan>;
export class Plans {
	private db: DatabaseSync;
	private tail: Promise<unknown> = Promise.resolve();
	constructor(readonly root = dataDir()) {
		mkdirSync(root, { recursive: true, mode: 0o700 });
		const file = join(root, "plans.sqlite3");
		closeSync(openSync(file, "a", 0o600));
		if (process.platform !== "win32") chmodSync(file, 0o600);
		this.db = new DatabaseSync(file);
		this.db.exec(
			"PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires REAL NOT NULL, state TEXT NOT NULL, result TEXT)",
		);
	}
	create(payload: PlanPayload, ttl = 7200): Plan {
		const id = randomUUID();
		this.db
			.prepare("INSERT INTO plans VALUES (?, ?, ?, 'ready', NULL)")
			.run(id, JSON.stringify(Payload.parse(payload)), Date.now() / 1000 + ttl);
		return this.get(id);
	}
	get(id: string): Plan {
		const row = this.db.prepare("SELECT * FROM plans WHERE id=?").get(id);
		if (!row) throw new Error("Unknown plan ID. Preview a playlist first.");
		return Plan.parse({
			plan_id: id,
			payload: JSON.parse(String(row.payload)),
			expires_at: row.expires,
			state: row.state,
			result: row.result ? JSON.parse(String(row.result)) : null,
		});
	}
	claim(id: string): Plan {
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const plan = this.get(id);
			if (plan.state !== "ready")
				throw new Error(
					"Plan is no longer ready; inspect the saved result. Do not retry writes.",
				);
			if (plan.expires_at < Date.now() / 1000)
				throw new Error("Plan expired; preview again.");
			this.db.prepare("UPDATE plans SET state='applying' WHERE id=?").run(id);
			this.db.exec("COMMIT");
		} catch (e) {
			this.db.exec("ROLLBACK");
			throw e;
		}
		return this.get(id);
	}
	finish(
		id: string,
		state: Plan["state"],
		result: Record<string, unknown>,
	): void {
		this.db
			.prepare("UPDATE plans SET state=?, result=? WHERE id=?")
			.run(state, JSON.stringify(result), id);
	}
	cancel(id: string): Plan {
		this.db
			.prepare(
				"UPDATE plans SET state='cancelled' WHERE id=? AND state='ready'",
			)
			.run(id);
		return this.get(id);
	}
	recent(): Plan[] {
		return this.db
			.prepare("SELECT id FROM plans ORDER BY rowid DESC LIMIT 20")
			.all()
			.map((row) => this.get(String(row.id)));
	}
	close(): void {
		this.db.close();
	}
	async mutation<T>(action: () => Promise<T>): Promise<T> {
		const previous = this.tail;
		let release!: () => void;
		this.tail = new Promise<void>((r) => {
			release = r;
		});
		await previous;
		// A separate SQLite connection holds the process lock while plan claims remain durable.
		// An OS process exit releases this lock, leaving an applying/unknown plan blocked.
		const file = join(this.root, "mutation.sqlite3");
		let lock: DatabaseSync | undefined;
		try {
			closeSync(openSync(file, "a", 0o600));
			lock = new DatabaseSync(file);
			lock.exec("PRAGMA busy_timeout=1000; BEGIN IMMEDIATE");
			return await action();
		} finally {
			try {
				lock?.close();
			} finally {
				release();
			}
		}
	}
}
export function resultPlaylist(plan: Plan): Playlist {
	return Playlist.parse(plan.result?.playlist);
}
