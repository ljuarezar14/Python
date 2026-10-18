"""Store one editable onboarding profile per user.

Revision ID: 0002_user_profiles
Revises: 0001_identity
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_user_profiles"
down_revision: str | None = "0001_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("goal", sa.String(16), nullable=False),
        sa.Column("experience", sa.String(16), nullable=False),
        sa.Column("weekly_minutes", sa.Integer(), nullable=False),
        sa.Column("interests", sa.JSON(), nullable=False),
        sa.Column("example_context", sa.String(16), nullable=False),
        sa.Column("known_topics", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "goal IN ('explore', 'build', 'automate', 'innovate')", name="ck_user_profiles_goal"
        ),
        sa.CheckConstraint(
            "experience IN ('none', 'some', 'comfortable')", name="ck_user_profiles_experience"
        ),
        sa.CheckConstraint(
            "weekly_minutes IN (15, 30, 60, 120, 180)", name="ck_user_profiles_weekly_minutes"
        ),
        sa.CheckConstraint(
            "example_context IN ('daily', 'academic', 'work', 'community')",
            name="ck_user_profiles_example_context",
        ),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
