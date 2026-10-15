"""Private local configuration and a durable journal for non-repeatable writes."""

import contextlib
import fcntl
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import time
import uuid


def data_dir() -> Path:
    path = Path(
        os.environ.get("APPLE_MUSIC_HYBRID_DATA", "~/.config/apple-music-hybrid")
    ).expanduser()
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.chmod(0o700)
    return path


def save_private(path: Path, value: dict) -> None:
    # The temporary file is 0600 from creation, before any secret is written.
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".write-")
    try:
        with os.fdopen(fd, "w") as file:
            json.dump(value, file, ensure_ascii=False)
            file.flush()
            os.fsync(file.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def load_private(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


@contextlib.contextmanager
def mutation_lock():
    fd = os.open(data_dir() / "mutation.lock", os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


class Plans:
    def __init__(self, root: Path | None = None):
        self.path = (root or data_dir()) / "plans.sqlite3"
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        self.path.chmod(0o600)
        with self.db() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL, "
                "expires REAL NOT NULL, state TEXT NOT NULL, result TEXT)"
            )

    def db(self):
        return sqlite3.connect(self.path, timeout=10)

    def create(self, payload: dict, ttl: int = 7200) -> dict:
        plan_id = str(uuid.uuid4())
        with self.db() as db:
            db.execute(
                "INSERT INTO plans VALUES (?, ?, ?, 'ready', NULL)",
                (plan_id, json.dumps(payload), time.time() + ttl),
            )
        return self.get(plan_id)

    def get(self, plan_id: str) -> dict:
        with self.db() as db:
            row = db.execute(
                "SELECT payload, expires, state, result FROM plans WHERE id=?", (plan_id,)
            ).fetchone()
        if not row:
            raise ValueError("Unknown plan ID. Preview a playlist first.")
        payload, expires, state, result = row
        return dict(
            plan_id=plan_id,
            payload=json.loads(payload),
            expires_at=expires,
            state=state,
            result=json.loads(result) if result else None,
        )

    def claim(self, plan_id: str) -> dict:
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT state, expires FROM plans WHERE id=?", (plan_id,)).fetchone()
            if not row or row[0] != "ready":
                raise ValueError(
                    "Plan is no longer ready; inspect its saved result. Do not retry writes."
                )
            if row[1] < time.time():
                raise ValueError("Plan expired; preview again.")
            db.execute("UPDATE plans SET state='applying' WHERE id=?", (plan_id,))
        return self.get(plan_id)

    def finish(self, plan_id: str, state: str, result: dict) -> None:
        with self.db() as db:
            db.execute(
                "UPDATE plans SET state=?, result=? WHERE id=?",
                (state, json.dumps(result), plan_id),
            )

    def cancel(self, plan_id: str) -> dict:
        with self.db() as db:
            db.execute(
                "UPDATE plans SET state='cancelled' WHERE id=? AND state='ready'", (plan_id,)
            )
        return self.get(plan_id)

    def recent(self) -> list[dict]:
        with self.db() as db:
            ids = db.execute("SELECT id FROM plans ORDER BY rowid DESC LIMIT 20").fetchall()
        return [self.get(row[0]) for row in ids]
