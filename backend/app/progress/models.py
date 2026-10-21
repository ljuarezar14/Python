"""Latest self-reported exercise attempt per user."""

from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ExerciseProgress(Base):
    __tablename__ = "exercise_progress"
    __table_args__ = (
        CheckConstraint(
            "last_status IN ('passed', 'failed', 'timeout')", name="ck_exercise_progress_status"
        ),
        CheckConstraint("exercise_version > 0", name="ck_exercise_progress_version"),
        CheckConstraint(
            "total_count > 0 AND passed_count >= 0 AND passed_count <= total_count",
            name="ck_exercise_progress_counts",
        ),
        CheckConstraint("attempts > 0", name="ck_exercise_progress_attempts"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("learning_exercises.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    exercise_version: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    last_status: Mapped[str] = mapped_column(String(16), nullable=False)
    passed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Version in which every check last passed; solved only while it matches the exercise.
    solved_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
