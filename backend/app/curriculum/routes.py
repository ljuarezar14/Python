"""Public reads of published curriculum only."""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.curriculum.models import LearningPath, Lesson, LessonPrerequisite, Module
from app.curriculum.schemas import (
    LessonDetail,
    LessonSummary,
    ModuleDetail,
    ModuleSummary,
    PathDetail,
    PathPage,
    PathSummary,
)
from app.identity.routes import DbSession

router = APIRouter()


def published_path(db: DbSession, path_id: str) -> LearningPath:
    path = db.scalar(
        select(LearningPath).where(LearningPath.id == path_id, LearningPath.status == "published")
    )
    if path is None:
        raise HTTPException(status_code=404, detail="Ruta no disponible")
    return path


def published_module(db: DbSession, module_id: str) -> Module:
    module = db.scalar(
        select(Module)
        .join(LearningPath, Module.path_id == LearningPath.id)
        .where(
            Module.id == module_id,
            Module.status == "published",
            LearningPath.status == "published",
        )
    )
    if module is None:
        raise HTTPException(status_code=404, detail="Módulo no disponible")
    return module


def visible_lessons(db: DbSession, path_id: str) -> tuple[dict[str, Lesson], dict[str, list[str]]]:
    """Only expose published lessons whose earlier prerequisites are also visible."""
    rows = db.execute(
        select(Lesson, Module.position)
        .join(Module, Lesson.module_id == Module.id)
        .where(
            Module.path_id == path_id,
            Module.status == "published",
            Lesson.status == "published",
        )
    ).all()
    candidates = {lesson.id: (lesson, module_position) for lesson, module_position in rows}
    if not candidates:
        return {}, {}
    prerequisites: dict[str, list[str]] = {lesson_id: [] for lesson_id in candidates}
    for lesson_id, prerequisite_id in db.execute(
        select(LessonPrerequisite.lesson_id, LessonPrerequisite.prerequisite_id).where(
            LessonPrerequisite.lesson_id.in_(candidates)
        )
    ):
        prerequisites[lesson_id].append(prerequisite_id)

    visible: dict[str, Lesson] = {}
    pending = dict(candidates)
    while pending:
        ready = []
        for lesson_id, (lesson, module_position) in pending.items():
            current_position = (module_position, lesson.position)
            required = prerequisites[lesson_id]
            if all(
                prerequisite_id in visible
                and (
                    candidates[prerequisite_id][1],
                    candidates[prerequisite_id][0].position,
                )
                < current_position
                for prerequisite_id in required
            ):
                ready.append(lesson_id)
        if not ready:
            break
        for lesson_id in ready:
            visible[lesson_id] = pending.pop(lesson_id)[0]
    return visible, prerequisites


def lesson_summary(lesson: Lesson, prerequisites: list[str]) -> LessonSummary:
    return LessonSummary(
        id=lesson.id,
        module_id=lesson.module_id,
        position=lesson.position,
        title=lesson.title,
        summary=lesson.summary,
        objectives=lesson.objectives,
        prerequisite_ids=sorted(prerequisites),
        version=lesson.version,
    )


@router.get("/paths", response_model=PathPage)
def list_paths(
    db: DbSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PathPage:
    criteria = LearningPath.status == "published"
    total = db.scalar(select(func.count()).select_from(LearningPath).where(criteria)) or 0
    paths = db.scalars(
        select(LearningPath).where(criteria).order_by(LearningPath.id).limit(limit).offset(offset)
    ).all()
    return PathPage(
        items=[PathSummary.model_validate(path) for path in paths],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/paths/{path_id}", response_model=PathDetail)
def get_path(path_id: str, db: DbSession) -> PathDetail:
    path = published_path(db, path_id)
    modules = db.scalars(
        select(Module)
        .where(Module.path_id == path_id, Module.status == "published")
        .order_by(Module.position)
    ).all()
    return PathDetail(
        **PathSummary.model_validate(path).model_dump(),
        modules=[ModuleSummary.model_validate(module) for module in modules],
    )


@router.get("/modules/{module_id}", response_model=ModuleDetail)
def get_module(module_id: str, db: DbSession) -> ModuleDetail:
    module = published_module(db, module_id)
    visible, prerequisites = visible_lessons(db, module.path_id)
    lessons = sorted(
        (lesson for lesson in visible.values() if lesson.module_id == module_id),
        key=lambda lesson: lesson.position,
    )
    return ModuleDetail(
        **ModuleSummary.model_validate(module).model_dump(),
        lessons=[lesson_summary(lesson, prerequisites[lesson.id]) for lesson in lessons],
    )


@router.get("/lessons/{lesson_id}", response_model=LessonDetail)
def get_lesson(lesson_id: str, db: DbSession) -> LessonDetail:
    row = db.execute(
        select(Lesson, Module.path_id)
        .join(Module, Lesson.module_id == Module.id)
        .join(LearningPath, Module.path_id == LearningPath.id)
        .where(
            Lesson.id == lesson_id,
            Lesson.status == "published",
            Module.status == "published",
            LearningPath.status == "published",
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Lección no disponible")
    lesson, path_id = row
    visible, prerequisites = visible_lessons(db, path_id)
    if lesson_id not in visible:
        raise HTTPException(status_code=404, detail="Lección no disponible")
    return LessonDetail(
        **lesson_summary(lesson, prerequisites[lesson_id]).model_dump(),
        content_markdown=lesson.content_markdown,
    )
