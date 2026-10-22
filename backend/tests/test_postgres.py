"""PostgreSQL integration: migrations, a full student journey and shared limits.

It needs a real server: ``PYRAIZ_TEST_POSTGRES_URL`` (for example, in CI) or a temporary
one started with ``pgserver``:

    uv run --group postgres pytest tests/test_postgres.py

Without either, the tests are skipped and pytest reports them as such.
"""

import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import make_url, select

from alembic import command
from app.curriculum import content
from app.database import build_engine, build_session_factory
from app.identity import cleanup
from app.identity.models import AuthSession
from app.main import create_app
from app.settings import Settings
from tests.test_exercises import alembic_config
from tests.test_onboarding import ANSWERS

psycopg = pytest.importorskip("psycopg")
ORIGIN = "http://localhost:3000"
HEADERS = {"Origin": ORIGIN}


@pytest.fixture(scope="module")
def admin_url(tmp_path_factory: pytest.TempPathFactory):
    configured = os.getenv("PYRAIZ_TEST_POSTGRES_URL")
    if configured:
        yield configured
        return
    pgserver = pytest.importorskip(
        "pgserver", reason="sin PostgreSQL: define PYRAIZ_TEST_POSTGRES_URL o usa --group postgres"
    )
    server = pgserver.get_server(tmp_path_factory.mktemp("postgres"), cleanup_mode="stop")
    yield server.get_uri()
    server.cleanup()


@pytest.fixture
def database_url(admin_url: str, monkeypatch: pytest.MonkeyPatch):
    """A fresh database for each test, dropped afterwards."""
    name = f"pyraiz_test_{uuid.uuid4().hex[:12]}"
    admin = make_url(admin_url).set(drivername="postgresql")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{name}"')
    url = make_url(admin_url).set(drivername="postgresql+psycopg", database=name)
    rendered = url.render_as_string(hide_password=False)
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", rendered)
    yield rendered
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(f'DROP DATABASE "{name}" WITH (FORCE)')


def make_client(database_url: str) -> TestClient:
    settings = Settings(database_url=database_url, cors_origins=(ORIGIN,), cookie_secure=False)
    return TestClient(create_app(settings))


def test_migrations_round_trip_and_match_the_models(database_url: str) -> None:
    config = alembic_config()
    command.upgrade(config, "head")
    command.check(config)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    command.check(config)


def test_student_journey(database_url: str) -> None:
    command.upgrade(alembic_config(), "head")
    with make_client(database_url) as client:
        assert client.app.state.engine.dialect.name == "postgresql"
        with client.app.state.session_factory() as db:
            content.apply_catalog(db, content.load_catalog())
            db.commit()

        email = {"email": "ana@example.com", "password": "una-clave-larga-123"}
        assert client.post("/api/v1/auth/register", json=email, headers=HEADERS).status_code == 201
        assert client.get("/api/v1/auth/me").json()["email"] == "ana@example.com"
        assert client.put("/api/v1/onboarding", json=ANSWERS, headers=HEADERS).status_code == 200

        lesson = client.get("/api/v1/curriculum/lessons/mostrar-mensajes").json()
        exercise = client.get(f"/api/v1/curriculum/exercises/{lesson['exercises'][0]['id']}")
        attempt = {
            "exercise_version": exercise.json()["version"],
            "code": 'print("¡Hola, mundo!")\n',
            "status": "passed",
            "passed_count": 1,
            "total_count": 1,
        }
        saved = client.put(
            "/api/v1/progress/exercises/mensajes-hola-mundo", json=attempt, headers=HEADERS
        )
        assert saved.status_code == 200
        assert saved.json()["solved"] is True
        assert saved.json()["solved_at"].endswith("Z") or "+00:00" in saved.json()["solved_at"]
        summary = client.get("/api/v1/progress").json()
        assert summary["solved_count"] == 1
        assert summary["items"][0]["title"] == "Tu primer mensaje"

        assert client.post("/api/v1/auth/logout", headers=HEADERS).status_code == 204
        assert client.get("/api/v1/progress").status_code == 401


def test_login_limit_is_shared_between_app_instances(database_url: str) -> None:
    command.upgrade(alembic_config(), "head")
    credentials = {"email": "nadie@example.com", "password": "una-clave-larga-123"}
    with make_client(database_url) as first, make_client(database_url) as second:
        statuses = [
            (first if attempt % 2 else second)
            .post("/api/v1/auth/login", json=credentials, headers=HEADERS)
            .status_code
            for attempt in range(11)
        ]
    assert statuses == [401] * 10 + [429]


def test_cleanup_on_postgres(database_url: str, tmp_path: Path) -> None:
    command.upgrade(alembic_config(), "head")
    with make_client(database_url) as client:
        email = {"email": "ana@example.com", "password": "una-clave-larga-123"}
        assert client.post("/api/v1/auth/register", json=email, headers=HEADERS).status_code == 201
    engine = build_engine(database_url)
    try:
        with build_session_factory(engine)() as db:
            far_future = 4_000_000_000
            assert cleanup.cleanup(db, now=far_future)[0] == 1
            assert db.scalars(select(AuthSession)).all() == []
    finally:
        engine.dispose()
