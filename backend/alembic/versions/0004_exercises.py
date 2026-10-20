"""Add exercises attached to lessons.

Revision ID: 0004_exercises
Revises: 0003_curriculum
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_exercises"
down_revision: str | None = "0003_curriculum"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "learning_exercises",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "lesson_id",
            sa.String(64),
            sa.ForeignKey("learning_lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("prompt_markdown", sa.Text(), nullable=False),
        sa.Column("starter_code", sa.Text(), nullable=False),
        sa.Column("checks", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.UniqueConstraint("lesson_id", "position", name="uq_learning_exercises_lesson_position"),
        sa.CheckConstraint("position > 0", name="ck_learning_exercises_position"),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_learning_exercises_status"),
        sa.CheckConstraint("version > 0", name="ck_learning_exercises_version"),
    )
    op.create_index("ix_learning_exercises_lesson_id", "learning_exercises", ["lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_learning_exercises_lesson_id", table_name="learning_exercises")
    op.drop_table("learning_exercises")
