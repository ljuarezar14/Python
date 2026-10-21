"""HTTP entry point for the initial PyRaíz API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.curriculum.routes import router as curriculum_router
from app.database import build_engine, build_session_factory
from app.identity.routes import router as identity_router
from app.identity.security import RateLimiter
from app.onboarding.routes import router as onboarding_router
from app.progress.routes import router as progress_router
from app.settings import Settings


class HealthResponse(BaseModel):
    status: str


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API without implicitly changing the database schema."""
    settings = settings or Settings.from_env()
    application = FastAPI(title="PyRaíz API", version="0.1.0")
    application.state.settings = settings
    application.state.engine = build_engine(settings.database_url)
    application.state.session_factory = build_session_factory(application.state.engine)
    application.state.rate_limiter = RateLimiter()
    application.state.progress_limiter = RateLimiter(limit=30)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type"],
    )
    application.include_router(identity_router, prefix="/api/v1/auth", tags=["identity"])
    application.include_router(onboarding_router, prefix="/api/v1/onboarding", tags=["onboarding"])
    application.include_router(curriculum_router, prefix="/api/v1/curriculum", tags=["curriculum"])
    application.include_router(progress_router, prefix="/api/v1/progress", tags=["progress"])

    @application.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return application


app = create_app()
