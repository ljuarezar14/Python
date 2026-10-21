"""Add the latest exercise attempt per user.

Revision ID: 0005_exercise_progress
Revises: 0004_exercises
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_exercise_progress"
down_revision: str | None = "0004_exercises"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exercise_progress",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "exercise_id",
            sa.String(64),
            sa.ForeignKey("learning_exercises.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("exercise_version", sa.Integer(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("last_status", sa.String(16), nullable=False),
        sa.Column("passed_count", sa.Integer(), nullable=False),
        sa.Column("total_count", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("solved_version", sa.Integer(), nullable=True),
        sa.Column("solved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "last_status IN ('passed', 'failed', 'timeout')", name="ck_exercise_progress_status"
        ),
        sa.CheckConstraint("exercise_version > 0", name="ck_exercise_progress_version"),
        sa.CheckConstraint(
            "total_count > 0 AND passed_count >= 0 AND passed_count <= total_count",
            name="ck_exercise_progress_counts",
        ),
        sa.CheckConstraint("attempts > 0", name="ck_exercise_progress_attempts"),
    )
    op.create_index("ix_exercise_progress_exercise_id", "exercise_progress", ["exercise_id"])


def downgrade() -> None:
    op.drop_index("ix_exercise_progress_exercise_id", table_name="exercise_progress")
    op.drop_table("exercise_progress")
