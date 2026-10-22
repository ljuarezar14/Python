"""HTTP entry point for the initial PyRaíz API."""

from fastapi import FastAPI, Request
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


DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
# Respuestas con datos personales: ningún navegador ni proxy debe guardarlas.
PRIVATE_PREFIXES = ("/api/v1/auth", "/api/v1/onboarding", "/api/v1/progress")
# La API solo devuelve JSON: no carga recursos ni debe mostrarse dentro de otra página.
API_CSP = "default-src 'none'; frame-ancestors 'none'"
HSTS = "max-age=31536000"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API without implicitly changing the database schema."""
    settings = settings or Settings.from_env()
    # En producción no se publica la documentación interactiva de la API.
    docs = (
        {}
        if not settings.production
        else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    )
    application = FastAPI(title="PyRaíz API", version="0.1.0", **docs)
    application.state.settings = settings
    application.state.engine = build_engine(settings.database_url)
    application.state.session_factory = build_session_factory(application.state.engine)
    factory = application.state.session_factory
    application.state.rate_limiter = RateLimiter(factory, scope="auth")
    application.state.progress_limiter = RateLimiter(factory, scope="progress", limit=30)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type"],
    )

    @application.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if not path.startswith(DOCS_PATHS):
            response.headers.setdefault("Content-Security-Policy", API_CSP)
        if path.startswith(PRIVATE_PREFIXES):
            response.headers["Cache-Control"] = "no-store"
        if settings.production:
            response.headers.setdefault("Strict-Transport-Security", HSTS)
        return response

    application.include_router(identity_router, prefix="/api/v1/auth", tags=["identity"])
    application.include_router(onboarding_router, prefix="/api/v1/onboarding", tags=["onboarding"])
    application.include_router(curriculum_router, prefix="/api/v1/curriculum", tags=["curriculum"])
    application.include_router(progress_router, prefix="/api/v1/progress", tags=["progress"])

    @application.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return application


app = create_app()
