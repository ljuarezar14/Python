# Preparación para producción: backend

Lista para desplegar la API (PR-013a). El despliegue concreto y el proveedor se deciden en PR-014.

## Variables de entorno

Con `PYRAIZ_ENV=production`, la API **no arranca** si alguna de estas reglas falla, y el error dice cuál:

| Variable | Valor en producción |
| --- | --- |
| `PYRAIZ_ENV` | `production` |
| `PYRAIZ_DATABASE_URL` | PostgreSQL, por ejemplo `postgresql+psycopg://usuario:clave@servidor/pyraiz`. SQLite no se acepta. |
| `PYRAIZ_CORS_ORIGINS` | Solo orígenes `https://` del frontend, separados por comas. `*` no se acepta. |
| `PYRAIZ_API_ORIGIN` | El origen `https://` de la propia API. |
| `PYRAIZ_COOKIE_SECURE` | `true` |

La clave de la base es un secreto: se guarda en el gestor de secretos del proveedor, nunca en el repositorio.

## Orden de despliegue

1. `uv sync --no-dev`, desde `backend/`.
2. `uv run alembic upgrade head`. Las migraciones no se aplican solas al arrancar.
3. `uv run python -m app.curriculum.content`, para cargar o actualizar las lecciones (ADR-0009).
4. Arrancar la API detrás de un proxy con HTTPS:

   ```
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=<IP del proxy>
   ```

   **`--forwarded-allow-ips` debe nombrar solo el proxy propio.** Así Uvicorn toma la dirección real de la persona de `X-Forwarded-For`, y el límite de intentos se aplica a cada persona, no al proxy. Con `*`, cualquiera podría inventarse una dirección para saltarse el límite.
5. Programar `uv run python -m app.identity.cleanup` una vez al día. Borra las sesiones vencidas y los contadores de intentos antiguos.

Se pueden ejecutar varios procesos o servidores: el límite de intentos se guarda en la base y lo comparten todos (ADR-0010).

## Lo que añade el modo producción

- Cabecera `Strict-Transport-Security` (HSTS) en todas las respuestas.
- `/docs`, `/redoc` y `/openapi.json` desactivados. En desarrollo siguen disponibles.

En todos los entornos, la API envía estas cabeceras:
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer`.
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.
- `Cache-Control: no-store` en identidad, onboarding y progreso, que llevan datos personales.

## Pruebas con PostgreSQL

`uv run --group postgres pytest tests/test_postgres.py` inicia un PostgreSQL temporal con `pgserver` y comprueba:
- Las migraciones de ida y vuelta, y que coinciden con los modelos.
- El recorrido completo de una persona.
- El límite compartido entre instancias.
- La limpieza.

Con un servidor propio, define `PYRAIZ_TEST_POSTGRES_URL`. Sin ninguno de los dos, esas pruebas se omiten.

## Frontend

- Compilar con `NEXT_PUBLIC_PYRAIZ_API_URL` apuntando a la API `https://`. Esa URL queda dentro de la compilación y de la CSP: si cambia, hay que recompilar.
- Publicar con `npm run build` y `npm run start` (Node.js). Las páginas se generan en cada petición para llevar el nonce de la CSP ([ADR-0011](decisions/0011-frontend-csp-nonces.md)); no sirve una exportación estática.
- Si el proveedor añade sus propias cabeceras, no debe sustituir la `Content-Security-Policy` de las páginas ni la del worker (`/execution/`, `/pyodide/`).
- Comprobar tras publicar: `curl -I https://<sitio>/aprender` muestra la CSP con `nonce-`, y en **Practicar** el botón **Ejecutar** muestra la salida de Python.

## Pendiente antes del piloto

- Proveedor, dominio, copias de seguridad de la base y supervisión (PR-014).
- Recuperación de contraseña y verificación de correo: necesitan un servicio de correo y quedan fuera del piloto. Hasta entonces, quien olvide su contraseña tendrá que crear otra cuenta.
