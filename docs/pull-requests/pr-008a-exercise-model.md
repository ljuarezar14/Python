# PR-008a — Modelo, pruebas y API de ejercicios

Estado: implementado localmente; pendiente de revisión y PR remoto. La evaluación en el navegador corresponde a PR-008b.

## Objetivo

Definir y almacenar ejercicios con pruebas verificables, y exponerlos en la API pública con las mismas reglas de visibilidad que las lecciones, para que el evaluador de PR-008b pueda cargarlos.

## Contexto

PR-007 ejecuta Python en el navegador, pero no existía ningún ejercicio en el sistema. PR-008 se dividió en dos para mantener PRs pequeños: este PR cubre el backend y PR-008b el evaluador y la interfaz.

## Alcance

- Modelo `Exercise` y migración `0004_exercises` (tabla `learning_exercises`).
- Contrato de pruebas `output` y `function` con validación Pydantic en `app/curriculum/exercises.py`.
- `GET /api/v1/curriculum/exercises/{id}` y lista `exercises` en el detalle de lección.
- Comando `python -m app.curriculum.seed_dev` con tres ejercicios de prueba para desarrollo local.
- ADR-0007 y actualización de contratos, modelo de datos, seguridad, arquitectura, roadmap y README.

## Fuera de alcance

Evaluador, modo `exercise` del motor, interfaz de ejercicios (PR-008b), intentos y progreso (PR-009), herramientas editoriales y contenido pedagógico publicado. No hay cambios en el frontend.

## Archivos afectados

`backend/app/curriculum/models.py`, `exercises.py`, `routes.py`, `schemas.py`, `seed_dev.py`, `backend/alembic/versions/0004_exercises.py`, `backend/tests/test_exercises.py`, `README.md` y documentación en `docs/`.

## Decisiones de arquitectura

- Las pruebas son datos JSON con un contrato cerrado, no código Python arbitrario.
- La API oculta con `404` los ejercicios en borrador, con pruebas inválidas o de lecciones no visibles, siguiendo ADR-0004.
- Las reglas de comparación que aplicará PR-008b quedan fijadas en ADR-0007: se ignoran los espacios finales; el texto de solicitud de `input()` no cuenta; no hay tolerancia para decimales.
- Los datos de prueba se cargan con un comando explícito, nunca con una migración.

Detalle en [ADR-0007](../decisions/0007-exercise-checks.md).

## Criterios de aceptación

- [x] La migración crea la tabla sin alterar datos existentes y se puede revertir.
- [x] Las pruebas mal formadas se rechazan: lista vacía, tipo desconocido, campo extra, identificador repetido o inválido, entrada multilínea, salida o JSON demasiado grandes, `NaN` o infinito, nombre de función inválido o más de 20 pruebas.
- [x] Los ejercicios en borrador, con pruebas inválidas, de lecciones no visibles o inexistentes responden `404` y no aparecen en la lección.
- [x] Una instalación sin datos no muestra ejercicios.
- [x] `seed_dev` es idempotente, se niega a ejecutarse en producción y avisa si falta la migración.
- [x] Pruebas de backend correctas; sin cambios en el frontend.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `uv run pytest -q`: 42 correctas (19 anteriores y 23 nuevas). En este equipo se ejecutan con `--basetemp` y `-p no:cacheprovider` por un problema de permisos de la carpeta temporal predeterminada.
- Comprobación de mutación: al quitar la comprobación de visibilidad de la lección y la validación de pruebas en `get_exercise`, falló `test_hidden_exercises_respond_404`. El código se restauró y la suite volvió a pasar completa.
- `uv run ruff check .` y `uv run ruff format --check .`: correctos.
- `uv run alembic check` sobre una SQLite migrada: no detectó operaciones pendientes.
- `uv run alembic upgrade 0003_curriculum:0004_exercises --sql` con dialecto PostgreSQL: generó `CREATE TABLE learning_exercises` con sus restricciones, sin conectar a un servidor.
- `seed_dev` con una SQLite temporal:
  - Sin migrar, devolvió código 1 y el aviso de ejecutar `alembic upgrade head`.
  - Ejecutado dos veces, dejó exactamente 3 ejercicios.
  - Con `PYRAIZ_ENV=production`, devolvió código 1.
- API real con uvicorn sobre esa base: `GET /curriculum/exercises/dev-greeting-input` respondió 200 con sus dos pruebas `stdin`, un identificador inexistente respondió 404, y la lección listó los tres ejercicios en orden. OpenAPI incluye `OutputCheck`, `FunctionCheck`, `ExerciseSummary` y `ExerciseDetail`.
- `uv audit --locked`: sin vulnerabilidades conocidas en 38 paquetes.
- PostgreSQL real no comprobado.

## Revisión de código

Antes del commit se revisó el diff completo:

- **Corregido:** `json.dumps` aceptaba `NaN` e infinito en los argumentos de `function`. Esos valores no son JSON válido y el navegador no podría leer la respuesta. Ahora se rechazan, y dos pruebas lo cubren.
- **Aceptado:** `seed_dev` crea un archivo SQLite vacío si la URL apunta a uno inexistente antes de avisar que falta la migración. Es inocuo en desarrollo.
- **Aceptado:** `get_exercise` valida las pruebas dos veces (para decidir la visibilidad y para construir la respuesta). El costo es despreciable con un máximo de 20 pruebas.

## Seguridad y riesgos

Las pruebas son públicas por diseño y la evaluación no sirve para acreditar. La API es de solo lectura y no ejecuta código. La validación limita tamaños para evitar respuestas excesivas. `seed_dev` publica datos de prueba; no debe ejecutarse contra una base compartida. La validación previa a publicar depende de la futura herramienta editorial. Detalle en [security.md](../security.md).

## Checklist

- [x] Alcance implementado y verificaciones ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos ni bases de datos locales en Git.
- [x] Sin cambios de frontend ni funciones de PR-008b o PR-009.
- [ ] Revisión del PR.

## Conocimientos aplicados

Uniones discriminadas de Pydantic, validadores de campo y de modelo, migraciones Alembic con restricciones, `session.merge` para cargas idempotentes y pruebas parametrizadas. Actividad sugerida: añade a `test_validate_checks_rejects_malformed_definitions` un caso con `"function_name": "print"` y explica por qué el contrato lo acepta aunque no sea buena idea.

## Acciones Git

Rama `feat/pr-008a-exercise-model`. Por indicación del responsable, el agente hizo el commit y el push de PR-008; el merge queda a cargo del responsable.
