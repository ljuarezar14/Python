"""Load reviewed curriculum from TOML files kept in the repository.

Usage, from backend/:

    uv run python -m app.curriculum.content           # validate and load into the database
    uv run python -m app.curriculum.content --check   # validate only
    uv run python -m app.curriculum.content --json    # validate and print exercises with solutions

Layout: ``content/<path>/ruta.toml`` holds a path and its modules, and
``content/<path>/lecciones/<lesson>.toml`` holds one lesson with its exercises.
Loading runs in one transaction: any error leaves the database unchanged. It never
deletes records; to withdraw something, set ``status = "draft"`` and raise its version.
Reference solutions stay in the files: they are not stored nor exposed by the API.
"""

import argparse
import json
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.curriculum.exercises import validate_checks
from app.curriculum.models import Exercise, LearningPath, Lesson, LessonPrerequisite, Module
from app.database import build_engine, build_session_factory
from app.settings import Settings

CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"
PATH_FILE = "ruta.toml"
LESSONS_DIR = "lecciones"

ContentId = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")]
Title = Annotated[str, Field(min_length=1, max_length=160)]
Text = Annotated[str, Field(min_length=1)]
Position = Annotated[int, Field(gt=0)]
Version = Annotated[int, Field(gt=0)]
Status = Literal["draft", "published"]


class ContentError(Exception):
    """Invalid content files or a change that would break existing records."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ModuleFile(_Strict):
    id: ContentId
    position: Position
    level: Literal["basic", "intermediate", "advanced"]
    title: Title
    description: Text
    objectives: list[Text] = Field(min_length=1)
    status: Status
    version: Version


class PathFile(_Strict):
    id: ContentId
    title: Title
    description: Text
    status: Status
    version: Version
    modules: list[ModuleFile] = Field(min_length=1)


class ExerciseFile(_Strict):
    id: ContentId
    position: Position
    title: Title
    prompt: Text
    starter_code: str
    solution: Text
    checks: list[dict]
    status: Status
    version: Version


class LessonFile(_Strict):
    id: ContentId
    module: ContentId
    position: Position
    title: Title
    summary: Text
    objectives: list[Text] = Field(min_length=1)
    prerequisites: list[ContentId] = Field(default_factory=list)
    content: Text
    status: Status
    version: Version
    exercises: list[ExerciseFile] = Field(min_length=1)


@dataclass
class Catalog:
    paths: list[PathFile] = field(default_factory=list)
    lessons: list[LessonFile] = field(default_factory=list)


def _read(file: Path, model: type[BaseModel]):
    try:
        with file.open("rb") as handle:
            return model.model_validate(tomllib.load(handle))
    except tomllib.TOMLDecodeError as error:
        raise ContentError(f"{file.name}: TOML inválido: {error}") from None
    except ValidationError as error:
        problems = "; ".join(
            f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
            for item in error.errors()
        )
        raise ContentError(f"{file.name}: {problems}") from None


def _unique(label: str, values: list) -> None:
    seen = set()
    for value in values:
        if value in seen:
            raise ContentError(f"{label} repetido: {value}")
        seen.add(value)


def load_catalog(root: Path = CONTENT_DIR) -> Catalog:
    """Read and validate every content file, including references between them."""
    catalog = Catalog()
    lesson_path: dict[str, str] = {}
    for path_dir in sorted(item for item in root.iterdir() if item.is_dir()):
        path = _read(path_dir / PATH_FILE, PathFile)
        if path.id != path_dir.name:
            raise ContentError(f"{path_dir.name}/{PATH_FILE}: el id debe ser «{path_dir.name}»")
        catalog.paths.append(path)
        lessons_dir = path_dir / LESSONS_DIR
        for file in sorted(lessons_dir.glob("*.toml")) if lessons_dir.is_dir() else []:
            lesson = _read(file, LessonFile)
            if lesson.id != file.stem:
                raise ContentError(f"{file.name}: el id debe coincidir con el nombre del archivo")
            catalog.lessons.append(lesson)
            lesson_path[lesson.id] = path.id
    if not catalog.paths:
        raise ContentError(f"No hay rutas en {root}")

    modules = {module.id: (path, module) for path in catalog.paths for module in path.modules}
    _unique("Id de ruta", [path.id for path in catalog.paths])
    _unique("Id de módulo", [module.id for path in catalog.paths for module in path.modules])
    _unique("Id de lección", [lesson.id for lesson in catalog.lessons])
    _unique("Id de ejercicio", [ex.id for lesson in catalog.lessons for ex in lesson.exercises])
    for path in catalog.paths:
        _unique(f"Posición de módulo en {path.id}", [module.position for module in path.modules])

    lessons = {lesson.id: lesson for lesson in catalog.lessons}
    for lesson in catalog.lessons:
        if lesson.module not in modules or modules[lesson.module][0].id != lesson_path[lesson.id]:
            raise ContentError(f"{lesson.id}: el módulo «{lesson.module}» no está en su ruta")
        _unique(f"Posición de ejercicio en {lesson.id}", [ex.position for ex in lesson.exercises])
        order = (modules[lesson.module][1].position, lesson.position)
        for prerequisite in lesson.prerequisites:
            earlier = lessons.get(prerequisite)
            if (
                earlier is None
                or lesson_path[prerequisite] != lesson_path[lesson.id]
                or (modules[earlier.module][1].position, earlier.position) >= order
            ):
                raise ContentError(
                    f"{lesson.id}: el prerrequisito «{prerequisite}» debe ser una lección"
                    " anterior de la misma ruta"
                )
        for exercise in lesson.exercises:
            try:
                validate_checks(exercise.checks)
            except (ValidationError, ValueError) as error:
                raise ContentError(f"{exercise.id}: pruebas inválidas: {error}") from None
    _unique(
        "Posición de lección",
        [(lesson.module, lesson.position) for lesson in catalog.lessons],
    )
    return catalog


@dataclass
class Report:
    created: int = 0
    updated: int = 0
    unchanged: int = 0


def _sync(db: Session, model: type, record_id: str, version: int, values: dict, report: Report):
    """Insert or update one record, requiring a higher version for any change."""
    current = db.get(model, record_id)
    if current is None:
        db.add(model(id=record_id, version=version, **values))
        report.created += 1
        return
    changed = any(getattr(current, name) != value for name, value in values.items())
    if version < current.version:
        raise ContentError(
            f"{record_id}: la versión del archivo ({version}) es menor que la guardada"
            f" ({current.version})"
        )
    if version == current.version:
        if changed:
            raise ContentError(
                f"{record_id}: el contenido cambió; sube «version» a {current.version + 1}"
            )
        report.unchanged += 1
        return
    for name, value in values.items():
        setattr(current, name, value)
    current.version = version
    report.updated += 1


def apply_catalog(db: Session, catalog: Catalog) -> Report:
    """Write the catalog in the current transaction; the caller commits or rolls back."""
    report = Report()
    for path in catalog.paths:
        values = {"title": path.title, "description": path.description, "status": path.status}
        _sync(db, LearningPath, path.id, path.version, values, report)
        for module in path.modules:
            values = {
                "path_id": path.id,
                "position": module.position,
                "level": module.level,
                "title": module.title,
                "description": module.description,
                "objectives": list(module.objectives),
                "status": module.status,
            }
            _sync(db, Module, module.id, module.version, values, report)
        db.flush()

    for lesson in catalog.lessons:
        values = {
            "module_id": lesson.module,
            "position": lesson.position,
            "title": lesson.title,
            "summary": lesson.summary,
            "objectives": list(lesson.objectives),
            "content_markdown": lesson.content,
            "status": lesson.status,
        }
        stored = set(
            db.scalars(
                select(LessonPrerequisite.prerequisite_id).where(
                    LessonPrerequisite.lesson_id == lesson.id
                )
            )
        )
        before = report.updated + report.created
        _sync(db, Lesson, lesson.id, lesson.version, values, report)
        if stored != set(lesson.prerequisites):
            if report.updated + report.created == before:
                raise ContentError(f"{lesson.id}: cambiaron los prerrequisitos; sube «version»")
            db.flush()
            for prerequisite_id in stored - set(lesson.prerequisites):
                db.delete(db.get(LessonPrerequisite, (lesson.id, prerequisite_id)))
            for prerequisite_id in set(lesson.prerequisites) - stored:
                db.add(LessonPrerequisite(lesson_id=lesson.id, prerequisite_id=prerequisite_id))
        db.flush()

    for lesson in catalog.lessons:
        for exercise in lesson.exercises:
            values = {
                "lesson_id": lesson.id,
                "position": exercise.position,
                "title": exercise.title,
                "prompt_markdown": exercise.prompt,
                "starter_code": exercise.starter_code,
                "checks": [check.model_dump() for check in validate_checks(exercise.checks)],
                "status": exercise.status,
            }
            _sync(db, Exercise, exercise.id, exercise.version, values, report)
        db.flush()
    return report


def exercises_json(catalog: Catalog) -> str:
    """Exercises with their solutions, for checking them with the browser evaluator."""
    items = [
        {
            "id": exercise.id,
            "starter_code": exercise.starter_code,
            "solution": exercise.solution,
            "checks": [check.model_dump() for check in validate_checks(exercise.checks)],
        }
        for lesson in catalog.lessons
        for exercise in lesson.exercises
    ]
    return json.dumps(items, ensure_ascii=False, indent=2)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Valida y carga el contenido curricular.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="solo valida los archivos")
    mode.add_argument("--json", action="store_true", help="imprime ejercicios y soluciones")
    parser.add_argument("directory", nargs="?", type=Path, default=CONTENT_DIR)
    args = parser.parse_args(argv)

    try:
        catalog = load_catalog(args.directory)
    except ContentError as error:
        print(f"Contenido inválido: {error}", file=sys.stderr)
        return 1
    exercise_count = sum(len(lesson.exercises) for lesson in catalog.lessons)
    if args.json:
        sys.stdout.reconfigure(encoding="utf-8")
        print(exercises_json(catalog))
        return 0
    if args.check:
        print(f"Contenido válido. Lecciones: {len(catalog.lessons)}; ejercicios: {exercise_count}.")
        return 0

    engine = build_engine(Settings.from_env().database_url)
    try:
        if not inspect(engine).has_table("learning_exercises"):
            print("Falta la tabla de ejercicios: ejecuta antes `uv run alembic upgrade head`.")
            return 1
        with build_session_factory(engine)() as db:
            try:
                report = apply_catalog(db, catalog)
                db.commit()
            except ContentError as error:
                db.rollback()
                print(f"No se cargó nada: {error}", file=sys.stderr)
                return 1
            except IntegrityError as error:
                # Por ejemplo, una posición ya ocupada por un registro que no está en los archivos.
                db.rollback()
                print(
                    f"No se cargó nada: conflicto con datos existentes: {error.orig}",
                    file=sys.stderr,
                )
                return 1
    finally:
        engine.dispose()
    print(
        f"Contenido cargado: {report.created} nuevos, {report.updated} actualizados,"
        f" {report.unchanged} sin cambios."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
