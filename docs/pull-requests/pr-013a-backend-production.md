# PR-013a — Backend listo para producción

Estado: implementado y comprobado; pendiente de revisión y PR remoto. Depende de PR-010d, ya unido a `main`.

## Objetivo

Que la API se pueda publicar con usuarios reales: sin configuraciones peligrosas, con cabeceras de seguridad, con un límite de intentos que funcione con varios procesos y probada con PostgreSQL.

## Alcance

- `app/settings.py`: con `PYRAIZ_ENV=production`, la API no arranca si:
  - La cookie no es `Secure`.
  - La base es SQLite.
  - Algún origen permitido no usa `https://` o es `*`.
  - El origen de la API no usa `https://`.

  El error enumera todos los problemas a la vez.
- `app/main.py`:
  - Cabeceras de seguridad en todas las respuestas: `nosniff`, `DENY`, `no-referrer` y una CSP estricta para JSON.
  - `Cache-Control: no-store` en identidad, onboarding y progreso.
  - En producción, HSTS, y documentación interactiva desactivada.
- **Límite de intentos compartido** (ADR-0010):
  - `RateLimiter` guarda los contadores en la tabla `rate_limit_counters` (migración 0006). El incremento es atómico, las claves se guardan como hash y las ventanas antiguas se limpian.
  - Sustituye al contador en memoria de cada proceso.
- `app/identity/cleanup.py`: `python -m app.identity.cleanup` borra las sesiones vencidas y los contadores de más de un día.
- **Pruebas:**
  - `tests/test_production.py`: 16 pruebas nuevas.
  - `tests/test_postgres.py`: 4 pruebas con PostgreSQL real, del grupo de dependencias `postgres` (`pgserver`). Sin servidor se omiten.
  - `tests/test_onboarding.py`: la prueba que simula la versión antigua ya no usa el limitador nuevo, porque el esquema 0001 no tenía su tabla.
- **Documentación:** guía `docs/deployment.md` (nueva), ADR-0010 (nueva), seguridad, modelo de datos, contratos, arquitectura, roadmap, README y `.env.example`.

## Fuera de alcance

- Cabeceras del frontend, CSP para Pyodide y revisión de accesibilidad (PR-013b).
- Proveedor, dominio, HTTPS, copias de seguridad y supervisión (PR-014).
- Recuperación de contraseña y verificación de correo, porque necesitan un servicio de correo.

## Criterios de aceptación

- [x] Una configuración de producción insegura impide arrancar y explica por qué.
- [x] Todas las respuestas llevan las cabeceras de seguridad, y las rutas con datos personales, `no-store`.
- [x] En producción hay HSTS y la documentación interactiva responde `404`.
- [x] El límite de intentos se comparte entre instancias de la API, en SQLite y en PostgreSQL.
- [x] Las migraciones funcionan de ida y vuelta en PostgreSQL y coinciden con los modelos.
- [x] El recorrido completo funciona en PostgreSQL y en el navegador contra la API reforzada.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- **Backend:** `pytest` da **96 correctas y 4 omitidas**; las omitidas son las de PostgreSQL, sin servidor. `ruff check` y `ruff format --check` correctos.
- **Auditoría:** `uv audit` no encuentra vulnerabilidades, tampoco en el grupo `postgres`.
- **PostgreSQL 16.2 temporal:** `uv run --group postgres pytest tests/test_postgres.py` da **4 correctas**:
  - Migraciones de ida y vuelta con `alembic check`.
  - El recorrido completo: registro, onboarding, carga de las 5 lecciones, intento guardado y resumen. Comprueba que la base es realmente PostgreSQL.
  - Límite compartido entre dos instancias: 10 respuestas `401` y luego `429`.
  - Limpieza de sesiones.
- **Sin el paquete del servidor** (`uv run --exact`): las 4 pruebas se omiten con su motivo.
- **SQLite:** migración 0006 de ida y vuelta, y `alembic check` sin diferencias.
- **Uvicorn real:**
  - Con `PYRAIZ_ENV=production`, SQLite y orígenes `http://`, no arranca. El error enumera los 3 problemas.
  - En desarrollo, `curl` confirma las cabeceras en `/auth/me`, `no-store` incluido, y que el preflight CORS de `PUT /progress` sigue respondiendo `200` con el origen permitido.
- **Navegador:** el recorrido de PR-010d contra la API nueva da 25 de 25 comprobaciones en Chrome y en Edge, sin errores en la consola ni `429` en el registro de la API. Cubre registro, 9 ejercicios guardados, progreso en lecciones y cuenta, y móvil.
- **No comprobado:** varios procesos de Uvicorn reales (se simularon con dos instancias de la aplicación sobre la misma base) y el comportamiento detrás de un proxy real.

## Seguridad y riesgos

Ver [ADR-0010](../decisions/0010-shared-rate-limit.md) y [deployment.md](../deployment.md):

- **Cada intento limitado escribe en la base.** Es aceptable para el piloto.
- **`--forwarded-allow-ips` debe nombrar solo el proxy propio.** Si no, el límite se aplica al proxy o se puede saltar.
- **Sin recuperación de contraseña,** quien la olvide tendrá que crear otra cuenta.

## Acciones Git

Rama `feat/pr-013a-backend-production`. El responsable hace los pasos de Git (commit, push, PR y merge).
