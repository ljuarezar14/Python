# PR-009a — Modelo y API de progreso por ejercicio

Estado: implementado localmente; pendiente de revisión y PR remoto. La interfaz que guarda y retoma el progreso corresponde a PR-009b.

## Objetivo

Guardar en la cuenta el último intento de cada persona en cada ejercicio (código y resultado) para poder retomarlo desde otro dispositivo y saber qué ejercicios están resueltos.

## Contexto

PR-008 evalúa ejercicios en el navegador, pero el resultado se pierde y el borrador vive solo en ese navegador. Los resultados son formativos y se pueden falsificar (ADR-0007), así que el progreso se guarda como autodeclarado.

## Alcance

- Tabla `exercise_progress` (migración `0005_exercise_progress`): una fila por persona y ejercicio con último código, versión, estado, pruebas correctas y totales, número de intentos y versión en la que se resolvió.
- `PUT /api/v1/progress/exercises/{id}`: guarda un intento con sesión y `Origin` autorizado. Valida visibilidad, versión, número de pruebas y coherencia del estado.
- `GET /api/v1/progress/exercises/{id}`: devuelve el último intento propio.
- `GET /api/v1/progress`: número de ejercicios resueltos y hasta 50 ejercicios recientes, sin código.
- Límite de 30 guardados por minuto y persona.
- `visible_exercise` compartida entre currículo y progreso, para aplicar las mismas reglas de visibilidad.
- ADR-0008 y actualización de contratos, modelo de datos, seguridad, arquitectura, mapa, alcance, roadmap y README.
- `certifi` actualizado a 2026.10.19 en `uv.lock` por un aviso de seguridad publicado el 19 de octubre. Es una dependencia de desarrollo, vía `httpx`.

## Fuera de alcance

La interfaz (PR-009b), el historial completo de intentos, insignias, rachas, estadísticas, exportación o borrado de datos y cualquier evaluación en el servidor.

## Archivos afectados

`backend/app/progress/` (modelo, esquemas y rutas), `backend/alembic/versions/0005_exercise_progress.py`, `backend/alembic/env.py`, `backend/app/main.py`, `backend/app/curriculum/routes.py`, `backend/tests/test_progress.py`, `backend/uv.lock`, `README.md` y documentación en `docs/`.

## Decisiones de arquitectura

- **Una fila por persona y ejercicio**, no un historial: basta para retomar y contar resueltos, y guarda menos datos personales (ADR-0008).
- **Resuelto por versión:** `solved_version` registra la versión en la que todas las pruebas pasaron. Si el ejercicio cambia, el intento queda `outdated` y deja de contar hasta resolver la versión nueva. Un intento posterior que falla no desmarca un ejercicio resuelto.
- **La persona sale siempre de la cookie**, nunca del cuerpo ni de la URL.
- **`409` para una versión distinta**, para que la interfaz pida recargar en vez de guardar un intento contra pruebas que ya no existen.
- **Solo se guardan resultados del programa** (`passed`, `failed`, `timeout`). Cancelar o un fallo del motor no dicen nada del código del estudiante.
- Las fechas se devuelven siempre en UTC, porque SQLite pierde la zona horaria al leer.

## Criterios de aceptación

- [x] Con sesión se guarda y se lee el último intento; los intentos se cuentan y un ejercicio resuelto sigue resuelto tras un fallo posterior.
- [x] Nadie puede leer ni modificar el progreso de otra persona.
- [x] `401` sin sesión, `403` sin origen autorizado, `404` para ejercicios no visibles, `409` para otra versión, `422` para datos incoherentes o demasiado grandes, `429` por exceso de guardados.
- [x] Un cambio de versión marca el intento como desactualizado y no cuenta como resuelto.
- [x] El resumen excluye ejercicios ocultos sin borrar sus datos y no incluye código.
- [x] Borrar la cuenta o el ejercicio borra el progreso.
- [x] Migración con vuelta atrás; `alembic check` sin diferencias.
- [x] Ruff, pruebas y auditoría correctas; sin cambios en el frontend.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `uv run pytest`: **65 correctas**, 23 nuevas en `test_progress.py`.
- Comprobaciones de mutación. Se rompió a propósito cada protección; falló la prueba esperada y luego se restauró el código:
  - Quitar el control de `Origin` hizo fallar `test_saving_requires_trusted_origin`.
  - Quitar el filtro por persona del resumen hizo fallar `test_progress_is_private_to_each_user`.
  - Quitar la comprobación de versión hizo fallar `test_rejects_attempts_for_another_exercise_version`.
- `ruff check` y `ruff format --check`: correctos.
- Alembic en SQLite temporal: `upgrade head`, `check` sin operaciones pendientes, `downgrade 0004_exercises` y `upgrade head` otra vez. SQL de PostgreSQL generado sin conexión (`--sql`), sin probar contra un servidor real.
- Prueba con `uvicorn` real en el puerto 8107, sobre una SQLite temporal con `seed_dev`:
  - La preflight CORS de `PUT` desde el origen del frontend permite el método y las credenciales.
  - Registro, `PUT`, `GET` del intento y resumen respondieron `200`; sin sesión, `401`.
- `uv audit`: sin vulnerabilidades tras actualizar `certifi`.

## Revisión de código

- **Corregido:** las fechas salían con `Z` al crear el intento y sin zona al leerlo desde SQLite. Una prueba lo detectó; ahora se normalizan a UTC.
- **Corregido:** `alembic check` detectó que la migración permitía fechas vacías y el modelo no.
- **Mejorado:** el resumen ya no carga de la base el código de cada intento.
- **Aceptado:** dos guardados simultáneos pueden perder una unidad del contador de intentos. Es un dato orientativo. El caso de dos primeros guardados a la vez se reintenta como actualización.
- **Aceptado:** el límite de guardados es por proceso, como el de acceso; antes de usar varios procesos hará falta uno compartido.

## Seguridad y riesgos

El progreso es autodeclarado: cualquiera puede enviar un resultado falso para su propia cuenta, pero no para otra. No debe usarse para acreditar ni comparar. El backend guarda el código como texto y no lo ejecuta. El código es dato personal: solo lo ve su autor y se borra en cascada. Detalle en [security.md](../security.md) y [ADR-0008](../decisions/0008-self-reported-progress.md).

## Checklist

- [x] Alcance implementado y verificaciones ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos ni archivos generados en Git.
- [x] Sin cambios en el frontend ni funciones de PR-009b.
- [ ] Revisión del PR.

## Conocimientos aplicados

Claves primarias compuestas, restricciones `CHECK`, validadores de modelo en Pydantic, dependencias de FastAPI para sesión y origen, `defer` de SQLAlchemy, zonas horarias en SQLite y comprobaciones de mutación. Actividad sugerida: busca en `AttemptIn` (`backend/app/progress/schemas.py`) la línea que rechaza `{"status": "timeout", "passed_count": 2, "total_count": 2}` y explica por qué ese intento no tiene sentido.

## Acciones Git

Rama `feat/pr-009a-progress-api`. El responsable hace los pasos de Git (rama, commit, push, PR y merge).
