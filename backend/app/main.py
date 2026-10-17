"""HTTP entry point for the initial PyRaíz API."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


def create_app() -> FastAPI:
    """Create the API with explicit local development CORS origins."""
    application = FastAPI(title="PyRaíz API", version="0.1.0")
    origins = [
        origin.strip()
        for origin in os.getenv("PYRAIZ_CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @application.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return application


app = create_app()
