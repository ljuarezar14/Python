# PR-003 — Registro y sesiones

Estado: implementado y probado localmente; pendiente de revisión del PR remoto.

## Objetivo

Permitir que una persona cree una cuenta, ingrese, consulte su sesión y salga, con datos persistidos y controles básicos de seguridad.

## Contexto

La página inicial de PR-002 ofrecía solo contenido público. Los siguientes módulos necesitan una identidad estable para asociar preferencias y progreso a una persona.

## Alcance

- Usuarios y sesiones persistidos mediante SQLAlchemy y migración Alembic.
- API versionada de registro, acceso, consulta de cuenta y cierre de sesión.
- Formularios accesibles de registro y acceso; página de cuenta y navegación desde la página inicial.
- Contratos, configuración de desarrollo, seguridad y decisión arquitectónica documentados.

## Fuera de alcance

Recuperación de contraseña, verificación de correo, eliminación de cuenta, administración, perfil ampliado y proveedor de correo. Se planificarán en PRs específicos cuando exista la infraestructura necesaria.

## Archivos afectados

`backend/app/identity/`, `backend/app/database.py`, `backend/app/settings.py`, `backend/app/main.py`, `backend/alembic/`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/tests/test_auth.py`, `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/api.ts`, archivos `.env.example`, `README.md` y documentación de `docs/`.

## Decisiones de arquitectura

- Sesión opaca revocable en cookie HttpOnly; su token solo se conserva como hash en la base. [ADR-0002](../decisions/0002-opaque-sessions.md).
- SQLite permite probar el flujo local sin un servicio adicional. La URL de PostgreSQL es configurable y la migración genera SQL para ese dialecto, pero todavía no se ha ejecutado contra PostgreSQL real.
- Registro asigna siempre `student`; no se acepta `role` en el cuerpo. Las rutas futuras comprobarán roles en el servidor.
- Se separa recuperación de contraseña para no simular envío de correos ni incorporar infraestructura sin usar.

## Criterios de aceptación

- [x] Registro crea usuario con contraseña Argon2id y sesión persistente.
- [x] Inicio de sesión valida credenciales sin diferenciar correo desconocido de contraseña errónea.
- [x] Cuenta requiere sesión vigente; cierre de sesión revoca el token.
- [x] Formularios muestran errores y estado de espera, con etiquetas y foco visible.
- [x] API rechaza origen no autorizado, exceso de intentos y campos no esperados.
- [x] Migración de identidad y documentación de arranque local.
- [x] Registro, cuenta, cierre de sesión y nuevo ingreso verificados manualmente en navegador por el responsable del proyecto.
- [x] Formulario revisado en ventana estrecha y recorrido con teclado; el responsable confirmó foco visible y ausencia de desplazamiento horizontal.
- [ ] Revisión humana del PR.

## Pruebas y evidencia

- `uv run pytest -q`: 9 pruebas correctas. Ejecutan la migración en SQLite temporal y cubren registro, hash, cookie, acceso, sesión tras reinicio, revocación, entradas inválidas, origen, límite de intentos y requisito de cookie segura en producción.
- `uv run ruff check .`: correcto.
- `uv run ruff format --check .`: correcto tras aplicar el formato final.
- `uv audit --locked`: no reporta vulnerabilidades conocidas en los 38 paquetes auditados.
- `uv run alembic upgrade head --sql` con URL PostgreSQL: generó SQL para `users` y `auth_sessions`; esto no valida un servidor PostgreSQL real.
- `npm run lint`, `npm run typecheck`, `npm run build`: correctos. Next.js generó `/`, `/registro`, `/ingresar` y `/cuenta`.
- Servidor de producción Next.js: las cuatro rutas respondieron HTTP 200, cada una con un `h1` y CSS enlazado.
- Prueba manual del responsable: la cuenta mostró el correo registrado; cerrar sesión y volver a ingresar funcionó. También confirmó que el formulario cabe en una ventana estrecha y que el foco es visible al usar Tab.

## Riesgos y límites

- El límite de intentos está en memoria de un solo proceso. El despliegue requiere una política compartida en el borde.
- La configuración HTTPS/cookie `Secure` y la migración PostgreSQL deben validarse en un entorno de despliegue antes de abrir el servicio públicamente.
- El flujo y el teclado se probaron manualmente en navegador. Queda pendiente una revisión con lector de pantalla y dispositivos móviles reales.
- Pytest muestra una advertencia de deprecación de Starlette sobre `httpx`; las pruebas siguen pasando.

## Checklist

- [x] Requisitos de este PR implementados.
- [x] Código revisado y comprobaciones automatizadas ejecutadas.
- [x] Seguridad revisada; riesgos restantes documentados.
- [x] Documentación actualizada.
- [x] Sin credenciales ni archivos de base local incluidos.
- [x] Sin cambios fuera de alcance.
- [ ] Revisión manual y aprobación.

## Conocimientos aplicados

Modelos SQLAlchemy, migraciones Alembic, dependencias de FastAPI, hash Argon2id, cookies HttpOnly y pruebas de integración con bases temporales. La actividad recomendada es localizar en `routes.py` dónde se revoca una sesión y explicar por qué `GET /auth/me` deja de aceptarla después.

## Acciones Git

Rama local `feat/pr-003-authentication`; sin commit, push ni PR remoto por parte del agente.
