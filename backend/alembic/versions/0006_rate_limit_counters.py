"""Add shared rate-limit counters.

Revision ID: 0006_rate_limit_counters
Revises: 0005_exercise_progress
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_rate_limit_counters"
down_revision: str | None = "0005_exercise_progress"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_counters",
        sa.Column("key_hash", sa.String(64), primary_key=True),
        sa.Column("window_start", sa.BigInteger(), primary_key=True),
        sa.Column("hits", sa.Integer(), nullable=False),
        sa.CheckConstraint("hits > 0", name="ck_rate_limit_counters_hits"),
    )
    op.create_index("ix_rate_limit_counters_window_start", "rate_limit_counters", ["window_start"])


def downgrade() -> None:
    op.drop_index("ix_rate_limit_counters_window_start", table_name="rate_limit_counters")
    op.drop_table("rate_limit_counters")
