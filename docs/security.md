# Seguridad de identidad en PR-003

- Las contraseñas se verifican con Argon2id mediante `pwdlib`. Se exige entre 12 y 128 caracteres. Un hash señuelo reduce diferencias de tiempo entre correos existentes e inexistentes durante el acceso.
- Cada sesión usa un token aleatorio opaco. Solo su hash SHA-256 se conserva en la base de datos. Caduca a los siete días y se revoca al cerrar sesión.
- La cookie es HttpOnly, SameSite Lax y usa `Secure` cuando `PYRAIZ_COOKIE_SECURE=true`. En producción se exige esta opción mediante `PYRAIZ_ENV=production`; el sitio debe publicarse por HTTPS.
- CORS permite los orígenes configurados. Los POST de identidad comprueban `Origin` contra `PYRAIZ_CORS_ORIGINS` y `PYRAIZ_API_ORIGIN`, sin confiar en el encabezado `Host`. Los próximos endpoints que modifiquen datos deberán aplicar la misma política o un mecanismo CSRF más fuerte antes de publicarse.
- Un límite de 10 intentos por minuto y dirección IP protege registro y acceso en un solo proceso. Antes de usar varios procesos o publicar el servicio se necesita un límite compartido en el proxy o servicio de entrada. No se confía en `X-Forwarded-For` proporcionado por el cliente.
- Las sesiones vencidas se purgan al crear otra sesión. En operación prolongada deberá añadirse una limpieza programada y supervisada.

No se han implementado recuperación de contraseña, verificación de correo, eliminación de cuenta ni herramientas administrativas. La autenticación no equivale a autorización de contenido: cada futura ruta protegida debe comprobar al usuario y, cuando corresponda, el rol en el servidor. La integración con PostgreSQL y la configuración HTTPS requieren pruebas antes de desplegar.

PR-004 exige sesión en lectura y escritura del perfil. La API toma `user_id` de la sesión, nunca del cuerpo enviado por el navegador; así cada persona solo consulta y modifica sus propias preferencias. `PUT /onboarding` también verifica `Origin`. Se guardan únicamente las respuestas necesarias para recomendar un inicio, sin fecha de nacimiento, datos laborales ni texto libre. La recomendación es formativa y no certifica conocimientos.

PR-005 publica únicamente rutas, módulos y lecciones con estado `published`. Las lecturas no requieren sesión y responden `404` tanto para contenido oculto como inexistente. Una lección con prerrequisitos no visibles o fuera de orden no se expone. No hay endpoints de escritura curricular; la futura administración deberá aplicar autorización del lado del servidor y validar la publicación antes de habilitarla. El Markdown se devuelve como texto y no se transforma en HTML; cualquier renderizador futuro deberá evitar XSS. No se guardan pruebas privadas de evaluación en estas tablas.

PR-006 conserva el borrador del editor en el almacenamiento local del navegador, sin enviarlo a la API. En un equipo compartido, otras personas con acceso al mismo navegador podrían verlo; la interfaz advierte que no se escriban secretos y permite restablecer el ejemplo. El límite de tamaño evita guardar borradores excesivos. El editor no ejecuta código en el frontend ni en el backend. Antes de PR-007 se revisarán el aislamiento y los límites de recursos del motor.

## Ejecución de Python en PR-007

- El código se ejecuta en el navegador de la propia persona con Pyodide dentro de un Web Worker. No se envía al backend ni a terceros; los archivos del motor se sirven desde el mismo origen y su versión está fijada (`pyodide@314.0.7`).
- **El Web Worker no es una sandbox de seguridad.** Comparte el origen de la página. Tras cargar el motor se sombrean en el worker las APIs de red, almacenamiento y creación de workers (`fetch`, `XMLHttpRequest`, `WebSocket`, `WebTransport`, `EventSource`, `importScripts`, `indexedDB`, `caches`, `Worker`, `SharedWorker`, `BroadcastChannel`) y se retiran los módulos `js` y `pyodide_js`. En Chrome se comprobó que esas APIs quedan como `undefined` dentro del worker y que `import js` e `import pyodide_js` fallan. Pyodide conserva otras vías internas entre Python y JavaScript (`pyodide.ffi`, `_pyodide_core`), así que estas medidas reducen la superficie, pero no impiden que un código decidido alcance JavaScript del worker.
- El worker no tiene acceso al DOM, a `localStorage` ni a la cookie de sesión, que es HttpOnly. Los mensajes que envía al hilo principal se validan por forma e identificador de ejecución; un programa podría falsificar su propio resultado, por eso el resultado del navegador **no** es evidencia confiable para acreditaciones o certificados.
- Límites: 100 000 caracteres de código, 20 000 de salida (se recorta en el worker y otra vez en el hilo principal), 10 s por ejecución y 60 s de carga. Cancelar o agotar el tiempo termina el worker. **No hay límite de memoria**: un programa puede reservar memoria hasta que el navegador cierre la pestaña. Las ejecuciones se miden en tiempo real, no en CPU.
- La salida y el traceback se muestran como texto con React, sin interpretar HTML.
- Riesgo de ingeniería social: alguien puede pedir a una persona que pegue y ejecute un programa. Su alcance queda en el worker descrito arriba, dentro del navegador de esa persona.
- Una futura política CSP deberá permitir `'wasm-unsafe-eval'` y `worker-src 'self'`. Cualquier evaluación de alta integridad requerirá un evaluador en el servidor con aislamiento por proceso y su propio análisis de amenazas; queda fuera de este PR.

## Ejercicios en PR-008a

- `GET /curriculum/exercises/{id}` es de solo lectura, no requiere sesión y solo expone ejercicios publicados de lecciones visibles. Borradores, pruebas mal formadas e identificadores inexistentes responden igual (`404`).
- **Las pruebas de cada ejercicio son públicas.** Se envían al navegador porque allí se evalúan; cualquiera puede leer las respuestas esperadas. La evaluación es formativa y no sirve como evidencia para acreditar.
- `validate_checks` limita el número y el tamaño de las pruebas, rechaza campos desconocidos y exige nombres de función válidos. Los argumentos son datos JSON, no código; el backend nunca ejecuta el código del estudiante ni las pruebas.
- `seed_dev` inserta datos publicados de prueba y se niega a ejecutarse con `PYRAIZ_ENV=production`. Aun así, no debe ejecutarse contra una base compartida: sus registros aparecerían en el catálogo público.

## Evaluación de ejercicios en PR-008b

- La evaluación ocurre en el mismo Web Worker de PR-007, con sus límites y su advertencia: **no es una sandbox**. El backend no ejecuta código ni recibe resultados.
- Un programa puede falsificar su resultado (por ejemplo, alcanzando JavaScript del worker por vías internas de Pyodide o modificando la página). Por eso los resultados son formativos, no se guardan en este PR y no deben usarse para acreditar. El progreso de PR-009 deberá tratarlos como autodeclarados.
- El hilo principal valida la forma de cada mensaje del worker y acepta solo resultados de pruebas solicitadas, una vez cada una. Los datos del ejercicio que llegan de la API también se validan antes de usarse.
- La petición a la API se hace con `credentials: "omit"`: leer un ejercicio público no envía la cookie de sesión.
- El enunciado se interpreta con un subconjunto mínimo de Markdown que produce elementos de React; el HTML incluido en el texto se muestra literalmente. Salida, valores esperados y tracebacks se muestran como texto.
- El borrador de cada ejercicio se guarda solo en el navegador, con la misma advertencia para equipos compartidos que la práctica libre.

## Progreso en PR-009a

- **El progreso es autodeclarado.** El navegador envía el resultado y nada impide una petición con un `passed` falso. La API solo rechaza datos incoherentes: versión distinta, número de pruebas que no coincide o estado que contradice los números. No debe usarse para acreditar, premiar ni comparar personas ([ADR-0008](decisions/0008-self-reported-progress.md)).
- Las tres rutas exigen sesión. La persona se obtiene siempre de la cookie, nunca del cuerpo ni de la URL, y las consultas filtran por ella. Guardar exige además un `Origin` autorizado, como el resto de escrituras con cookie.
- El backend guarda el código como texto y **nunca lo ejecuta**. Se limita a 100 000 caracteres, y los guardados a 30 por minuto y persona, con el mismo limitador por proceso que el acceso (no compartido entre procesos).
- El código guardado es dato personal: solo lo devuelve `GET /progress/exercises/{id}` a su autor, no aparece en el resumen y se borra en cascada con la cuenta o el ejercicio. No hay todavía flujo de eliminación de cuenta ni exportación de datos; ambos deberán incluir esta tabla.
- Si un ejercicio deja de ser visible, su progreso se conserva pero no se expone hasta que vuelva a serlo.
