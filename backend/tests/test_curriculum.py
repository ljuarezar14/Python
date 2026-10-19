"""Published curriculum queries and prerequisite visibility."""

from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.curriculum.models import LearningPath, Lesson, LessonPrerequisite, Module
from app.main import create_app
from app.settings import Settings


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_url = f"sqlite:///{(tmp_path / 'curriculum.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")
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


def lesson(lesson_id: str, module_id: str, position: int, *, status: str = "published") -> Lesson:
    return Lesson(
        id=lesson_id,
        module_id=module_id,
        position=position,
        title=lesson_id.title(),
        summary=f"Resumen de {lesson_id}",
        objectives=["Comprender el concepto"],
        content_markdown=f"# {lesson_id}",
        status=status,
        version=1,
    )


def seed_curriculum(client: TestClient) -> None:
    with client.app.state.session_factory() as db:
        db.add_all(
            [
                LearningPath(
                    id="python-fundamentals",
                    title="Fundamentos de Python",
                    description="Ruta básica",
                    status="published",
                    version=1,
                ),
                LearningPath(
                    id="private-path",
                    title="Borrador",
                    description="No publicar",
                    status="draft",
                    version=1,
                ),
            ]
        )
        db.flush()
        db.add_all(
            [
                Module(
                    id="first-steps",
                    path_id="python-fundamentals",
                    position=1,
                    level="basic",
                    title="Primeros pasos",
                    description="Inicio",
                    objectives=["Ejecutar Python"],
                    status="published",
                    version=1,
                ),
                Module(
                    id="next-steps",
                    path_id="python-fundamentals",
                    position=2,
                    level="basic",
                    title="Segundo módulo",
                    description="Continuación",
                    objectives=["Aplicar Python"],
                    status="published",
                    version=1,
                ),
                Module(
                    id="private-module",
                    path_id="python-fundamentals",
                    position=3,
                    level="basic",
                    title="Borrador",
                    description="Oculto",
                    objectives=["Pendiente"],
                    status="draft",
                    version=1,
                ),
                Module(
                    id="module-in-private-path",
                    path_id="private-path",
                    position=1,
                    level="basic",
                    title="Oculto",
                    description="Oculto",
                    objectives=["Pendiente"],
                    status="published",
                    version=1,
                ),
            ]
        )
        db.flush()
        db.add_all(
            [
                lesson("intro", "first-steps", 1),
                lesson("variables", "first-steps", 2),
                lesson("conditions", "first-steps", 3, status="draft"),
                lesson("functions", "first-steps", 4),
                lesson("forward", "first-steps", 5),
                lesson("hidden-module-lesson", "private-module", 1),
                lesson("next", "next-steps", 1),
                lesson("hidden-path-lesson", "module-in-private-path", 1),
            ]
        )
        db.flush()
        db.add_all(
            [
                LessonPrerequisite(lesson_id="variables", prerequisite_id="intro"),
                LessonPrerequisite(lesson_id="functions", prerequisite_id="conditions"),
                LessonPrerequisite(lesson_id="forward", prerequisite_id="next"),
                LessonPrerequisite(lesson_id="next", prerequisite_id="variables"),
            ]
        )
        db.commit()


def test_public_catalog_hides_drafts_and_paginates(client: TestClient) -> None:
    seed_curriculum(client)
    response = client.get("/api/v1/curriculum/paths")
    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": "python-fundamentals",
                "title": "Fundamentos de Python",
                "description": "Ruta básica",
                "version": 1,
            }
        ],
        "total": 1,
        "limit": 20,
        "offset": 0,
    }
    assert client.get("/api/v1/curriculum/paths?limit=1&offset=1").json()["items"] == []
    assert client.get("/api/v1/curriculum/paths?limit=0").status_code == 422
    assert client.get("/api/v1/curriculum/paths?offset=-1").status_code == 422
    assert client.get("/api/v1/curriculum/paths/private-path").status_code == 404

    detail = client.get("/api/v1/curriculum/paths/python-fundamentals")
    assert detail.status_code == 200
    assert [module["id"] for module in detail.json()["modules"]] == ["first-steps", "next-steps"]
    assert client.get("/api/v1/curriculum/modules/private-module").status_code == 404
    assert client.get("/api/v1/curriculum/modules/module-in-private-path").status_code == 404


def test_lessons_require_published_earlier_prerequisites(client: TestClient) -> None:
    seed_curriculum(client)
    first = client.get("/api/v1/curriculum/modules/first-steps")
    assert first.status_code == 200
    assert [item["id"] for item in first.json()["lessons"]] == ["intro", "variables"]
    assert first.json()["lessons"][1]["prerequisite_ids"] == ["intro"]
    assert first.json()["lessons"][1]["version"] == 1
    assert [
        item["id"] for item in client.get("/api/v1/curriculum/modules/next-steps").json()["lessons"]
    ] == ["next"]

    detail = client.get("/api/v1/curriculum/lessons/variables")
    assert detail.status_code == 200
    assert detail.json()["content_markdown"] == "# variables"
    for hidden_id in (
        "conditions",
        "functions",
        "forward",
        "hidden-module-lesson",
        "hidden-path-lesson",
        "missing",
    ):
        assert client.get(f"/api/v1/curriculum/lessons/{hidden_id}").status_code == 404


def test_empty_catalog_after_migration(client: TestClient) -> None:
    assert client.get("/api/v1/curriculum/paths").json()["total"] == 0
    with client.app.state.session_factory() as db:
        assert db.scalars(select(LearningPath)).all() == []


def test_database_rejects_duplicate_order_and_self_prerequisite(client: TestClient) -> None:
    seed_curriculum(client)
    with client.app.state.session_factory() as db:
        db.add(
            Module(
                id="duplicate-position",
                path_id="python-fundamentals",
                position=1,
                level="basic",
                title="Duplicado",
                description="No permitido",
                objectives=["Prueba"],
                status="draft",
                version=1,
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        db.add(LessonPrerequisite(lesson_id="intro", prerequisite_id="intro"))
        with pytest.raises(IntegrityError):
            db.commit()
