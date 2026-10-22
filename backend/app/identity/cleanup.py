"""Delete expired sessions and old rate-limit counters.

Usage, from backend/: ``uv run python -m app.identity.cleanup``

Run it on a schedule (for example, once a day) in deployed environments. It is safe
to run at any time: it only removes data that the API no longer uses.
"""

import sys
import time

from sqlalchemy import delete, inspect
from sqlalchemy.orm import Session

from app.database import build_engine, build_session_factory
from app.identity.models import AuthSession, RateLimitCounter
from app.settings import Settings

# Los contadores solo se consultan durante su ventana; un día de margen basta.
COUNTER_RETENTION_SECONDS = 24 * 60 * 60


def cleanup(db: Session, now: int | None = None) -> tuple[int, int]:
    """Return how many sessions and counters were deleted."""
    now = int(time.time()) if now is None else now
    sessions = db.execute(delete(AuthSession).where(AuthSession.expires_at <= now)).rowcount
    counters = db.execute(
        delete(RateLimitCounter).where(
            RateLimitCounter.window_start < now - COUNTER_RETENTION_SECONDS
        )
    ).rowcount
    db.commit()
    return sessions, counters


def main() -> int:
    engine = build_engine(Settings.from_env().database_url)
    try:
        if not inspect(engine).has_table("rate_limit_counters"):
            print("Falta la tabla de contadores: ejecuta antes `uv run alembic upgrade head`.")
            return 1
        with build_session_factory(engine)() as db:
            sessions, counters = cleanup(db)
    finally:
        engine.dispose()
    print(f"Limpieza terminada. Sesiones vencidas: {sessions}; contadores antiguos: {counters}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
