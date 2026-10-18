# Seguridad de identidad en PR-003

- Las contraseñas se verifican con Argon2id mediante `pwdlib`. Se exige entre 12 y 128 caracteres. Un hash señuelo reduce diferencias de tiempo entre correos existentes e inexistentes durante el acceso.
- Cada sesión usa un token aleatorio opaco. Solo su hash SHA-256 se conserva en la base de datos. Caduca a los siete días y se revoca al cerrar sesión.
- La cookie es HttpOnly, SameSite Lax y usa `Secure` cuando `PYRAIZ_COOKIE_SECURE=true`. En producción se exige esta opción mediante `PYRAIZ_ENV=production`; el sitio debe publicarse por HTTPS.
- CORS permite los orígenes configurados. Los POST de identidad comprueban `Origin` contra `PYRAIZ_CORS_ORIGINS` y `PYRAIZ_API_ORIGIN`, sin confiar en el encabezado `Host`. Los próximos endpoints que modifiquen datos deberán aplicar la misma política o un mecanismo CSRF más fuerte antes de publicarse.
- Un límite de 10 intentos por minuto y dirección IP protege registro y acceso en un solo proceso. Antes de usar varios procesos o publicar el servicio se necesita un límite compartido en el proxy o servicio de entrada. No se confía en `X-Forwarded-For` proporcionado por el cliente.
- Las sesiones vencidas se purgan al crear otra sesión. En operación prolongada deberá añadirse una limpieza programada y supervisada.

No se han implementado recuperación de contraseña, verificación de correo, eliminación de cuenta ni herramientas administrativas. La autenticación no equivale a autorización de contenido: cada futura ruta protegida debe comprobar al usuario y, cuando corresponda, el rol en el servidor. La integración con PostgreSQL y la configuración HTTPS requieren pruebas antes de desplegar.

PR-004 exige sesión en lectura y escritura del perfil. La API toma `user_id` de la sesión, nunca del cuerpo enviado por el navegador; así cada persona solo consulta y modifica sus propias preferencias. `PUT /onboarding` también verifica `Origin`. Se guardan únicamente las respuestas necesarias para recomendar un inicio, sin fecha de nacimiento, datos laborales ni texto libre. La recomendación es formativa y no certifica conocimientos.
