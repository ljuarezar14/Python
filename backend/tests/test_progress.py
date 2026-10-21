"""Authenticated, per-user exercise progress with self-reported results."""

from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from alembic import command
from app.curriculum.models import Exercise, LearningPath, Lesson, Module
from app.identity.models import User
from app.main import create_app
from app.progress.models import ExerciseProgress
from app.settings import Settings

ORIGIN = "http://localhost:3000"
HEADERS = {"Origin": ORIGIN}
CHECKS = [
    {"kind": "output", "id": "saludo", "description": "Saludo", "expected_stdout": "Hola\n"},
    {
        "kind": "function",
        "id": "suma",
        "description": "Suma",
        "function_name": "sumar",
        "args": [2, 3],
        "expected": 5,
    },
]
PASSED = {
    "exercise_version": 1,
    "code": 'print("Hola")\n\ndef sumar(a, b):\n    return a + b\n',
    "status": "passed",
    "passed_count": 2,
    "total_count": 2,
}
FAILED = {**PASSED, "code": 'print("hola")\n', "status": "failed", "passed_count": 1}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_url = f"sqlite:///{(tmp_path / 'progress.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")
    app = create_app(
        Settings(database_url=database_url, cors_origins=(ORIGIN,), cookie_secure=False)
    )
    with TestClient(app) as test_client:
        seed(test_client)
        yield test_client
    app.state.engine.dispose()


def seed(client: TestClient) -> None:
    with client.app.state.session_factory() as db:
        db.add(LearningPath(id="ruta", title="Ruta", description="Ruta", status="published"))
        db.flush()
        db.add(
            Module(
                id="modulo",
                path_id="ruta",
                position=1,
                level="basic",
                title="Módulo",
                description="Módulo",
                objectives=["Practicar"],
                status="published",
            )
        )
        db.flush()
        for lesson_id, position, status in (("leccion", 1, "published"), ("oculta", 2, "draft")):
            db.add(
                Lesson(
                    id=lesson_id,
                    module_id="modulo",
                    position=position,
                    title=lesson_id.title(),
                    summary="Resumen",
                    objectives=["Practicar"],
                    content_markdown="# Lección",
                    status=status,
                )
            )
        db.flush()
        for exercise_id, lesson_id, position, status in (
            ("uno", "leccion", 1, "published"),
            ("dos", "leccion", 2, "published"),
            ("borrador", "leccion", 3, "draft"),
            ("en-oculta", "oculta", 1, "published"),
        ):
            db.add(
                Exercise(
                    id=exercise_id,
                    lesson_id=lesson_id,
                    position=position,
                    title=exercise_id.title(),
                    prompt_markdown="Enunciado",
                    starter_code="",
                    checks=CHECKS,
                    status=status,
                    version=1,
                )
            )
        db.commit()


def sign_in(client: TestClient, email: str) -> None:
    client.cookies.clear()
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "a-long-test-password"},
        headers=HEADERS,
    )
    assert response.status_code == 201


def save(client: TestClient, exercise_id: str, attempt: dict, headers: dict | None = None):
    return client.put(
        f"/api/v1/progress/exercises/{exercise_id}",
        json=attempt,
        headers=HEADERS if headers is None else headers,
    )


def set_exercise(client: TestClient, exercise_id: str, **fields) -> None:
    with client.app.state.session_factory() as db:
        exercise = db.get(Exercise, exercise_id)
        for name, value in fields.items():
            setattr(exercise, name, value)
        db.commit()


def test_progress_requires_session(client: TestClient) -> None:
    assert save(client, "uno", PASSED).status_code == 401
    assert client.get("/api/v1/progress/exercises/uno").status_code == 401
    assert client.get("/api/v1/progress").status_code == 401


def test_saving_requires_trusted_origin(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    assert save(client, "uno", PASSED, headers={}).status_code == 403
    evil = {"Origin": "https://evil.example"}
    assert save(client, "uno", PASSED, headers=evil).status_code == 403


def test_saves_and_resumes_latest_attempt(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    assert client.get("/api/v1/progress/exercises/uno").status_code == 404

    first = save(client, "uno", FAILED)
    assert first.status_code == 200
    body = first.json()
    assert body["code"] == FAILED["code"]
    assert (body["status"], body["passed_count"], body["total_count"]) == ("failed", 1, 2)
    assert (body["attempts"], body["solved"], body["solved_at"]) == (1, False, None)
    assert body["outdated"] is False

    solved = save(client, "uno", PASSED).json()
    assert (solved["attempts"], solved["solved"], solved["status"]) == (2, True, "passed")
    assert solved["solved_at"] is not None

    # A later failing attempt replaces the code but keeps the exercise solved.
    later = save(client, "uno", FAILED).json()
    assert (later["attempts"], later["solved"], later["status"]) == (3, True, "failed")
    assert later["solved_at"] == solved["solved_at"]

    resumed = client.get("/api/v1/progress/exercises/uno")
    assert resumed.status_code == 200
    assert resumed.json()["code"] == FAILED["code"]
    # Timestamps keep their UTC marker even after a round trip through SQLite.
    assert resumed.json()["solved_at"] == solved["solved_at"]
    assert resumed.json()["updated_at"].endswith("Z")
    assert client.get("/api/v1/progress").json()["items"][0]["updated_at"].endswith("Z")


def test_progress_is_private_to_each_user(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    assert save(client, "uno", PASSED).status_code == 200

    sign_in(client, "luis@example.com")
    assert client.get("/api/v1/progress/exercises/uno").status_code == 404
    assert client.get("/api/v1/progress").json() == {"solved_count": 0, "items": []}
    assert save(client, "uno", FAILED).json()["attempts"] == 1

    with client.app.state.session_factory() as db:
        rows = db.scalars(select(ExerciseProgress)).all()
        assert sorted((row.attempts, row.last_status) for row in rows) == [
            (1, "failed"),
            (1, "passed"),
        ]


@pytest.mark.parametrize(
    "changes",
    [
        {"status": "passed", "passed_count": 1},
        {"status": "failed", "passed_count": 2},
        {"status": "timeout", "passed_count": 2},
        {"passed_count": 3},
        {"status": "cancelled"},
        {"total_count": 0},
        {"exercise_version": 0},
        {"code": "x" * 100_001},
        {"user_id": "otra-persona"},
    ],
)
def test_rejects_inconsistent_or_oversized_attempts(client: TestClient, changes: dict) -> None:
    sign_in(client, "ana@example.com")
    assert save(client, "uno", {**PASSED, **changes}).status_code == 422


def test_accepts_timeout_and_code_at_the_limit(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    timeout = {**PASSED, "status": "timeout", "passed_count": 0, "code": "x" * 100_000}
    response = save(client, "uno", timeout)
    assert response.status_code == 200
    assert (response.json()["status"], response.json()["solved"]) == ("timeout", False)


def test_rejects_check_count_that_does_not_match_the_exercise(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    response = save(client, "uno", {**PASSED, "passed_count": 3, "total_count": 3})
    assert response.status_code == 422
    assert response.json()["detail"] == "El número de pruebas no coincide con el ejercicio"


def test_rejects_attempts_for_another_exercise_version(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    response = save(client, "uno", {**PASSED, "exercise_version": 2})
    assert response.status_code == 409
    assert "Recarga la página" in response.json()["detail"]


@pytest.mark.parametrize("exercise_id", ["borrador", "en-oculta", "no-existe"])
def test_hidden_exercises_have_no_progress_api(client: TestClient, exercise_id: str) -> None:
    sign_in(client, "ana@example.com")
    assert save(client, exercise_id, PASSED).status_code == 404
    assert client.get(f"/api/v1/progress/exercises/{exercise_id}").status_code == 404


def test_new_exercise_version_marks_progress_outdated(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    save(client, "uno", PASSED)
    set_exercise(client, "uno", version=2)

    resumed = client.get("/api/v1/progress/exercises/uno").json()
    assert (resumed["outdated"], resumed["solved"]) == (True, False)
    assert (resumed["exercise_version"], resumed["current_version"]) == (1, 2)
    assert client.get("/api/v1/progress").json()["solved_count"] == 0

    again = save(client, "uno", {**PASSED, "exercise_version": 2}).json()
    assert (again["outdated"], again["solved"], again["attempts"]) == (False, True, 2)


def test_summary_lists_recent_visible_progress_without_code(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    save(client, "uno", PASSED)
    save(client, "dos", FAILED)

    summary = client.get("/api/v1/progress")
    assert summary.status_code == 200
    body = summary.json()
    assert body["solved_count"] == 1
    assert [item["exercise_id"] for item in body["items"]] == ["dos", "uno"]
    assert body["items"][0] == {
        "exercise_id": "dos",
        "lesson_id": "leccion",
        "title": "Dos",
        "outdated": False,
        "status": "failed",
        "passed_count": 1,
        "total_count": 2,
        "solved": False,
        "updated_at": body["items"][0]["updated_at"],
    }

    # Unpublishing keeps the row but hides it until the exercise is visible again.
    set_exercise(client, "uno", status="draft")
    hidden = client.get("/api/v1/progress").json()
    assert (hidden["solved_count"], [item["exercise_id"] for item in hidden["items"]]) == (
        0,
        ["dos"],
    )
    set_exercise(client, "uno", checks=[{"kind": "output", "id": "roto"}], status="published")
    assert [item["exercise_id"] for item in client.get("/api/v1/progress").json()["items"]] == [
        "dos"
    ]
    with client.app.state.session_factory() as db:
        assert db.get(ExerciseProgress, (db.scalar(select(User.id)), "uno")) is not None


def test_saving_is_rate_limited_per_user(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    for _ in range(30):
        assert save(client, "uno", FAILED).status_code == 200
    assert save(client, "uno", FAILED).status_code == 429

    sign_in(client, "luis@example.com")
    assert save(client, "uno", FAILED).status_code == 200


def test_deleting_user_or_exercise_removes_progress(client: TestClient) -> None:
    sign_in(client, "ana@example.com")
    save(client, "uno", PASSED)
    save(client, "dos", PASSED)
    with client.app.state.session_factory() as db:
        db.execute(delete(Exercise).where(Exercise.id == "dos"))
        db.commit()
        assert [row.exercise_id for row in db.scalars(select(ExerciseProgress))] == ["uno"]
        db.execute(delete(User))
        db.commit()
        assert db.scalars(select(ExerciseProgress)).all() == []
