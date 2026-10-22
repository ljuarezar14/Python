"""Small, explicit settings for local development and deployment."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: tuple[str, ...]
    cookie_secure: bool
    api_origin: str = "http://localhost:8000"
    session_seconds: int = 7 * 24 * 60 * 60
    environment: str = "development"

    @property
    def production(self) -> bool:
        return self.environment == "production"

    def validate(self) -> "Settings":
        """Refuse unsafe production settings instead of starting with them."""
        if not self.production:
            return self
        problems = []
        if not self.cookie_secure:
            problems.append("PYRAIZ_COOKIE_SECURE must be true in production")
        if self.database_url.startswith("sqlite"):
            problems.append("PYRAIZ_DATABASE_URL must point to PostgreSQL in production")
        if not self.cors_origins or any(
            not origin.startswith("https://") for origin in self.cors_origins
        ):
            problems.append("PYRAIZ_CORS_ORIGINS must list only https:// origins in production")
        if not self.api_origin.startswith("https://"):
            problems.append("PYRAIZ_API_ORIGIN must use https:// in production")
        if problems:
            raise ValueError("; ".join(problems))
        return self

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            origin.strip().rstrip("/")
            for origin in os.getenv("PYRAIZ_CORS_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        )
        return cls(
            database_url=os.getenv("PYRAIZ_DATABASE_URL", "sqlite:///./pyraiz.db"),
            cors_origins=origins,
            cookie_secure=os.getenv("PYRAIZ_COOKIE_SECURE", "false").lower() == "true",
            api_origin=os.getenv("PYRAIZ_API_ORIGIN", "http://localhost:8000").rstrip("/"),
            environment=os.getenv("PYRAIZ_ENV", "development"),
        ).validate()
