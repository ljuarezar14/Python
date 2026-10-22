"""Password hashing, opaque session tokens, and request throttling."""

import hashlib
import secrets
import time
from collections.abc import Callable

from pwdlib import PasswordHash
from sqlalchemy import delete
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session, sessionmaker

from app.identity.models import RateLimitCounter

password_hasher = PasswordHash.recommended()
dummy_hash = password_hasher.hash("a-password-that-no-account-uses")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


class RateLimiter:
    """Fixed-window counter kept in the database, so every API process shares it.

    A burst can reach twice the limit across a window boundary; that is acceptable
    for slowing down password guessing and abusive saves.
    """

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        scope: str,
        limit: int = 10,
        window_seconds: int = 60,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.session_factory = session_factory
        self.scope = scope
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock

    def allow(self, key: str) -> bool:
        now = int(self.clock())
        window_start = now - now % self.window_seconds
        key_hash = hash_token(f"{self.scope}:{key}")
        with self.session_factory() as db:
            dialect = db.get_bind().dialect.name
            insert = postgresql.insert if dialect == "postgresql" else sqlite.insert
            statement = (
                insert(RateLimitCounter)
                .values(key_hash=key_hash, window_start=window_start, hits=1)
                .on_conflict_do_update(
                    index_elements=["key_hash", "window_start"],
                    set_={"hits": RateLimitCounter.hits + 1},
                )
                .returning(RateLimitCounter.hits)
            )
            hits = db.execute(statement).scalar_one()
            if hits == 1:
                # Cada ventana nueva de una clave limpia las ventanas antiguas de todas.
                db.execute(
                    delete(RateLimitCounter).where(
                        RateLimitCounter.window_start < window_start - self.window_seconds
                    )
                )
            db.commit()
        return hits <= self.limit
