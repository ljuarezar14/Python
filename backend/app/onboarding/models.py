"""One editable set of learning preferences per user."""

from datetime import UTC, datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = (
        CheckConstraint(
            "goal IN ('explore', 'build', 'automate', 'innovate')", name="ck_user_profiles_goal"
        ),
        CheckConstraint(
            "experience IN ('none', 'some', 'comfortable')", name="ck_user_profiles_experience"
        ),
        CheckConstraint(
            "weekly_minutes IN (15, 30, 60, 120, 180)", name="ck_user_profiles_weekly_minutes"
        ),
        CheckConstraint(
            "example_context IN ('daily', 'academic', 'work', 'community')",
            name="ck_user_profiles_example_context",
        ),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goal: Mapped[str] = mapped_column(String(16), nullable=False)
    experience: Mapped[str] = mapped_column(String(16), nullable=False)
    weekly_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    interests: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    example_context: Mapped[str] = mapped_column(String(16), nullable=False)
    known_topics: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
