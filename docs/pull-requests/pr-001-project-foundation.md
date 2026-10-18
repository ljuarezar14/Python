# PR-001 — Fundamentos del proyecto

Estado: implementado localmente, pendiente de revisión y de historial Git publicable.

## Objetivo

Crear una base reproducible para frontend, API, calidad y documentación, sin adelantar funciones educativas.

## Contexto

El directorio inicial estaba vacío y no era un repositorio Git.

## Alcance

- Next.js con TypeScript y página inicial honesta sobre el estado del producto.
- FastAPI con comprobación de salud versionada.
- Lint, tipos y pruebas iniciales.
- Instrucciones locales, alcance MVP, arquitectura y ADR.

## Fuera de alcance

Autenticación, persistencia, currículo, editor, ejecución Python y despliegue.

## Archivos afectados

`frontend/`, `backend/`, `docs/`, `README.md`, `.gitignore` y `.env.example`.

## Criterios de aceptación

- [ ] Frontend y backend arrancan localmente.
- [ ] La página inicial y `GET /api/v1/health` responden.
- [ ] Lint, tipos, build y pruebas terminan sin errores.
- [ ] Documentación y ejemplo de configuración coinciden con el código.
- [ ] No hay secretos ni cambios funcionales fuera de alcance.

## Pruebas y evidencia

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; Next.js generó la ruta estática `/`.
- `uv run --no-cache pytest -q`: 3 pruebas aprobadas. Aparece una advertencia de deprecación de `starlette.testclient` con `httpx`, sin fallo.
- `uv run --no-cache ruff check --no-cache .`: correcto.
- `uv run --no-cache ruff format --check .`: 3 archivos conformes.
- Arranque local: `GET http://127.0.0.1:3000/` y `GET http://127.0.0.1:8000/api/v1/health` respondieron HTTP 200; la API devolvió `{"status":"ok"}`.
- `npm audit --omit=dev --json`: 0 vulnerabilidades reportadas en dependencias de producción al momento de la comprobación.

## Riesgos

El comando global `python` no funciona en este equipo; `uv` encontró Python 3.12. La caché de npm requirió una ruta local y `uv` se ejecutó con `--no-cache` por restricciones del entorno. No hay pruebas de flujo educativo porque todavía no existe tal flujo. Los metadatos Git están temporalmente en `.git-backup-pr001` para evitar un fallo de la herramienta al crear `.git` en la raíz; antes de abrir un PR remoto habrá que restablecer un repositorio Git normal y crear el historial de `main` con autorización.

## Revisión

- [x] Requisitos técnicos de PR-001 satisfechos localmente.
- [x] Código y archivos previstos revisados.
- [x] Pruebas ejecutadas.
- [x] CORS y dependencias de producción revisados.
- [x] Documentación actualizada.
- [x] Sin secretos expuestos.
- [x] Sin cambios funcionales fuera de alcance.
- [x] Sin errores conocidos críticos.
- [ ] Revisión y aprobación humana.

## Pendientes

Revisión humana, commits y publicación del PR remoto. Ninguno se presume realizado.
