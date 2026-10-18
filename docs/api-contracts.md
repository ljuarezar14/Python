# Contratos HTTP actuales

Todos los endpoints están bajo `/api/v1`. Los errores usan el campo `detail` de FastAPI. Las solicitudes POST de identidad requieren un encabezado `Origin` autorizado. Las cookies se envían desde el frontend con `credentials: "include"`.

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /health` | Ninguna | `200 {"status":"ok"}` |
| `POST /auth/register` | JSON `email`, `password` (12–128 caracteres) | `201` usuario público y cookie de sesión |
| `POST /auth/login` | JSON `email`, `password` | `200` usuario público y cookie de sesión |
| `GET /auth/me` | Cookie de sesión | `200` usuario público o `401` |
| `POST /auth/logout` | Cookie opcional | `204`; revoca la sesión y borra la cookie |

El usuario público contiene `id`, `email` y `role`. Nunca contiene el hash de contraseña ni el token de sesión. El registro devuelve `409` si no puede crear una cuenta con ese correo. El acceso devuelve `401` para credenciales incorrectas, sin distinguir correo inexistente de contraseña errónea. `403` indica origen no permitido; `429`, exceso de intentos; `422`, entrada inválida.
