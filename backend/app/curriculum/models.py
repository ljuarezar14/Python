"""Curriculum records with stable public identifiers."""

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LearningPath(Base):
    __tablename__ = "learning_paths"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published')", name="ck_learning_paths_status"),
        CheckConstraint("version > 0", name="ck_learning_paths_version"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Module(Base):
    __tablename__ = "learning_modules"
    __table_args__ = (
        UniqueConstraint("path_id", "position", name="uq_learning_modules_path_position"),
        CheckConstraint("position > 0", name="ck_learning_modules_position"),
        CheckConstraint(
            "level IN ('basic', 'intermediate', 'advanced')", name="ck_learning_modules_level"
        ),
        CheckConstraint("status IN ('draft', 'published')", name="ck_learning_modules_status"),
        CheckConstraint("version > 0", name="ck_learning_modules_version"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    path_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    objectives: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Lesson(Base):
    __tablename__ = "learning_lessons"
    __table_args__ = (
        UniqueConstraint("module_id", "position", name="uq_learning_lessons_module_position"),
        CheckConstraint("position > 0", name="ck_learning_lessons_position"),
        CheckConstraint("status IN ('draft', 'published')", name="ck_learning_lessons_status"),
        CheckConstraint("version > 0", name="ck_learning_lessons_version"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    module_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("learning_modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    objectives: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Exercise(Base):
    __tablename__ = "learning_exercises"
    __table_args__ = (
        UniqueConstraint("lesson_id", "position", name="uq_learning_exercises_lesson_position"),
        CheckConstraint("position > 0", name="ck_learning_exercises_position"),
        CheckConstraint("status IN ('draft', 'published')", name="ck_learning_exercises_status"),
        CheckConstraint("version > 0", name="ck_learning_exercises_version"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("learning_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    prompt_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    starter_code: Mapped[str] = mapped_column(Text, nullable=False)
    # Lista de pruebas validada por app.curriculum.exercises antes de guardarse o publicarse.
    checks: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class LessonPrerequisite(Base):
    __tablename__ = "lesson_prerequisites"
    __table_args__ = (
        CheckConstraint("lesson_id != prerequisite_id", name="ck_lesson_prerequisites_distinct"),
        Index("ix_lesson_prerequisites_prerequisite_id", "prerequisite_id"),
    )

    lesson_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_lessons.id", ondelete="CASCADE"), primary_key=True
    )
    prerequisite_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_lessons.id", ondelete="RESTRICT"), primary_key=True
    )
