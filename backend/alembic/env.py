"""Use the same database URL and models as the application."""

from alembic import context
from app.curriculum import models as curriculum_models  # noqa: F401 - registers curriculum tables
from app.database import Base, build_engine
from app.identity import models  # noqa: F401 - registers tables in Base.metadata
from app.onboarding import models as onboarding_models  # noqa: F401 - registers profile table
from app.settings import Settings

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=Settings.from_env().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = build_engine(Settings.from_env().database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
