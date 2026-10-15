"""One-time MusicKit JS authorization via a nonce-bound, loopback-only callback."""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import secrets
import time

from .catalog import AppleCatalog
from .storage import data_dir, save_private


def authorize(port=8769, timeout=600, on_ready=None):
    catalog = AppleCatalog()
    developer_token = catalog.developer_token()
    nonce = secrets.token_urlsafe(32)
    origin = f"http://127.0.0.1:{port}"
    completed = False
    page = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Apple Music Hybrid</title><style>body{font:17px system-ui;margin:8vh auto;padding:24px;max-width:520px;color:#202128;background:#f7f7fa}button{font:inherit;background:#bd2547;color:white;border:0;border-radius:12px;padding:14px 22px;cursor:pointer}p{line-height:1.6}button:disabled{opacity:.5}</style>
<h1>Connect Apple Music</h1><p>Allow Apple Music Hybrid to search your catalog and create playlists in your library. Your Apple password stays with Apple. The authorization token stays on this Mac.</p>
<button id="connect" disabled>Continue with Apple Music</button><p id="status" role="status">Loading Apple's MusicKit…</p>
<script>const status=document.querySelector('#status');document.addEventListener('musickitloaded',async()=>{try{const r=await fetch('./config');const c=await r.json();await MusicKit.configure({developerToken:c.developerToken,app:{name:'Apple Music Hybrid',build:'0.1.3'}});document.querySelector('#connect').disabled=false;status.textContent='Ready to connect.';}catch(e){status.textContent='Unable to initialize MusicKit. Check the local server.'}});document.querySelector('#connect').onclick=async()=>{try{status.textContent='Waiting for Apple authorization…';const token=await MusicKit.getInstance().authorize();const r=await fetch('./complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw new Error('Authorization could not be verified.');status.textContent='Connected. You can close this window.';document.querySelector('#connect').disabled=true;}catch(e){status.textContent='Connection was cancelled or could not be verified. You can try again.'}};</script>
<script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js" async></script></html>"""

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Callback paths and tokens never reach logs.

        def reply(self, status, body, content_type="application/json"):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body.encode())

        def valid(self):
            return self.headers.get("Host") == f"127.0.0.1:{port}" and self.path.startswith(
                f"/{nonce}/"
            )

        def do_GET(self):
            if not self.valid():
                return self.reply(404, "{}")
            if self.path == f"/{nonce}/":
                return self.reply(200, page, "text/html;charset=utf-8")
            if self.path == f"/{nonce}/config":
                return self.reply(200, json.dumps({"developerToken": developer_token}))
            self.reply(404, "{}")

        def do_POST(self):
            nonlocal completed
            if (
                not self.valid()
                or self.path != f"/{nonce}/complete"
                or self.headers.get("Origin") != origin
            ):
                return self.reply(403, "{}")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 32768:
                return self.reply(400, "{}")
            try:
                token = json.loads(self.rfile.read(length))["token"]
                if not isinstance(token, str) or not 10 < len(token) < 30000:
                    return self.reply(400, "{}")
                response = catalog.client.get(
                    catalog.base_url + "/v1/me/storefront",
                    headers={
                        "Authorization": "Bearer " + developer_token,
                        "Music-User-Token": token,
                    },
                )
                if response.status_code != 200:
                    return self.reply(401, "{}")
                storefront = response.json()["data"][0]["id"]
                save_private(
                    data_dir() / "user.json",
                    {"music_user_token": token, "authorized_at": time.time()},
                )
                config = catalog.config()
                config["storefront"] = storefront
                save_private(data_dir() / "musickit.json", config)
                completed = True
                self.reply(200, '{"connected":true}')
            except Exception:
                self.reply(400, "{}")

    with HTTPServer(("127.0.0.1", port), Handler) as server:
        server.timeout = 1
        url = origin + f"/{nonce}/"
        if on_ready:
            on_ready(url)
        else:
            print(url, flush=True)
        end = time.time() + timeout
        while not completed and time.time() < end:
            server.handle_request()
    return completed
