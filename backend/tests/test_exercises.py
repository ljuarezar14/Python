"""Exercise storage, check validation, public visibility and development seed."""

from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.curriculum import seed_dev
from app.curriculum.exercises import validate_checks
from app.curriculum.models import Exercise, LearningPath, Lesson, Module
from app.main import create_app
from app.settings import Settings

OUTPUT_CHECK = {
    "kind": "output",
    "id": "saludo",
    "description": "Muestra el saludo",
    "expected_stdout": "Hola\n",
}
FUNCTION_CHECK = {
    "kind": "function",
    "id": "suma",
    "description": "Suma dos números",
    "function_name": "sumar",
    "args": [2, 3],
    "expected": 5,
}


def alembic_config() -> Config:
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    return config


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_url = f"sqlite:///{(tmp_path / 'exercises.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    command.upgrade(alembic_config(), "head")
    app = create_app(
        Settings(
            database_url=database_url,
            cors_origins=("http://localhost:3000",),
            cookie_secure=False,
        )
    )
    with TestClient(app) as test_client:
        yield test_client
    app.state.engine.dispose()


def exercise(
    exercise_id: str,
    lesson_id: str,
    position: int,
    *,
    status: str = "published",
    checks: list[dict] | None = None,
) -> Exercise:
    return Exercise(
        id=exercise_id,
        lesson_id=lesson_id,
        position=position,
        title=exercise_id.title(),
        prompt_markdown=f"Enunciado de {exercise_id}",
        starter_code="# código inicial\n",
        checks=checks if checks is not None else [OUTPUT_CHECK],
        status=status,
        version=1,
    )


def seed_lessons(client: TestClient) -> None:
    with client.app.state.session_factory() as db:
        db.add(
            LearningPath(
                id="fundamentals", title="Fundamentos", description="Ruta", status="published"
            )
        )
        db.flush()
        db.add(
            Module(
                id="first",
                path_id="fundamentals",
                position=1,
                level="basic",
                title="Inicio",
                description="Inicio",
                objectives=["Practicar"],
                status="published",
            )
        )
        db.flush()
        for lesson_id, position, status in (("visible", 1, "published"), ("draft", 2, "draft")):
            db.add(
                Lesson(
                    id=lesson_id,
                    module_id="first",
                    position=position,
                    title=lesson_id.title(),
                    summary="Resumen",
                    objectives=["Practicar"],
                    content_markdown="# Lección",
                    status=status,
                )
            )
        db.flush()
        db.add_all(
            [
                exercise("second", "visible", 2, checks=[FUNCTION_CHECK]),
                exercise("first", "visible", 1),
                exercise("unpublished", "visible", 3, status="draft"),
                exercise("broken", "visible", 4, checks=[{"kind": "output", "id": "x"}]),
                exercise("in-draft-lesson", "draft", 1),
            ]
        )
        db.commit()


def test_lesson_lists_only_published_valid_exercises_in_order(client: TestClient) -> None:
    seed_lessons(client)
    lesson = client.get("/api/v1/curriculum/lessons/visible")
    assert lesson.status_code == 200
    assert lesson.json()["exercises"] == [
        {"id": "first", "position": 1, "title": "First", "version": 1},
        {"id": "second", "position": 2, "title": "Second", "version": 1},
    ]


def test_exercise_detail_returns_typed_checks(client: TestClient) -> None:
    seed_lessons(client)
    response = client.get("/api/v1/curriculum/exercises/second")
    assert response.status_code == 200
    assert response.json() == {
        "id": "second",
        "position": 2,
        "title": "Second",
        "version": 1,
        "lesson_id": "visible",
        "prompt_markdown": "Enunciado de second",
        "starter_code": "# código inicial\n",
        "checks": [FUNCTION_CHECK],
    }
    first = client.get("/api/v1/curriculum/exercises/first").json()
    assert first["checks"] == [{**OUTPUT_CHECK, "stdin": []}]


def test_hidden_exercises_respond_404(client: TestClient) -> None:
    seed_lessons(client)
    for hidden_id in ("unpublished", "broken", "in-draft-lesson", "missing"):
        response = client.get(f"/api/v1/curriculum/exercises/{hidden_id}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Ejercicio no disponible"}


def test_empty_installation_has_no_exercises(client: TestClient) -> None:
    assert client.get("/api/v1/curriculum/exercises/dev-greeting").status_code == 404
    with client.app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Exercise)) == 0


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ([], "at least 1"),
        ([{**OUTPUT_CHECK, "kind": "regex"}], "does not match any of the expected tags"),
        ([{**OUTPUT_CHECK, "hidden": True}], "Extra inputs are not permitted"),
        ([OUTPUT_CHECK, OUTPUT_CHECK], "identificador único"),
        ([{**OUTPUT_CHECK, "id": "Con Espacios"}], "String should match pattern"),
        ([{**OUTPUT_CHECK, "stdin": ["a\nb"]}], "una sola línea"),
        ([{**OUTPUT_CHECK, "expected_stdout": "x" * 10_001}], "at most 10000"),
        ([{**FUNCTION_CHECK, "function_name": "class"}], "nombre de función válido"),
        ([{**FUNCTION_CHECK, "function_name": "1suma"}], "nombre de función válido"),
        ([{**FUNCTION_CHECK, "args": ["x" * 10_001]}], "demasiado grandes"),
        ([{**FUNCTION_CHECK, "expected": float("nan")}], "sin NaN ni infinito"),
        ([{**FUNCTION_CHECK, "args": [float("inf")]}], "sin NaN ni infinito"),
        ([OUTPUT_CHECK] * 21, "at most 20"),
    ],
)
def test_validate_checks_rejects_malformed_definitions(raw: list, message: str) -> None:
    with pytest.raises((ValidationError, ValueError), match=message):
        validate_checks(raw)


def test_validate_checks_accepts_both_kinds() -> None:
    checks = validate_checks([OUTPUT_CHECK, {**FUNCTION_CHECK, "id": "otra", "expected": None}])
    assert [check.kind for check in checks] == ["output", "function"]
    assert checks[0].stdin == []


def test_database_constraints_and_cascade(client: TestClient) -> None:
    seed_lessons(client)
    with client.app.state.session_factory() as db:
        db.add(exercise("duplicate-position", "visible", 1))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        db.add(exercise("bad-position", "visible", 0))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        db.delete(db.get(Lesson, "draft"))
        db.commit()
        assert db.get(Exercise, "in-draft-lesson") is None


def test_upgrade_keeps_existing_curriculum(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = f"sqlite:///{(tmp_path / 'upgrade.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    config = alembic_config()
    command.upgrade(config, "0003_curriculum")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO learning_paths (id, title, description, status, version) "
                "VALUES ('kept', 'Ruta', 'Previa', 'published', 1)"
            )
        )
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT id FROM learning_paths")).scalars().all() == ["kept"]
        assert connection.execute(text("SELECT COUNT(*) FROM learning_exercises")).scalar() == 0
    engine.dispose()
    command.downgrade(config, "0003_curriculum")
    command.upgrade(config, "head")


def test_seed_dev_is_idempotent_and_visible(client: TestClient) -> None:
    with client.app.state.session_factory() as db:
        assert seed_dev.seed(db) == 3
        assert seed_dev.seed(db) == 3
        assert db.scalar(select(func.count()).select_from(Exercise)) == 3
        assert db.scalar(select(func.count()).select_from(LearningPath)) == 1

    lesson = client.get("/api/v1/curriculum/lessons/dev-practice-lesson").json()
    assert [item["id"] for item in lesson["exercises"]] == [
        "dev-greeting",
        "dev-greeting-input",
        "dev-rectangle-area",
    ]
    detail = client.get("/api/v1/curriculum/exercises/dev-greeting-input").json()
    assert [check["stdin"] for check in detail["checks"]] == [["Ana"], ["Luis"]]
    assert "sin revisión pedagógica" in detail["prompt_markdown"]


def test_seed_dev_refuses_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PYRAIZ_ENV", "production")
    assert seed_dev.main() == 1


def test_seed_dev_requires_migrated_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("PYRAIZ_ENV", raising=False)
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", f"sqlite:///{(tmp_path / 'empty.db').as_posix()}")
    assert seed_dev.main() == 1
    assert "alembic upgrade head" in capsys.readouterr().out
