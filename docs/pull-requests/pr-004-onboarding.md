# PR-004 — Cuestionario y recomendación inicial

Estado: implementado localmente; flujo principal comprobado en navegador; pendiente de revisión de accesibilidad y PR remoto.

## Objetivo

Permitir que cada persona registre objetivos y preferencias para recibir una sugerencia inicial explicable y editable.

## Contexto

PR-003 identifica al usuario, pero aún no conoce qué desea aprender. El currículo real llegará en PR-005; esta entrega prepara las preferencias sin inventar lecciones disponibles.

## Alcance

- Cuestionario de objetivo, experiencia, tiempo semanal, intereses, contexto de ejemplos y temas conocidos.
- Perfil persistente, editable y vinculado a la cuenta mediante migración Alembic.
- Regla versionada que propone fundamentos comunes, enfoque, tema, ritmo y proyecto ilustrativo.
- Página responsive `/onboarding`, enlace desde la cuenta y apertura tras el registro.
- Documentación del contrato, modelo y decisión pedagógica.

## Fuera de alcance

Diagnóstico verificable, salto de módulos, rutas curriculares publicadas, seguimiento de progreso y tutor IA.

## Archivos afectados

`backend/app/onboarding/`, `backend/alembic/versions/0002_user_profiles.py`, `backend/app/main.py`, `backend/app/database.py`, `backend/alembic/env.py`, `backend/tests/test_onboarding.py`, `frontend/src/app/onboarding/`, `frontend/src/components/onboarding-form.tsx`, `frontend/src/lib/onboarding.ts`, componentes de cuenta y registro, `README.md` y documentación en `docs/`.

## Arquitectura

La recomendación es una función pura en `rules.py` que no consulta la base. `user_profiles` conserva solo respuestas; cada consulta calcula de nuevo el resultado de la versión 1. `user_id` proviene de la sesión y no del navegador. Las listas de intereses y temas se reemplazan completas al editar, como requiere el seguimiento de cambios de columnas JSON en SQLAlchemy. [ADR-0003](../decisions/0003-rule-based-onboarding.md).

## Criterios de aceptación

- [x] Solo usuarios autenticados consultan o guardan su perfil.
- [x] Las respuestas se validan y pueden editarse sin crear otro perfil.
- [x] La recomendación explica el inicio y nunca salta fundamentos por autodeclaración.
- [x] Objetivo, primer interés, tiempo y preferencia de ejemplos modifican partes visibles de la recomendación.
- [x] La interfaz aclara que las lecciones y proyectos aún no están disponibles.
- [x] La migración preserva usuarios y sesiones existentes.
- [ ] Cuestionario recorrido manualmente con teclado y ventana estrecha.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `uv run pytest -q`: 15 pruebas correctas; incluyen actualización desde PR-003 sin perder la cuenta ni sesión, reglas, autorización, propiedad de datos, edición, validación, CORS y eliminación en cascada.
- `uv run ruff check .` y `uv run ruff format --check .`: correctos.
- `npm run lint`, `npm run typecheck`, `npm run build`: correctos; Next.js genera `/onboarding`.
- Servidor Next.js de producción: `/onboarding` respondió HTTP 200, con un `h1` y CSS enlazado.
- `uv run alembic upgrade head --sql` con URL PostgreSQL: generó la tabla `user_profiles`, sin conectar a PostgreSQL.
- `uv audit --locked`: sin vulnerabilidades conocidas en 38 paquetes auditados.
- Prueba manual del cuestionario: el responsable confirmó que guardar, recargar y cambiar el primer interés funcionan y actualizan la recomendación.

## Seguridad y riesgos

La API exige una sesión válida y comprueba el origen en `PUT`. El identificador del usuario no se acepta en el cuerpo. Las respuestas se limitan a opciones y evitan texto libre. Los tipos de opciones están declarados tanto en Python como en TypeScript y deben actualizarse juntos cuando cambie el contrato. PostgreSQL real y lectores de pantalla requieren pruebas antes del despliegue. La recomendación no es una acreditación de dominio.

## Checklist

- [x] Alcance implementado y pruebas automatizadas ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin credenciales ni datos de usuarios reales en Git.
- [x] Sin cambios fuera de alcance.
- [ ] Revisión manual y aprobación.

## Conocimientos aplicados

Validación con Pydantic, claves foráneas, columnas JSON, migraciones, funciones puras y pruebas de integración. Actividad sugerida: cambia tu primer interés en el formulario y explica por qué cambia `suggested_theme` mientras `starting_point` permanece igual.

## Acciones Git

Rama local `feat/pr-004-onboarding`; sin commit, push ni PR remoto por parte del agente.
