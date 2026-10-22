# Modelo de datos: identidad y preferencias

PR-003 crea dos tablas mediante la migración `0001_identity`.

| Tabla | Campos principales | Restricciones |
| --- | --- | --- |
| `users` | `id` UUID textual, `email`, `password_hash`, `role`, `created_at` | Correo único normalizado en minúsculas; `role` limitado a `student` o `admin` |
| `auth_sessions` | `id` UUID textual, `user_id`, `token_hash`, `expires_at`, `created_at` | Clave foránea a `users` con eliminación en cascada; hash de token único |

El registro siempre asigna `student`. No existe una API para elevar privilegios. El navegador recibe el token opaco en una cookie HttpOnly; la base solo conserva SHA-256 del token aleatorio. La consulta de sesión exige que exista y no haya vencido. El cierre de sesión elimina el registro; las sesiones vencidas se purgan cuando se crea otra sesión.

PR-004 añade `user_profiles` mediante la migración `0002_user_profiles`. `user_id` es clave primaria y foránea a `users`, por lo que cada usuario tiene como máximo un perfil editable. Guarda `goal`, `experience`, `weekly_minutes`, `interests`, `example_context`, `known_topics` y `updated_at`. El objetivo, experiencia, tiempo y contexto tienen restricciones en la base; las listas JSON se validan en la API. La recomendación se calcula al consultar y no se almacena como dato duplicado.

PR-013a añade `rate_limit_counters` mediante la migración `0006_rate_limit_counters`: `key_hash` (SHA-256 de ámbito y clave, nunca la IP en claro), `window_start` y `hits`, con clave primaria compuesta, `hits > 0` e índice por ventana. Comparte el límite de intentos entre procesos (ADR-0010). `python -m app.identity.cleanup` borra las sesiones vencidas y los contadores de más de un día.

La eliminación en cascada de `user_profiles` y `auth_sessions` se aplica también en SQLite mediante `PRAGMA foreign_keys=ON`. La eliminación de cuenta, recuperación de contraseña y verificación de correo requieren flujos propios antes de añadir más tablas.

## Currículo

PR-005 añade `learning_paths`, `learning_modules`, `learning_lessons` y `lesson_prerequisites` mediante `0003_curriculum`. Las rutas tienen un identificador estable, título, descripción, estado y versión. Los módulos pertenecen a una ruta y tienen posición única dentro de ella, nivel, objetivos, estado y versión. Las lecciones pertenecen a un módulo y tienen posición única, resumen, objetivos, contenido Markdown, estado y versión. Los prerrequisitos enlazan dos lecciones por sus identificadores estables y no permiten una relación consigo misma.

Las claves foráneas garantizan pertenencia y existencia; la API restringe la visibilidad a contenido publicado con prerrequisitos publicados y anteriores en la misma ruta. Una ruta puede contener módulos de distintos niveles. Las listas de objetivos JSON se validarán en el futuro flujo editorial antes de publicarse. Las eliminaciones en cascada de rutas y módulos pueden requerir resolver antes las referencias de prerrequisito: una lección usada como prerrequisito no puede borrarse silenciosamente.

## Ejercicios

PR-008a añade `learning_exercises` mediante `0004_exercises`. Cada ejercicio pertenece a una lección (clave foránea con eliminación en cascada) y tiene identificador estable, posición única y positiva dentro de la lección, título, `prompt_markdown`, `starter_code`, `checks` JSON, estado `draft` o `published` y versión positiva. La base no valida la forma de `checks`; lo hace `validate_checks` en `app/curriculum/exercises.py`, y la API oculta los ejercicios cuyas pruebas no cumplen el contrato.

## Progreso

PR-009a añade `exercise_progress` mediante `0005_exercise_progress`. La clave primaria es (`user_id`, `exercise_id`): cada persona tiene como máximo una fila por ejercicio, que se reemplaza en cada intento. Ambas columnas son claves foráneas con eliminación en cascada hacia `users` y `learning_exercises`.

Guarda `exercise_version`, `code`, `last_status` (`passed`, `failed` o `timeout`), `passed_count`, `total_count`, `attempts`, `solved_version`, `solved_at`, `created_at` y `updated_at`. La base exige estados válidos, versión e intentos positivos y `0 ≤ passed_count ≤ total_count`, con `total_count` mayor que cero; la API comprueba además la coherencia con el ejercicio. Un ejercicio está resuelto mientras `solved_version` sea igual a su versión actual. No se guarda el historial de intentos ([ADR-0008](decisions/0008-self-reported-progress.md)).
