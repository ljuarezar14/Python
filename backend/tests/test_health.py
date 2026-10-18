"""Public API smoke checks."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_in_openapi() -> None:
    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/health" in response.json()["paths"]


def test_cors_allows_only_configured_origin() -> None:
    client = TestClient(app)

    allowed = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    other = client.get("/api/v1/health", headers={"Origin": "https://example.org"})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in other.headers
