# PR-005 — Modelo curricular y API de contenidos

Estado: implementado localmente; pendiente de revisión y PR remoto.

## Objetivo

Representar rutas, módulos, lecciones y prerrequisitos con identificadores estables y ofrecer una API pública que exponga solo contenido publicado.

## Contexto

El onboarding de PR-004 recomienda fundamentos, pero no dispone de un catálogo. PR-005 establece la estructura y el contrato de lectura antes de que PR-010 incorpore material pedagógico revisado.

## Alcance

- Migración `0003_curriculum` y modelos `LearningPath`, `Module`, `Lesson`, `LessonPrerequisite`.
- Endpoints de lectura con paginación de rutas, orden curricular y versiones.
- Visibilidad de lecciones condicionada por la publicación de toda su jerarquía y sus prerrequisitos anteriores dentro de la misma ruta.
- Pruebas de migración, contrato, contenido oculto, orden y paginación.
- Documentación de modelo, API, seguridad y decisión arquitectónica.

## Fuera de alcance

Contenido educativo publicado, interfaz de catálogo, editor, ejercicios, evaluación, progreso y administración. Tampoco se crean endpoints públicos para escribir contenido.

## Archivos afectados

`backend/app/curriculum/`, `backend/alembic/versions/0003_curriculum.py`, `backend/alembic/env.py`, `backend/app/main.py`, `backend/tests/test_curriculum.py`, `README.md` y documentación en `docs/`.

## Criterios de aceptación

- [x] Migración crea las cuatro tablas sin alterar datos existentes.
- [x] Identificadores, posiciones, niveles, estados y versiones tienen restricciones apropiadas.
- [x] El catálogo público lista solo rutas publicadas y pagina sus resultados.
- [x] Los detalles conservan el orden de módulos y lecciones.
- [x] Borradores y lecciones con prerrequisitos no publicados o posteriores no se exponen.
- [x] Una instalación sin contenidos devuelve un catálogo vacío, sin inventar lecciones.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `uv run pytest -q`: 19 pruebas correctas, incluida la suite anterior.
- `uv run ruff check .` y `uv run ruff format --check .`: correctos.
- Las pruebas nuevas migran SQLite temporal y comprueban rutas, módulos, lecciones, paginación, borradores y prerrequisitos.
- `uv run alembic check` después de migrar una SQLite temporal: no detectó operaciones pendientes.
- `uv run alembic upgrade head --sql` con dialecto PostgreSQL: generó SQL para las cuatro tablas, sin conexión a un servidor.
- PostgreSQL real y publicación editorial no comprobados.

## Seguridad y riesgos

La API es de solo lectura, no acepta código del usuario y no ofrece contenido en borrador. Los identificadores ocultos responden `404`. La validación previa a la publicación y el renderizado seguro de Markdown quedan pendientes. La lista JSON de objetivos depende del futuro flujo editorial para su validación semántica. La consulta de visibilidad recorre las lecciones publicadas de una ruta; medir su costo cuando haya contenido real.

## Checklist

- [x] Alcance implementado y pruebas automatizadas ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos expuestos.
- [x] Sin cambios fuera de alcance.
- [ ] Revisión y aprobación.

## Conocimientos aplicados

Claves primarias y foráneas, restricciones e índices SQL, migraciones Alembic, consultas SQLAlchemy, modelos de respuesta Pydantic y filtrado de grafos de prerrequisitos. Actividad sugerida: agrega en el test una lección que dependa de otra de un módulo posterior y predice por qué la API debe ocultarla.

## Acciones Git

Rama local `feat/pr-005-curriculum`; sin commit, push ni PR remoto por parte del agente.
