"""Curriculum content files: validation, loading, versions and the command line."""

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from alembic import command
from app.curriculum import content
from app.curriculum.content import ContentError, apply_catalog, load_catalog
from app.curriculum.models import Exercise, Lesson, LessonPrerequisite
from app.main import create_app
from app.settings import Settings
from tests.test_exercises import alembic_config

PATH_TOML = """
id = "ruta"
title = "Ruta"
description = "Descripción"
status = "published"
version = 1

[[modules]]
id = "modulo"
position = 1
level = "basic"
title = "Módulo"
description = "Descripción"
objectives = ["Objetivo"]
status = "published"
version = 1
"""

LESSON_TOML = """
id = "{id}"
module = "modulo"
position = {position}
title = "Lección {id}"
summary = "Resumen"
objectives = ["Objetivo"]
prerequisites = {prerequisites}
content = "# Contenido"
status = "published"
version = {version}

[[exercises]]
id = "{id}-ejercicio"
position = 1
title = "Ejercicio"
prompt = "Muestra hola"
starter_code = ""
solution = "print('hola')"
checks = [{{ kind = "output", id = "hola", description = "Hola", expected_stdout = "hola\\n" }}]
status = "published"
version = 1
"""


def write_lesson(root: Path, lesson_id: str, position=1, prerequisites="[]", version=1) -> Path:
    file = root / "ruta" / "lecciones" / f"{lesson_id}.toml"
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(
        LESSON_TOML.format(
            id=lesson_id, position=position, prerequisites=prerequisites, version=version
        ),
        encoding="utf-8",
    )
    return file


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    root = tmp_path / "content"
    (root / "ruta").mkdir(parents=True)
    (root / "ruta" / "ruta.toml").write_text(PATH_TOML, encoding="utf-8")
    write_lesson(root, "primera")
    return root


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_url = f"sqlite:///{(tmp_path / 'content.db').as_posix()}"
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


def apply(client: TestClient, root: Path) -> content.Report:
    with client.app.state.session_factory() as db:
        try:
            report = apply_catalog(db, load_catalog(root))
            db.commit()
        except ContentError:
            db.rollback()
            raise
    return report


def test_repository_content_is_valid() -> None:
    catalog = load_catalog()
    assert [path.id for path in catalog.paths] == ["python-desde-cero"]
    assert catalog.lessons[0].id == "mostrar-mensajes"
    assert all(ex.solution.strip() for lesson in catalog.lessons for ex in lesson.exercises)


def test_repository_content_is_published_through_the_api(client: TestClient) -> None:
    report = apply(client, content.CONTENT_DIR)
    assert (report.created, report.updated, report.unchanged) == (6, 0, 0)

    paths = client.get("/api/v1/curriculum/paths").json()["items"]
    assert [path["id"] for path in paths] == ["python-desde-cero"]
    lesson = client.get("/api/v1/curriculum/lessons/mostrar-mensajes").json()
    assert [ex["id"] for ex in lesson["exercises"]] == [
        "mensajes-hola-mundo",
        "mensajes-dos-lineas",
        "mensajes-varios-valores",
    ]
    assert lesson["content_markdown"].startswith("# Tu primer programa")
    detail = client.get("/api/v1/curriculum/exercises/mensajes-hola-mundo").json()
    assert detail["starter_code"] == "# Escribe tu programa debajo de esta línea\n"
    assert "solution" not in detail
    assert "¡Hola, mundo!" not in detail["starter_code"]

    again = apply(client, content.CONTENT_DIR)
    assert (again.created, again.updated, again.unchanged) == (0, 0, 6)


def test_changes_require_a_higher_version(client: TestClient, tree: Path) -> None:
    apply(client, tree)
    file = tree / "ruta" / "lecciones" / "primera.toml"
    file.write_text(file.read_text(encoding="utf-8").replace("Lección primera", "Otra"), "utf-8")
    with pytest.raises(ContentError, match="sube «version» a 2"):
        apply(client, tree)
    with client.app.state.session_factory() as db:
        assert db.get(Lesson, "primera").title == "Lección primera"

    write_lesson(tree, "primera", version=2)
    file.write_text(file.read_text(encoding="utf-8").replace("Lección primera", "Otra"), "utf-8")
    assert apply(client, tree).updated == 1
    with client.app.state.session_factory() as db:
        lesson = db.get(Lesson, "primera")
        assert (lesson.title, lesson.version) == ("Otra", 2)

    write_lesson(tree, "primera", version=1)
    with pytest.raises(ContentError, match="es menor que la guardada"):
        apply(client, tree)


def test_prerequisites_are_synchronized(client: TestClient, tree: Path) -> None:
    write_lesson(tree, "segunda", position=2, prerequisites='["primera"]')
    apply(client, tree)
    module = client.get("/api/v1/curriculum/modules/modulo").json()
    assert [lesson["prerequisite_ids"] for lesson in module["lessons"]] == [[], ["primera"]]

    write_lesson(tree, "segunda", position=2)
    with pytest.raises(ContentError, match="cambiaron los prerrequisitos"):
        apply(client, tree)
    write_lesson(tree, "segunda", position=2, version=2)
    apply(client, tree)
    with client.app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(LessonPrerequisite)) == 0


def test_error_leaves_database_unchanged(client: TestClient, tree: Path) -> None:
    apply(client, tree)
    write_lesson(tree, "segunda", position=2)
    file = tree / "ruta" / "lecciones" / "primera.toml"
    file.write_text(file.read_text(encoding="utf-8").replace("Muestra hola", "Otra"), "utf-8")
    with pytest.raises(ContentError):
        apply(client, tree)
    with client.app.state.session_factory() as db:
        assert db.get(Lesson, "segunda") is None
        assert db.get(Exercise, "primera-ejercicio").prompt_markdown == "Muestra hola"


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda root: write_lesson(root, "otra", position=1), "Posición de lección repetido"),
        (lambda root: write_lesson(root, "otra", position=2, prerequisites='["nada"]'), "nada"),
        (
            lambda root: (
                write_lesson(root, "cero", position=2, prerequisites='["otra"]')
                and write_lesson(root, "otra", position=3)
            ),
            "debe ser una lección anterior",
        ),
        (
            lambda root: (root / "ruta" / "lecciones" / "mal-nombre.toml").write_text(
                LESSON_TOML.format(id="otro", position=2, prerequisites="[]", version=1),
                encoding="utf-8",
            ),
            "nombre del archivo",
        ),
        (
            lambda root: (root / "ruta" / "lecciones" / "primera.toml").write_text(
                (root / "ruta" / "lecciones" / "primera.toml")
                .read_text(encoding="utf-8")
                .replace('module = "modulo"', 'module = "otro"'),
                encoding="utf-8",
            ),
            "no está en su ruta",
        ),
        (
            lambda root: (root / "ruta" / "lecciones" / "primera.toml").write_text(
                (root / "ruta" / "lecciones" / "primera.toml")
                .read_text(encoding="utf-8")
                .replace('kind = "output"', 'kind = "regex"'),
                encoding="utf-8",
            ),
            "pruebas inválidas",
        ),
        (
            lambda root: (root / "ruta" / "ruta.toml").write_text(
                PATH_TOML + 'color = "verde"\n', encoding="utf-8"
            ),
            "Extra inputs",
        ),
        (
            lambda root: (root / "ruta" / "ruta.toml").write_text("id = ", encoding="utf-8"),
            "TOML inválido",
        ),
    ],
)
def test_invalid_content_is_rejected(tree: Path, change, message: str) -> None:
    change(tree)
    with pytest.raises(ContentError, match=message):
        load_catalog(tree)


def test_command_line(
    tmp_path: Path,
    tree: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    database_url = f"sqlite:///{(tmp_path / 'cli.db').as_posix()}"
    monkeypatch.setenv("PYRAIZ_DATABASE_URL", database_url)
    assert content.main(["--check", str(tree)]) == 0
    assert content.main([str(tree)]) == 1
    assert "alembic upgrade head" in capsys.readouterr().out

    command.upgrade(alembic_config(), "head")
    assert content.main([str(tree)]) == 0
    assert "4 nuevos" in capsys.readouterr().out
    assert content.main([str(tree)]) == 0
    assert "4 sin cambios" in capsys.readouterr().out

    assert content.main(["--json", str(tree)]) == 0
    assert '"solution": "print(\'hola\')"' in capsys.readouterr().out

    broken = tmp_path / "roto"
    shutil.copytree(tree, broken)
    (broken / "ruta" / "ruta.toml").write_text("id = ", encoding="utf-8")
    assert content.main([str(broken)]) == 1
    assert "Contenido inválido" in capsys.readouterr().err
