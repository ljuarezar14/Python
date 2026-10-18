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
