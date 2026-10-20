"""Load sample curriculum for local development only.

Usage, from backend/: ``uv run python -m app.curriculum.seed_dev``

The records are test data without pedagogical review. They are never loaded by
migrations and the command refuses to run with PYRAIZ_ENV=production.
"""

import os
import sys

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.curriculum.exercises import validate_checks
from app.curriculum.models import Exercise, LearningPath, Lesson, Module
from app.database import build_engine, build_session_factory
from app.settings import Settings

DEV_NOTICE = "Datos de prueba para desarrollo local; sin revisión pedagógica."

DEV_PATH = LearningPath(
    id="dev-practice-path",
    title="Ruta de prueba (desarrollo)",
    description=DEV_NOTICE,
    status="published",
    version=1,
)
DEV_MODULE = Module(
    id="dev-practice-module",
    path_id="dev-practice-path",
    position=1,
    level="basic",
    title="Módulo de prueba (desarrollo)",
    description=DEV_NOTICE,
    objectives=["Probar el evaluador de ejercicios"],
    status="published",
    version=1,
)
DEV_LESSON = Lesson(
    id="dev-practice-lesson",
    module_id="dev-practice-module",
    position=1,
    title="Lección de prueba (desarrollo)",
    summary=DEV_NOTICE,
    objectives=["Probar el evaluador de ejercicios"],
    content_markdown=f"# Lección de prueba\n\n{DEV_NOTICE}",
    status="published",
    version=1,
)
DEV_EXERCISES = [
    Exercise(
        id="dev-greeting",
        lesson_id="dev-practice-lesson",
        position=1,
        title="Prueba: saludo fijo",
        prompt_markdown=f"Muestra exactamente `Hola, PyRaíz`.\n\n_{DEV_NOTICE}_",
        starter_code="# Escribe tu solución aquí\n",
        checks=[
            {
                "kind": "output",
                "id": "saludo",
                "description": "Muestra el saludo exacto",
                "expected_stdout": "Hola, PyRaíz\n",
            }
        ],
        status="published",
        version=1,
    ),
    Exercise(
        id="dev-greeting-input",
        lesson_id="dev-practice-lesson",
        position=2,
        title="Prueba: saludo con input()",
        prompt_markdown=(
            f"Lee un nombre con `input()` y muestra `Hola, <nombre>`.\n\n_{DEV_NOTICE}_"
        ),
        starter_code="nombre = input()\n",
        checks=[
            {
                "kind": "output",
                "id": "ana",
                "description": "Saluda a Ana",
                "stdin": ["Ana"],
                "expected_stdout": "Hola, Ana\n",
            },
            {
                "kind": "output",
                "id": "luis",
                "description": "Saluda a Luis",
                "stdin": ["Luis"],
                "expected_stdout": "Hola, Luis\n",
            },
        ],
        status="published",
        version=1,
    ),
    Exercise(
        id="dev-rectangle-area",
        lesson_id="dev-practice-lesson",
        position=3,
        title="Prueba: función de área",
        prompt_markdown=(
            f"Define `area_rectangulo(base, altura)` que devuelva el área.\n\n_{DEV_NOTICE}_"
        ),
        starter_code="def area_rectangulo(base, altura):\n    pass\n",
        checks=[
            {
                "kind": "function",
                "id": "enteros",
                "description": "Base 3 y altura 4",
                "function_name": "area_rectangulo",
                "args": [3, 4],
                "expected": 12,
            },
            {
                "kind": "function",
                "id": "cero",
                "description": "Un lado mide cero",
                "function_name": "area_rectangulo",
                "args": [0, 7],
                "expected": 0,
            },
        ],
        status="published",
        version=1,
    ),
]


def seed(db: Session) -> int:
    """Insert or update the sample records; running it twice changes nothing."""
    for exercise in DEV_EXERCISES:
        validate_checks(exercise.checks)
    records = [DEV_PATH, DEV_MODULE, DEV_LESSON, *DEV_EXERCISES]
    for record in records:
        db.merge(record)
        db.flush()
    db.commit()
    return len(DEV_EXERCISES)


def main() -> int:
    if os.getenv("PYRAIZ_ENV") == "production":
        print("seed_dev no se ejecuta con PYRAIZ_ENV=production.", file=sys.stderr)
        return 1
    settings = Settings.from_env()
    engine = build_engine(settings.database_url)
    try:
        if not inspect(engine).has_table("learning_exercises"):
            print("Falta la tabla de ejercicios: ejecuta antes `uv run alembic upgrade head`.")
            return 1
        with build_session_factory(engine)() as db:
            count = seed(db)
    finally:
        engine.dispose()
    print(f"Datos de desarrollo listos: {count} ejercicios en la lección dev-practice-lesson.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
