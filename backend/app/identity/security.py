"""Password hashing, opaque session tokens, and basic request throttling."""

import hashlib
import secrets
import time
from collections import deque
from threading import Lock

from pwdlib import PasswordHash

password_hasher = PasswordHash.recommended()
dummy_hash = password_hasher.hash("a-password-that-no-account-uses")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


class RateLimiter:
    """Per-process guard for local use; deployment needs a shared edge limit."""

    def __init__(self, limit: int = 10, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            # Expired keys are discarded so the map cannot grow indefinitely.
            for stale in [
                name for name, hits in self._events.items() if hits[-1] <= now - self.window_seconds
            ]:
                del self._events[stale]
            hits = self._events.setdefault(key, deque())
            while hits and hits[0] <= now - self.window_seconds:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True
