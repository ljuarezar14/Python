# ADR-0009 — Contenido curricular en archivos del repositorio

Estado: aceptado. Implementado en PR-010b.

## Contexto

Las tablas del currículo existen desde PR-005, pero no había forma de llenarlas con contenido revisado. `seed_dev` solo carga datos de prueba y se niega a ejecutarse en producción, y la administración está prevista para PR-012. El contenido debe pasar una revisión pedagógica antes de publicarse, y cada ejercicio necesita pruebas que de verdad se puedan superar.

## Decisión

El contenido vive en archivos TOML dentro de `backend/content/`:

- `content/<ruta>/ruta.toml`: la ruta y sus módulos.
- `content/<ruta>/lecciones/<lección>.toml`: una lección con su texto Markdown y sus ejercicios. El nombre del archivo es el id de la lección.

TOML forma parte de la biblioteca estándar de Python (`tomllib`) y permite escribir Markdown y código en cadenas multilínea sin escapes. Cada cambio se revisa en un PR como el código: **la revisión pedagógica es la aprobación del PR**.

`uv run python -m app.curriculum.content` valida y carga los archivos:

- **Validación:** campos desconocidos rechazados, identificadores y posiciones únicos, módulos de la misma ruta, prerrequisitos anteriores en la misma ruta y pruebas según ADR-0007. `--check` solo valida.
- **Una sola transacción:** cualquier error deja la base como estaba.
- **Idempotente:** ejecutarlo de nuevo no cambia nada.
- **Versiones explícitas:** si un registro cambia, su `version` debe subir; con la misma versión y contenido distinto, o con una versión menor, la carga se rechaza. Así el progreso y los borradores detectan la versión nueva (ADR-0008).
- **Nunca borra.** Para retirar algo se marca `status = "draft"` y se sube la versión. Los registros que no están en los archivos, como los de `seed_dev`, no se tocan.
- Se puede ejecutar en producción: es el mecanismo de publicación hasta que exista la administración.

Cada ejercicio incluye una `solution` de referencia que **no se guarda en la base ni sale por la API**. `npm run check:content`, desde `frontend/`, exporta los ejercicios con `--json` y los ejecuta con el evaluador real (Pyodide en Node): la solución debe pasar todas las pruebas y el código inicial no debe pasarlas. El backend no ejecuta código: las soluciones solo se ejecutan en esa herramienta de desarrollo.

## Consecuencias

- Publicar contenido exige un PR, `npm run check:content` y ejecutar el comando de carga en cada entorno después de migrar.
- Las soluciones son públicas en el repositorio, igual que las pruebas (ADR-0007): la evaluación es formativa.
- Mover lecciones de posición dentro de un módulo puede chocar con la restricción de posición única durante la carga; el comando lo informa sin cambiar nada y habrá que hacerlo en dos pasos.
- Cuando llegue la administración (PR-012), habrá que decidir si los archivos siguen siendo la fuente o se exportan desde ella.
