"""Add read-only curriculum model.

Revision ID: 0003_curriculum
Revises: 0002_user_profiles
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_curriculum"
down_revision: str | None = "0002_user_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "learning_paths",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_learning_paths_status"),
        sa.CheckConstraint("version > 0", name="ck_learning_paths_version"),
    )
    op.create_table(
        "learning_modules",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "path_id",
            sa.String(64),
            sa.ForeignKey("learning_paths.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(16), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("objectives", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.UniqueConstraint("path_id", "position", name="uq_learning_modules_path_position"),
        sa.CheckConstraint("position > 0", name="ck_learning_modules_position"),
        sa.CheckConstraint(
            "level IN ('basic', 'intermediate', 'advanced')",
            name="ck_learning_modules_level",
        ),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_learning_modules_status"),
        sa.CheckConstraint("version > 0", name="ck_learning_modules_version"),
    )
    op.create_index("ix_learning_modules_path_id", "learning_modules", ["path_id"])
    op.create_table(
        "learning_lessons",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "module_id",
            sa.String(64),
            sa.ForeignKey("learning_modules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("objectives", sa.JSON(), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.UniqueConstraint("module_id", "position", name="uq_learning_lessons_module_position"),
        sa.CheckConstraint("position > 0", name="ck_learning_lessons_position"),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_learning_lessons_status"),
        sa.CheckConstraint("version > 0", name="ck_learning_lessons_version"),
    )
    op.create_index("ix_learning_lessons_module_id", "learning_lessons", ["module_id"])
    op.create_table(
        "lesson_prerequisites",
        sa.Column(
            "lesson_id",
            sa.String(64),
            sa.ForeignKey("learning_lessons.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "prerequisite_id",
            sa.String(64),
            sa.ForeignKey("learning_lessons.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.CheckConstraint("lesson_id != prerequisite_id", name="ck_lesson_prerequisites_distinct"),
    )
    op.create_index(
        "ix_lesson_prerequisites_prerequisite_id",
        "lesson_prerequisites",
        ["prerequisite_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_lesson_prerequisites_prerequisite_id", table_name="lesson_prerequisites")
    op.drop_table("lesson_prerequisites")
    op.drop_index("ix_learning_lessons_module_id", table_name="learning_lessons")
    op.drop_table("learning_lessons")
    op.drop_index("ix_learning_modules_path_id", table_name="learning_modules")
    op.drop_table("learning_modules")
    op.drop_table("learning_paths")
