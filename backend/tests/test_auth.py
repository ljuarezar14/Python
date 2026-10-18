"""Identity flow against the actual first database migration."""

from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select

from alembic import command
from app.identity.models import AuthSession, User
from app.identity.security import hash_token
from app.main import create_app
from app.settings import Settings

ORIGIN = "http://localhost:3000"
PASSWORD = "a-long-test-password"


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    command.upgrade(config, "head")
    app = create_app(
        Settings(database_url=database_url, cors_origins=(ORIGIN,), cookie_secure=False)
    )
    with TestClient(app) as test_client:
        yield test_client
    app.state.engine.dispose()


def register(client: TestClient, email: str = "alumna@example.org"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )


def test_register_me_logout_and_login(client: TestClient) -> None:
    registered = register(client)
    assert registered.status_code == 201
    assert registered.json()["role"] == "student"
    assert "password" not in registered.text
    assert "HttpOnly" in registered.headers["set-cookie"]
    assert "SameSite=lax" in registered.headers["set-cookie"]
    assert client.get("/api/v1/auth/me").json()["email"] == "alumna@example.org"
    token = client.cookies.get("pyraiz_session")
    assert token is not None

    with client.app.state.session_factory() as db:
        user = db.scalar(select(User).where(User.email == "alumna@example.org"))
        assert user is not None
        assert user.password_hash != PASSWORD
        assert user.password_hash.startswith("$argon2id$")
        session = db.scalar(select(AuthSession).where(AuthSession.user_id == user.id))
        assert session is not None
        assert session.token_hash == hash_token(token)
        assert session.token_hash != token

    logged_out = client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN})
    assert logged_out.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.get("/api/v1/auth/me", headers={"Cookie": f"pyraiz_session={token}"}).status_code
        == 401
    )

    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "ALUMNA@example.org", "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert logged_in.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200


def test_rejects_duplicate_invalid_password_and_role_escalation(client: TestClient) -> None:
    first = register(client)
    assert first.status_code == 201
    assert register(client, "ALUMNA@example.org").status_code == 409
    wrong = client.post(
        "/api/v1/auth/login",
        json={"email": "alumna@example.org", "password": "incorrect-long-password"},
        headers={"Origin": ORIGIN},
    )
    assert wrong.status_code == 401
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": "short@example.org", "password": "short"},
            headers={"Origin": ORIGIN},
        ).status_code
        == 422
    )
    elevated = client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.org", "password": PASSWORD, "role": "admin"},
        headers={"Origin": ORIGIN},
    )
    assert elevated.status_code == 422


def test_origin_and_rate_limit(client: TestClient) -> None:
    preflight = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == ORIGIN
    assert preflight.headers["access-control-allow-credentials"] == "true"

    rejected = client.post(
        "/api/v1/auth/register",
        json={"email": "person@example.org", "password": PASSWORD},
        headers={"Origin": "https://evil.example"},
    )
    assert rejected.status_code == 403
    assert "access-control-allow-origin" not in rejected.headers
    assert client.post("/api/v1/auth/logout").status_code == 403
    for _ in range(10):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "absent@example.org", "password": PASSWORD},
            headers={"Origin": ORIGIN},
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "absent@example.org", "password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert blocked.status_code == 429


def test_secure_cookie_in_production_setting(client: TestClient) -> None:
    client.app.state.settings = Settings(
        database_url=client.app.state.settings.database_url,
        cors_origins=(ORIGIN,),
        cookie_secure=True,
    )
    response = register(client)
    assert response.status_code == 201
    assert "Secure" in response.headers["set-cookie"]


def test_session_survives_api_restart(client: TestClient) -> None:
    assert register(client).status_code == 201
    token = client.cookies.get("pyraiz_session")
    restarted = create_app(client.app.state.settings)
    with TestClient(restarted) as fresh_client:
        response = fresh_client.get(
            "/api/v1/auth/me", headers={"Cookie": f"pyraiz_session={token}"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "alumna@example.org"
    restarted.state.engine.dispose()


def test_production_requires_secure_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PYRAIZ_ENV", "production")
    monkeypatch.delenv("PYRAIZ_COOKIE_SECURE", raising=False)
    with pytest.raises(ValueError, match="PYRAIZ_COOKIE_SECURE"):
        Settings.from_env()
