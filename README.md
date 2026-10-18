# PyRaíz

**El conocimiento echa raíces cuando lo aplicas.**

PyRaíz está en su primera etapa de desarrollo. Este repositorio contiene una base de Next.js y FastAPI; todavía no ofrece registro, lecciones ni ejecución de Python. La [visión y el alcance inicial](docs/mvp-scope.md) explican el plan.

## Requisitos

- Node.js 22 o posterior y npm 10 o posterior.
- Python 3.12 o posterior y [uv](https://docs.astral.sh/uv/) para el backend.

## Inicio local

En una terminal, desde `frontend/`:

```powershell
npm ci
npm run dev
```

En otra terminal, desde `backend/`:

```powershell
uv sync
uv run uvicorn app.main:app --reload
```

Abre `http://localhost:3000` para la página inicial. La API responde en `http://localhost:8000/api/v1/health` y publica su documentación en `http://localhost:8000/docs`.

Para usar otros orígenes, define `PYRAIZ_CORS_ORIGINS` en el entorno antes de iniciar el backend. `.env.example` muestra el nombre y el valor por defecto; esta base todavía no carga archivos `.env` automáticamente. No incluyas credenciales en Git.

## Comprobaciones

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

```powershell
cd backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

## Documentación

- [Arquitectura inicial](docs/architecture.md)
- [Alcance del MVP](docs/mvp-scope.md)
- [Roadmap de PRs](docs/roadmap.md)
- [Decisión arquitectónica inicial](docs/decisions/0001-modular-monolith.md)

Las implementaciones se revisarán en PRs pequeños. El estado real de cada PR y sus pruebas se registrará en `docs/pull-requests/`.
