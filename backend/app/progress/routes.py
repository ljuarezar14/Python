"""Authenticated save and read of each user's latest exercise attempt."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import defer

from app.curriculum.models import Exercise
from app.curriculum.routes import has_valid_checks, visible_exercise, visible_lesson
from app.identity.models import User
from app.identity.routes import DbSession, current_user, trusted_origin
from app.progress.models import ExerciseProgress
from app.progress.schemas import AttemptIn, ExerciseProgressOut, ProgressItem, ProgressSummary

router = APIRouter()
RECENT_ITEMS = 50


def as_utc(moment: datetime | None) -> datetime | None:
    """SQLite drops the time zone on read; stored values are always UTC."""
    if moment is None or moment.tzinfo is not None:
        return moment
    return moment.replace(tzinfo=UTC)


def progress_out(progress: ExerciseProgress, exercise: Exercise) -> ExerciseProgressOut:
    return ExerciseProgressOut(
        exercise_id=progress.exercise_id,
        exercise_version=progress.exercise_version,
        current_version=exercise.version,
        outdated=progress.exercise_version != exercise.version,
        code=progress.code,
        status=progress.last_status,
        passed_count=progress.passed_count,
        total_count=progress.total_count,
        attempts=progress.attempts,
        solved=progress.solved_version == exercise.version,
        solved_at=as_utc(progress.solved_at),
        updated_at=as_utc(progress.updated_at),
    )


def record(db: DbSession, user: User, exercise: Exercise, attempt: AttemptIn) -> ExerciseProgress:
    progress = db.get(ExerciseProgress, (user.id, exercise.id))
    if progress is None:
        progress = ExerciseProgress(user_id=user.id, exercise_id=exercise.id, attempts=0)
        db.add(progress)
    progress.exercise_version = attempt.exercise_version
    progress.code = attempt.code
    progress.last_status = attempt.status
    progress.passed_count = attempt.passed_count
    progress.total_count = attempt.total_count
    progress.attempts += 1
    if attempt.status == "passed" and progress.solved_version != attempt.exercise_version:
        progress.solved_version = attempt.exercise_version
        progress.solved_at = datetime.now(UTC)
    db.commit()
    return progress


@router.put("/exercises/{exercise_id}", response_model=ExerciseProgressOut)
def save_attempt(
    exercise_id: str,
    attempt: AttemptIn,
    request: Request,
    db: DbSession,
    user: Annotated[User, Depends(current_user)],
    _: Annotated[None, Depends(trusted_origin)],
) -> ExerciseProgressOut:
    if not request.app.state.progress_limiter.allow(user.id):
        raise HTTPException(
            status_code=429, detail="Demasiados intentos guardados. Espera un minuto."
        )
    exercise = visible_exercise(db, exercise_id)
    if attempt.exercise_version != exercise.version:
        raise HTTPException(
            status_code=409,
            detail="El ejercicio cambió. Recarga la página para ver la versión nueva.",
        )
    if attempt.total_count != len(exercise.checks):
        raise HTTPException(
            status_code=422, detail="El número de pruebas no coincide con el ejercicio"
        )
    try:
        progress = record(db, user, exercise, attempt)
    except IntegrityError:
        # Two first saves raced on the primary key; the second one updates the row.
        db.rollback()
        progress = record(db, user, exercise, attempt)
    return progress_out(progress, exercise)


@router.get("/exercises/{exercise_id}", response_model=ExerciseProgressOut)
def get_attempt(
    exercise_id: str, db: DbSession, user: Annotated[User, Depends(current_user)]
) -> ExerciseProgressOut:
    exercise = visible_exercise(db, exercise_id)
    progress = db.get(ExerciseProgress, (user.id, exercise_id))
    if progress is None:
        raise HTTPException(status_code=404, detail="Todavía no hay progreso en este ejercicio")
    return progress_out(progress, exercise)


@router.get("", response_model=ProgressSummary)
def get_summary(db: DbSession, user: Annotated[User, Depends(current_user)]) -> ProgressSummary:
    rows = db.execute(
        select(ExerciseProgress, Exercise)
        .join(Exercise, ExerciseProgress.exercise_id == Exercise.id)
        .options(defer(ExerciseProgress.code))
        .where(ExerciseProgress.user_id == user.id, Exercise.status == "published")
        .order_by(ExerciseProgress.updated_at.desc())
    ).all()
    lesson_visible: dict[str, bool] = {}
    items: list[ProgressItem] = []
    solved_count = 0
    for progress, exercise in rows:
        if exercise.lesson_id not in lesson_visible:
            try:
                visible_lesson(db, exercise.lesson_id)
                lesson_visible[exercise.lesson_id] = True
            except HTTPException:
                lesson_visible[exercise.lesson_id] = False
        # Hidden exercises keep their rows but are left out until they are visible again.
        if not lesson_visible[exercise.lesson_id] or not has_valid_checks(exercise):
            continue
        solved = progress.solved_version == exercise.version
        solved_count += solved
        if len(items) < RECENT_ITEMS:
            items.append(
                ProgressItem(
                    exercise_id=exercise.id,
                    lesson_id=exercise.lesson_id,
                    title=exercise.title,
                    outdated=progress.exercise_version != exercise.version,
                    status=progress.last_status,
                    passed_count=progress.passed_count,
                    total_count=progress.total_count,
                    solved=solved,
                    updated_at=as_utc(progress.updated_at),
                )
            )
    return ProgressSummary(solved_count=solved_count, items=items)
