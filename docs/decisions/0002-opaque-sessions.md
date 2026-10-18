# ADR-0002: sesiones opacas persistidas

Estado: aceptada para PR-003.

## Contexto

PyRaíz necesita registro, acceso y cierre de sesión real. El frontend y la API funcionan en orígenes distintos durante desarrollo (`localhost:3000` y `localhost:8000`). Es importante poder revocar una sesión al salir sin exponer credenciales a JavaScript.

## Decisión

Usar tokens aleatorios opacos en cookies HttpOnly y almacenar únicamente sus hashes en `auth_sessions`. FastAPI valida la sesión en cada solicitud protegida. SQLAlchemy y Alembic gestionan la persistencia. SQLite facilita desarrollo local; la misma capa admite PostgreSQL configurado por URL.

## Alternativas

- JWT en `localStorage`: reduce lecturas de base, pero expone el token a JavaScript y complica la revocación inmediata.
- Sesiones solo en memoria: se pierden al reiniciar y no funcionan entre procesos.
- Un proveedor externo de identidad: añade costo y dependencia operativa antes de validar el producto.

## Consecuencias

Cada lectura protegida consulta la base de datos. La cookie requiere defensa CSRF: se combina SameSite Lax con comprobación de `Origin` para los POST actuales. Antes de publicar otros cambios de estado habrá que revisar esta política. La operación con múltiples procesos requerirá límite de intentos compartido y pruebas de PostgreSQL.
