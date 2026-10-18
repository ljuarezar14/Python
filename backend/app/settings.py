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

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            origin.strip()
            for origin in os.getenv("PYRAIZ_CORS_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        )
        secure = os.getenv("PYRAIZ_COOKIE_SECURE", "false").lower() == "true"
        if os.getenv("PYRAIZ_ENV") == "production" and not secure:
            raise ValueError("PYRAIZ_COOKIE_SECURE must be true in production")
        return cls(
            database_url=os.getenv("PYRAIZ_DATABASE_URL", "sqlite:///./pyraiz.db"),
            cors_origins=origins,
            cookie_secure=secure,
            api_origin=os.getenv("PYRAIZ_API_ORIGIN", "http://localhost:8000").rstrip("/"),
        )
