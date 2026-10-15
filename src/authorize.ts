import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { AppleCatalog } from "./catalog.js";
import { savePrivate } from "./storage.js";
import { VERSION } from "./version.js";

const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Groovectl</title><style>body{font:17px system-ui;margin:8vh auto;padding:24px;max-width:520px;color:#202128;background:#f7f7fa}button{font:inherit;background:#bd2547;color:white;border:0;border-radius:12px;padding:14px 22px;cursor:pointer}p{line-height:1.6}button:disabled{opacity:.5}</style>
<h1>Connect Apple Music</h1><p>Allow Groovectl to browse your library and create playlists when you ask. Your Apple password stays with Apple. Your MusicKit private key stays on this computer.</p>
<button id="connect" disabled>Continue with Apple Music</button><p id="status" role="status">Loading Apple’s MusicKit…</p>
<script>const status=document.querySelector('#status');document.addEventListener('musickitloaded',async()=>{try{const r=await fetch('./config');const c=await r.json();await MusicKit.configure({developerToken:c.developerToken,app:{name:'Groovectl',build:'${VERSION}'}});document.querySelector('#connect').disabled=false;status.textContent='Ready to connect.';}catch(e){status.textContent='Unable to initialize MusicKit. Check the local server.'}});document.querySelector('#connect').onclick=async()=>{try{status.textContent='Waiting for Apple authorization…';const token=await MusicKit.getInstance().authorize();const r=await fetch('./complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw new Error();status.textContent='Connected. You can close this window.';document.querySelector('#connect').disabled=true;}catch(e){status.textContent='Connection was cancelled or could not be verified. You can try again.'}};</script>
<script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js" async></script></html>`;
export const AuthorizationOptions = z
	.object({
		port: z
			.number()
			.int()
			.refine((n) => n === 0 || (n >= 1024 && n <= 65535), {
				message: "Use port 0 or an unprivileged port between 1024 and 65535.",
			})
			.default(0),
		timeoutMs: z.number().int().min(1000).max(600000).default(600000),
	})
	.strict();
export async function startAuthorization(
	catalog = new AppleCatalog(),
	options: { port?: number; timeoutMs?: number } = {},
) {
	const settings = AuthorizationOptions.parse(options);
	const developerToken = await catalog.developerToken(),
		nonce = randomBytes(32).toString("base64url");
	let origin = "",
		finish!: (value: boolean) => void;
	const completed = new Promise<boolean>((resolve) => {
		finish = resolve;
	});
	let closing = false,
		timer: ReturnType<typeof setTimeout>;
	const server = createServer(async (req, res) => {
		const reply = (status: number, body = "{}", type = "application/json") => {
			res.writeHead(status, {
				"Content-Type": type,
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"Referrer-Policy": "no-referrer",
				"X-Frame-Options": "DENY",
			});
			res.end(body);
		};
		if (
			closing ||
			req.headers.host !== new URL(origin).host ||
			!req.url?.startsWith(`/${nonce}/`)
		) {
			reply(404);
			return;
		}
		if (req.method === "GET" && req.url === `/${nonce}/`) {
			reply(200, page, "text/html;charset=utf-8");
			return;
		}
		if (req.method === "GET" && req.url === `/${nonce}/config`) {
			reply(200, JSON.stringify({ developerToken }));
			return;
		}
		if (
			req.method !== "POST" ||
			req.url !== `/${nonce}/complete` ||
			req.headers.origin !== origin ||
			req.headers["content-type"]?.split(";")[0] !== "application/json"
		) {
			reply(403);
			return;
		}
		const length = Number(req.headers["content-length"]);
		if (!Number.isInteger(length) || length < 1 || length > 32768) {
			reply(400);
			return;
		}
		try {
			let body = "";
			for await (const chunk of req) {
				body += chunk.toString("utf8");
				if (Buffer.byteLength(body) > 32768) {
					reply(413);
					return;
				}
			}
			const { token } = z
				.object({ token: z.string().min(11).max(29999) })
				.strict()
				.parse(JSON.parse(body));
			const result = await catalog.request("GET", "/v1/me/storefront", {
				personal: true,
				userToken: token,
			});
			const storefront = z
				.string()
				.regex(/^[a-z]{2}$/)
				.parse(result.data?.[0]?.id);
			savePrivate(join(catalog.root, "user.json"), {
				music_user_token: token,
				authorized_at: Date.now() / 1000,
			});
			savePrivate(join(catalog.root, "musickit.json"), {
				...catalog.config(),
				storefront,
			});
			reply(200, '{"connected":true}');
			res.once("finish", () => close(true));
		} catch {
			reply(400);
		}
	});
	server.requestTimeout = 10000;
	server.headersTimeout = 10000;
	server.keepAliveTimeout = 1000;
	function close(success = false) {
		if (closing) return;
		closing = true;
		clearTimeout(timer);
		server.close();
		finish(success);
	}
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(settings.port, "127.0.0.1", () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Authorization callback could not bind loopback.");
	origin = `http://127.0.0.1:${address.port}`;
	timer = setTimeout(() => close(), settings.timeoutMs);
	return { url: `${origin}/${nonce}/`, completed, close };
}
