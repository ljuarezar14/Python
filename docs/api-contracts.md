# Contratos HTTP actuales

Todos los endpoints están bajo `/api/v1`. Los errores usan el campo `detail` de FastAPI. Las solicitudes POST de identidad requieren un encabezado `Origin` autorizado. Las cookies se envían desde el frontend con `credentials: "include"`.

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /health` | Ninguna | `200 {"status":"ok"}` |
| `POST /auth/register` | JSON `email`, `password` (12–128 caracteres) | `201` usuario público y cookie de sesión |
| `POST /auth/login` | JSON `email`, `password` | `200` usuario público y cookie de sesión |
| `GET /auth/me` | Cookie de sesión | `200` usuario público o `401` |
| `POST /auth/logout` | Cookie opcional | `204`; revoca la sesión y borra la cookie |
| `GET /onboarding` | Cookie de sesión | `200` respuestas y recomendación; `404` si aún no hay perfil; `401` sin sesión |
| `PUT /onboarding` | Cookie, `Origin` autorizado y JSON de respuestas | `200` respuestas guardadas y recomendación; crea o actualiza el perfil |

El usuario público contiene `id`, `email` y `role`. Nunca contiene el hash de contraseña ni el token de sesión. El registro devuelve `409` si no puede crear una cuenta con ese correo. El acceso devuelve `401` para credenciales incorrectas, sin distinguir correo inexistente de contraseña errónea. `403` indica origen no permitido; `429`, exceso de intentos; `422`, entrada inválida.

El cuerpo de `PUT /onboarding` contiene `goal` (`explore`, `build`, `automate`, `innovate`), `experience` (`none`, `some`, `comfortable`), `weekly_minutes` (15, 30, 60, 120 o 180), `interests` (de uno a tres valores únicos entre `finance`, `education`, `work`, `data`, `environment`, `web`), `example_context` (`daily`, `academic`, `work`, `community`) y `known_topics` (lista opcional de `variables`, `conditionals`, `functions`). El primer interés tiene prioridad para el tema sugerido.

La respuesta añade `recommendation`: `starting_point`, `focus`, `suggested_theme`, `reason`, `weekly_plan`, `example_project` y `rule_version`. La versión actual es 1. `starting_point` es una orientación textual; no enlaza a una lección publicada todavía. El usuario puede volver a enviar `PUT` para cambiar sus preferencias.

## Currículo público

Los endpoints siguientes son de solo lectura y no requieren sesión. Los identificadores son estables; `404` oculta tanto identificadores inexistentes como contenido no publicado. El catálogo estará vacío hasta que se publiquen lecciones revisadas.

| Método y ruta | Resultado |
| --- | --- |
| `GET /curriculum/paths?limit=20&offset=0` | `items`, `total`, `limit`, `offset`; solo rutas publicadas, ordenadas por identificador |
| `GET /curriculum/paths/{path_id}` | Ruta publicada y módulos publicados, ordenados por `position` |
| `GET /curriculum/modules/{module_id}` | Módulo publicado y lecciones visibles, ordenadas por `position` |
| `GET /curriculum/lessons/{lesson_id}` | Lección visible, `prerequisite_ids`, `content_markdown` y `exercises` (resúmenes de ejercicios publicados y válidos, ordenados por `position`) |
| `GET /curriculum/exercises/{exercise_id}` | Ejercicio publicado de una lección visible: `lesson_id`, `position`, `title`, `version`, `prompt_markdown`, `starter_code` y `checks` |

`limit` admite 1–100 y `offset` debe ser no negativo; valores inválidos devuelven `422`. Los resúmenes incluyen `id`, título, descripción o resumen y `version`. El detalle de módulo incluye `level` y `objectives`. Una lección con prerrequisitos no publicados, de otra ruta, posteriores o circulares no se expone. El contenido Markdown es dato, no HTML procesado por la API.

Desde PR-008a, `checks` es una lista de pruebas `output` (`id`, `description`, `stdin`, `expected_stdout`) o `function` (`id`, `description`, `function_name`, `args`, `expected`). Un ejercicio en borrador, con pruebas que no cumplen el contrato o de una lección no visible responde `404` con `Ejercicio no disponible`. Las pruebas son públicas porque se ejecutan en el navegador; las reglas de comparación están en [ADR-0007](decisions/0007-exercise-checks.md).

## Progreso

Desde PR-009a, cada persona con sesión guarda su último intento por ejercicio. Todas las rutas requieren cookie de sesión (`401` sin ella), y solo devuelven o modifican el progreso de esa persona. El resultado lo calcula el navegador y es **autodeclarado** ([ADR-0008](decisions/0008-self-reported-progress.md)).

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| `PUT /progress/exercises/{exercise_id}` | Cookie, `Origin` autorizado y JSON del intento | `200` progreso guardado |
| `GET /progress/exercises/{exercise_id}` | Cookie | `200` último intento; `404` si el ejercicio no es visible o aún no hay intento |
| `GET /progress` | Cookie | `200` `solved_count` e `items`: hasta 50 ejercicios visibles, del más reciente al más antiguo, sin código |

El intento contiene `exercise_version`, `code` (hasta 100 000 caracteres), `status` (`passed`, `failed` o `timeout`), `passed_count` y `total_count`. Se rechaza con:

- `422` si sobran campos, si los números no cuadran con `status` o si `total_count` no coincide con las pruebas del ejercicio.
- `409` si `exercise_version` no es la versión actual del ejercicio.
- `404` si el ejercicio no es visible.
- `429` si se superan 30 guardados por minuto.

La respuesta del progreso de un ejercicio incluye `exercise_id`, `exercise_version`, `current_version`, `outdated`, `code`, `status`, `passed_count`, `total_count`, `attempts`, `solved`, `solved_at` y `updated_at` (fechas ISO 8601 en UTC). Cada elemento del resumen incluye `exercise_id`, `lesson_id`, `title`, `outdated`, `status`, `passed_count`, `total_count`, `solved` y `updated_at`.
