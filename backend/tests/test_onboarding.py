"""Learning preference rules and authenticated persistence."""

from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select

from alembic import command
from app.identity.models import AuthSession, User
from app.main import create_app
from app.onboarding.models import UserProfile
from app.onboarding.rules import recommend
from app.onboarding.schemas import OnboardingAnswers
from app.settings import Settings

ORIGIN = "http://localhost:3000"
ANSWERS = {
    "goal": "automate",
    "experience": "some",
    "weekly_minutes": 60,
    "interests": ["work", "data"],
    "example_context": "work",
    "known_topics": ["variables"],
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_url = f"sqlite:///{(tmp_path / 'onboarding.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")
    app = create_app(
        Settings(database_url=database_url, cors_origins=(ORIGIN,), cookie_secure=False)
    )
    with TestClient(app) as test_client:
        yield test_client
    app.state.engine.dispose()


def register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "a-long-test-password"},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 201


def test_rules_keep_shared_foundations_and_explain_gaps() -> None:
    result = recommend(OnboardingAnswers(**ANSWERS))
    assert result.starting_point == "Fundamentos de Python"
    assert "condicionales y funciones" in result.reason
    assert result.focus == "Automatizar tareas repetitivas"
    assert result.suggested_theme == "Trabajo y emprendimiento"
    assert result.weekly_plan == "Tres sesiones de 20 minutos por semana"
    assert result.example_project == "Reporte automático"
    assert result.rule_version == 1

    experienced = OnboardingAnswers(
        goal="innovate",
        experience="comfortable",
        weekly_minutes=180,
        interests=["environment"],
        example_context="community",
        known_topics=["variables", "conditionals", "functions"],
    )
    advanced_result = recommend(experienced)
    assert advanced_result.starting_point == "Fundamentos de Python"
    assert "diagnóstico opcional" in advanced_result.reason
    assert "no verifica competencias" in advanced_result.reason
    assert advanced_result.focus == "Explorar datos y tecnología aplicada"
    assert advanced_result.suggested_theme == "Medio ambiente"

    beginner = OnboardingAnswers(
        goal="explore",
        experience="none",
        weekly_minutes=15,
        interests=["finance"],
        example_context="daily",
        known_topics=[],
    )
    assert "empezando desde cero" in recommend(beginner).reason


def test_profile_requires_auth_and_is_editable(client: TestClient) -> None:
    assert client.get("/api/v1/onboarding").status_code == 401
    assert (
        client.put("/api/v1/onboarding", json=ANSWERS, headers={"Origin": ORIGIN}).status_code
        == 401
    )
    register(client, "student@example.org")
    assert client.get("/api/v1/onboarding").status_code == 404

    saved = client.put("/api/v1/onboarding", json=ANSWERS, headers={"Origin": ORIGIN})
    assert saved.status_code == 200
    assert saved.json()["recommendation"]["starting_point"] == "Fundamentos de Python"
    assert client.get("/api/v1/onboarding").json() == saved.json()

    changed = {**ANSWERS, "goal": "build", "interests": ["education"], "weekly_minutes": 30}
    updated = client.put("/api/v1/onboarding", json=changed, headers={"Origin": ORIGIN})
    assert updated.status_code == 200
    assert updated.json()["goal"] == "build"
    assert updated.json()["recommendation"]["suggested_theme"] == "Educación"
    assert (
        updated.json()["recommendation"]["weekly_plan"] == "Dos sesiones de 15 minutos por semana"
    )
    assert client.get("/api/v1/onboarding").json() == updated.json()

    token = client.cookies.get("pyraiz_session")
    restarted = create_app(client.app.state.settings)
    with TestClient(restarted) as fresh_client:
        recovered = fresh_client.get(
            "/api/v1/onboarding", headers={"Cookie": f"pyraiz_session={token}"}
        )
        assert recovered.json() == updated.json()
    restarted.state.engine.dispose()

    with TestClient(client.app) as other:
        register(other, "other@example.org")
        assert other.get("/api/v1/onboarding").status_code == 404


def test_rejects_invalid_answers_and_origin(client: TestClient) -> None:
    register(client, "student@example.org")
    for invalid in (
        {**ANSWERS, "interests": []},
        {**ANSWERS, "interests": ["work", "work"]},
        {**ANSWERS, "weekly_minutes": 999},
        {**ANSWERS, "known_topics": ["loops"]},
        {**ANSWERS, "role": "admin"},
    ):
        assert (
            client.put("/api/v1/onboarding", json=invalid, headers={"Origin": ORIGIN}).status_code
            == 422
        )
    assert (
        client.put(
            "/api/v1/onboarding", json=ANSWERS, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert client.get("/api/v1/onboarding").status_code == 404


def test_put_preflight_allows_configured_frontend(client: TestClient) -> None:
    response = client.options(
        "/api/v1/onboarding",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_profile_and_sessions_follow_account_deletion(client: TestClient) -> None:
    register(client, "student@example.org")
    assert (
        client.put("/api/v1/onboarding", json=ANSWERS, headers={"Origin": ORIGIN}).status_code
        == 200
    )
    with client.app.state.session_factory() as db:
        user = db.scalar(select(User).where(User.email == "student@example.org"))
        assert user is not None
        user_id = user.id
        db.delete(user)
        db.commit()
        assert db.get(UserProfile, user_id) is None
        assert db.scalars(select(AuthSession).where(AuthSession.user_id == user_id)).all() == []


def test_upgrade_keeps_existing_account_and_session(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_url = f"sqlite:///{(tmp_path / 'upgrade.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "0001_identity")
    settings = Settings(database_url=database_url, cors_origins=(ORIGIN,), cookie_secure=False)
    old_app = create_app(settings)
    with TestClient(old_app) as old_client:
        register(old_client, "existing@example.org")
        token = old_client.cookies.get("pyraiz_session")
    old_app.state.engine.dispose()

    command.upgrade(config, "head")
    new_app = create_app(settings)
    with TestClient(new_app) as new_client:
        headers = {"Cookie": f"pyraiz_session={token}"}
        assert new_client.get("/api/v1/auth/me", headers=headers).status_code == 200
        headers["Origin"] = ORIGIN
        saved = new_client.put("/api/v1/onboarding", json=ANSWERS, headers=headers)
        assert saved.status_code == 200
    new_app.state.engine.dispose()
