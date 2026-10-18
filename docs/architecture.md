# Arquitectura inicial

Estado: PR-003 incorpora identidad y sesiones. Los módulos de aprendizaje se incorporarán cuando existan casos de uso comprobables.

```mermaid
flowchart LR
  U[Usuario] --> F[Next.js]
  F --> API[FastAPI /api/v1]
  F --> EX[Adaptador de ejecución futuro]
  EX --> PY[Pyodide en Web Worker futuro]
  API --> DB[(SQLite local / PostgreSQL configurable)]
```

## Límites actuales

`frontend/` sirve la página inicial y los formularios de identidad. `backend/` publica salud, registro, acceso, cierre de sesión y consulta de la cuenta. La identidad persiste mediante SQLAlchemy y una migración Alembic. SQLite permite desarrollo local; el URL de PostgreSQL es configurable pero aún no tiene una prueba de integración. No hay ejecución de código del estudiante.

## Dirección de las dependencias

La interfaz llama contratos HTTP versionados. Los casos de uso futuros contendrán reglas y dependerán de interfaces de persistencia cuando aporten valor. La infraestructura implementará esas interfaces. No se crearán capas o módulos vacíos antes de necesitarlos.

## Modelo y contratos previstos

Identidad: `User` y `AuthSession` ya están migrados. `UserProfile` se añadirá con onboarding. Contenido: `LearningPath`, `Module`, `Lesson` y `Exercise`. Evidencia: `ExerciseAttempt` y `LessonProgress`. Las tablas nuevas se decidirán cuando existan sus flujos. Los detalles de claves y restricciones están en [data-model.md](data-model.md).

Los contratos de salud e identidad usan `/api/v1` y se describen en [api-contracts.md](api-contracts.md). Los contratos de contenido y progreso se definirán con sus casos de uso. El contrato de ejecución local incluirá identificador de ejercicio, código, versión y modo; devolverá estado, salida, errores, duración y diagnósticos. Su implementación se decidirá en PR-007.

## Seguridad y operación

El backend no ejecuta código del estudiante. Las contraseñas se guardan con Argon2id y los tokens de sesión se guardan solo como hashes. CORS y la comprobación de origen restringen solicitudes del navegador; la cookie es HttpOnly y SameSite Lax. Los límites y controles pendientes se documentan en [security.md](security.md). El navegador no será fuente confiable para certificados de alta integridad. Antes de un evaluador remoto se requerirá un análisis específico de amenazas.

## Pruebas

PR-003 añade pruebas de integración que ejecutan la migración y recorren registro, acceso, consulta y cierre de sesión. Lint, tipos y build verifican el frontend; la revisión manual del flujo en navegador sigue siendo necesaria.
