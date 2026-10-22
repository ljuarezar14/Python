# PyRaíz

**El conocimiento echa raíces cuando lo aplicas.**

PyRaíz está en su primera etapa de desarrollo. El registro, las sesiones y el cuestionario inicial funcionan en local. Ya puedes ver el mapa de aprendizaje, escribir Python en un editor que guarda un borrador en este navegador y ejecutarlo allí mismo con Pyodide. La API tiene el modelo curricular, pero el catálogo sigue vacío hasta publicar contenido revisado. Los ejercicios se comprueban en el navegador con pruebas automáticas, y, con una cuenta, tu último intento se guarda para retomarlo desde otro dispositivo. **Tu cuenta** muestra los ejercicios resueltos y los recientes. La [visión y el alcance inicial](docs/mvp-scope.md) explican el plan.

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

Abre `http://localhost:3000` para la página inicial y entra en **Crear cuenta**. Después del registro se abre el cuestionario; también puedes volver a él desde **Tu cuenta**. La recomendación es una orientación inicial. La API responde en `http://localhost:8000/api/v1/health` y publica su documentación en `http://localhost:8000/docs`. Para cargar las lecciones publicadas, desde `backend/` y después de migrar, ejecuta `uv run python -m app.curriculum.content`; puedes repetirlo sin duplicar nada. Después, abre `http://localhost:3000/aprender` y entra en **Python desde cero**. Si cambias el contenido de `backend/content/`, sube la `version` de lo que cambies y ejecuta `npm run check:content` desde `frontend/` para comprobar que cada solución de referencia supera sus pruebas (ADR-0009). Para probar ejercicios en local, desde `backend/`, ejecuta `uv run python -m app.curriculum.seed_dev`: carga una ruta de prueba con tres ejercicios marcados como datos sin revisión pedagógica (por ejemplo, `http://localhost:8000/api/v1/curriculum/exercises/dev-greeting`). Con el frontend en marcha, recorre la ruta de prueba desde `http://localhost:3000/aprender` hasta su lección, o abre directamente `http://localhost:3000/practicar/ejercicios/dev-greeting`, `dev-greeting-input` o `dev-rectangle-area` y pulsa **Comprobar**. No lo ejecutes contra una base compartida. La migración crea o actualiza `backend/pyraiz.db`, un archivo local excluido de Git. Ejecuta el backend desde `backend/` para que la ruta relativa de SQLite sea consistente. Las pruebas con PostgreSQL real se ejecutan con `uv run --group postgres pytest tests/test_postgres.py`. Para preparar un despliegue, sigue [docs/deployment.md](docs/deployment.md).

Abre `http://localhost:3000/aprender` para ver las etapas del producto y `http://localhost:3000/practicar` para escribir en el editor. **Ejecutar** (o Ctrl/⌘ + Enter) corre el código en tu navegador; la primera vez descarga el motor Pyodide, unos 6 MB. **Detener** corta una ejecución y **Reiniciar Python** borra el estado. Cada ejecución se detiene a los 10 segundos. El código no se envía al backend. Los borradores se guardan únicamente en el navegador; usa **Restablecer ejemplo** para volver al código inicial.

`npm run dev` y `npm run build` ejecutan antes `npm run build:python`, que copia Pyodide desde `node_modules` a `public/pyodide/` y compila el worker a `public/execution/`. Ambas carpetas se generan y están excluidas de Git. Si cambias archivos de `src/lib/execution/` con el servidor de desarrollo en marcha, vuelve a ejecutar `npm run build:python`.

Para usar otros orígenes, define `PYRAIZ_CORS_ORIGINS` en el entorno antes de iniciar el backend. `.env.example` muestra las variables disponibles; esta base todavía no carga archivos `.env` automáticamente. Si cambias la URL de la API, define `NEXT_PUBLIC_PYRAIZ_API_URL` en `frontend/.env.local` antes de iniciar Next.js; `frontend/.env.example` muestra el formato.

Para PostgreSQL, usa `PYRAIZ_DATABASE_URL=postgresql+psycopg://usuario:clave@servidor:5432/pyraiz` y ejecuta la misma migración. Este PR se ha probado con SQLite local; PostgreSQL requiere una comprobación de integración antes del despliegue. En producción configura HTTPS, `PYRAIZ_ENV=production`, `PYRAIZ_COOKIE_SECURE=true` y los orígenes permitidos. No incluyas credenciales en Git.

## Comprobaciones

```powershell
cd frontend
npm run lint
npm run typecheck
npm test
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
- [Modelo de datos](docs/data-model.md)
- [Reglas de recomendación](docs/decisions/0003-rule-based-onboarding.md)
- [Contratos HTTP](docs/api-contracts.md)
- [Decisión curricular](docs/decisions/0004-published-curriculum.md)
- [Seguridad de autenticación y ejecución](docs/security.md)
- [Alcance del MVP](docs/mvp-scope.md)
- [Mapa de aprendizaje](docs/product-map.md)
- [Decisión del editor](docs/decisions/0005-codemirror-editor.md)
- [Ejecución con Pyodide en Web Worker](docs/decisions/0006-pyodide-web-worker.md)
- [Ejercicios con pruebas públicas](docs/decisions/0007-exercise-checks.md)
- [Progreso autodeclarado por ejercicio](docs/decisions/0008-self-reported-progress.md)
- [Roadmap de PRs](docs/roadmap.md)
- [Decisión arquitectónica inicial](docs/decisions/0001-modular-monolith.md)

Las implementaciones se revisarán en PRs pequeños. El estado real de cada PR y sus pruebas se registrará en `docs/pull-requests/`.
