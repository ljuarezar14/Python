"""Production settings, security headers, the shared rate limiter and cleanup."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from alembic import command
from app.database import build_engine, build_session_factory
from app.identity import cleanup
from app.identity.models import AuthSession, RateLimitCounter, User
from app.identity.security import RateLimiter, hash_token
from app.main import create_app
from app.settings import Settings
from tests.test_exercises import alembic_config

SAFE = {
    "PYRAIZ_ENV": "production",
    "PYRAIZ_COOKIE_SECURE": "true",
    "PYRAIZ_DATABASE_URL": "postgresql+psycopg://pyraiz@db.internal/pyraiz",
    "PYRAIZ_CORS_ORIGINS": "https://pyraiz.example/",
    "PYRAIZ_API_ORIGIN": "https://api.pyraiz.example",
}


@pytest.fixture
def database_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{(tmp_path / 'production.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", url)
    command.upgrade(alembic_config(), "head")
    return url


@pytest.fixture
def factory(database_url: str):
    engine = build_engine(database_url)
    yield build_session_factory(engine)
    engine.dispose()


def make_client(database_url: str, environment: str = "development") -> TestClient:
    settings = Settings(
        database_url=database_url,
        cors_origins=("http://localhost:3000",),
        cookie_secure=False,
        environment=environment,
    )
    return TestClient(create_app(settings))


def test_production_accepts_safe_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in SAFE.items():
        monkeypatch.setenv(name, value)
    settings = Settings.from_env()
    assert settings.production
    assert settings.cors_origins == ("https://pyraiz.example",)


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("PYRAIZ_COOKIE_SECURE", "false", "PYRAIZ_COOKIE_SECURE"),
        ("PYRAIZ_DATABASE_URL", "sqlite:///./pyraiz.db", "PostgreSQL"),
        ("PYRAIZ_CORS_ORIGINS", "https://pyraiz.example,http://evil.example", "https://"),
        ("PYRAIZ_CORS_ORIGINS", "*", "PYRAIZ_CORS_ORIGINS"),
        ("PYRAIZ_CORS_ORIGINS", " ", "PYRAIZ_CORS_ORIGINS"),
        ("PYRAIZ_API_ORIGIN", "http://api.pyraiz.example", "PYRAIZ_API_ORIGIN"),
    ],
)
def test_production_rejects_unsafe_settings(
    monkeypatch: pytest.MonkeyPatch, name: str, value: str, message: str
) -> None:
    for key, safe in SAFE.items():
        monkeypatch.setenv(key, safe)
    monkeypatch.setenv(name, value)
    with pytest.raises(ValueError, match=message):
        Settings.from_env()


def test_development_keeps_local_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in SAFE:
        monkeypatch.delenv(name, raising=False)
    settings = Settings.from_env()
    assert not settings.production
    assert settings.database_url.startswith("sqlite")


def test_security_headers_in_development(database_url: str) -> None:
    with make_client(database_url) as client:
        health = client.get("/api/v1/health")
        assert health.headers["X-Content-Type-Options"] == "nosniff"
        assert health.headers["X-Frame-Options"] == "DENY"
        assert health.headers["Referrer-Policy"] == "no-referrer"
        assert (
            health.headers["Content-Security-Policy"]
            == "default-src 'none'; frame-ancestors 'none'"
        )
        assert "Strict-Transport-Security" not in health.headers
        assert "Cache-Control" not in health.headers

        assert client.get("/api/v1/auth/me").headers["Cache-Control"] == "no-store"
        assert client.get("/api/v1/progress").headers["Cache-Control"] == "no-store"
        assert "Cache-Control" not in client.get("/api/v1/curriculum/paths").headers

        docs = client.get("/docs")
        assert docs.status_code == 200
        assert "Content-Security-Policy" not in docs.headers


def test_production_adds_hsts_and_hides_docs(database_url: str) -> None:
    with make_client(database_url, environment="production") as client:
        health = client.get("/api/v1/health")
        assert health.headers["Strict-Transport-Security"] == "max-age=31536000"
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404


def test_rate_limiter_counts_per_window_and_scope(factory) -> None:
    now = [1_000_020.0]
    limiter = RateLimiter(factory, scope="auth", limit=3, clock=lambda: now[0])
    assert [limiter.allow("1.2.3.4") for _ in range(4)] == [True, True, True, False]
    assert limiter.allow("5.6.7.8")
    assert RateLimiter(factory, scope="progress", limit=3, clock=lambda: now[0]).allow("1.2.3.4")
    now[0] += 60
    assert limiter.allow("1.2.3.4")


def test_rate_limit_is_shared_between_processes(factory) -> None:
    # Dos instancias con la misma base equivalen a dos procesos de la API.
    first = RateLimiter(factory, scope="auth", limit=2, clock=lambda: 1_000_000.0)
    second = RateLimiter(factory, scope="auth", limit=2, clock=lambda: 1_000_000.0)
    assert first.allow("1.2.3.4")
    assert second.allow("1.2.3.4")
    assert not first.allow("1.2.3.4")
    assert not second.allow("1.2.3.4")


def test_rate_limit_stores_hashed_keys_and_drops_old_windows(factory) -> None:
    now = [1_000_000.0]
    limiter = RateLimiter(factory, scope="auth", clock=lambda: now[0])
    limiter.allow("1.2.3.4")
    with factory() as db:
        stored = db.scalars(select(RateLimitCounter.key_hash)).all()
    assert stored == [hash_token("auth:1.2.3.4")]
    assert "1.2.3.4" not in stored[0]

    now[0] += 180
    limiter.allow("9.9.9.9")
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(RateLimitCounter)) == 1


def test_login_limit_applies_across_app_instances(database_url: str) -> None:
    credentials = {"email": "nadie@example.com", "password": "una-clave-larga-123"}
    headers = {"Origin": "http://localhost:3000"}
    with make_client(database_url) as first, make_client(database_url) as second:
        statuses = [
            (first if attempt % 2 else second)
            .post("/api/v1/auth/login", json=credentials, headers=headers)
            .status_code
            for attempt in range(11)
        ]
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


def test_cleanup_deletes_only_expired_data(factory) -> None:
    now = 2_000_000
    with factory() as db:
        user = User(email="ana@example.com", password_hash="x")
        db.add(user)
        db.flush()
        db.add_all(
            [
                AuthSession(user_id=user.id, token_hash="a" * 64, expires_at=now - 1),
                AuthSession(user_id=user.id, token_hash="b" * 64, expires_at=now + 60),
                RateLimitCounter(key_hash="c" * 64, window_start=now - 2 * 86_400, hits=1),
                RateLimitCounter(key_hash="d" * 64, window_start=now - 60, hits=1),
            ]
        )
        db.commit()
        assert cleanup.cleanup(db, now=now) == (1, 1)
        assert db.scalars(select(AuthSession.token_hash)).all() == ["b" * 64]
        assert db.scalars(select(RateLimitCounter.key_hash)).all() == ["d" * 64]


def test_cleanup_command(
    database_url: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys
) -> None:
    monkeypatch.delenv("PYRAIZ_ENV", raising=False)
    assert cleanup.main() == 0
    assert "Sesiones vencidas: 0" in capsys.readouterr().out
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", f"sqlite:///{(tmp_path / 'vacia.db').as_posix()}")
    assert cleanup.main() == 1
    assert "alembic upgrade head" in capsys.readouterr().out
