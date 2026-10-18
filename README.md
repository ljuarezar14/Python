# PyRaíz

**El conocimiento echa raíces cuando lo aplicas.**

PyRaíz está en su primera etapa de desarrollo. El registro, las sesiones y el cuestionario inicial funcionan en local; las lecciones y la ejecución de Python llegarán en PRs posteriores. La [visión y el alcance inicial](docs/mvp-scope.md) explican el plan.

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
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Abre `http://localhost:3000` para la página inicial y entra en **Crear cuenta**. Después del registro se abre el cuestionario; también puedes volver a él desde **Tu cuenta**. La recomendación es una orientación inicial: todavía no hay lecciones publicadas. La API responde en `http://localhost:8000/api/v1/health` y publica su documentación en `http://localhost:8000/docs`. La migración crea o actualiza `backend/pyraiz.db`, un archivo local excluido de Git. Ejecuta el backend desde `backend/` para que la ruta relativa de SQLite sea consistente.

Para usar otros orígenes, define `PYRAIZ_CORS_ORIGINS` en el entorno antes de iniciar el backend. `.env.example` muestra las variables disponibles; esta base todavía no carga archivos `.env` automáticamente. Si cambias la URL de la API, define `NEXT_PUBLIC_PYRAIZ_API_URL` en `frontend/.env.local` antes de iniciar Next.js; `frontend/.env.example` muestra el formato.

Para PostgreSQL, usa `PYRAIZ_DATABASE_URL=postgresql+psycopg://usuario:clave@servidor:5432/pyraiz` y ejecuta la misma migración. Este PR se ha probado con SQLite local; PostgreSQL requiere una comprobación de integración antes del despliegue. En producción configura HTTPS, `PYRAIZ_ENV=production`, `PYRAIZ_COOKIE_SECURE=true` y los orígenes permitidos. No incluyas credenciales en Git.

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
- [Sistema de diseño](docs/design-system.md)
- [Modelo de identidad](docs/data-model.md)
- [Reglas de recomendación](docs/decisions/0003-rule-based-onboarding.md)
- [Contratos de identidad](docs/api-contracts.md)
- [Seguridad de autenticación](docs/security.md)
- [Alcance del MVP](docs/mvp-scope.md)
- [Roadmap de PRs](docs/roadmap.md)
- [Decisión arquitectónica inicial](docs/decisions/0001-modular-monolith.md)

Las implementaciones se revisarán en PRs pequeños. El estado real de cada PR y sus pruebas se registrará en `docs/pull-requests/`.
