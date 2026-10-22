# Seguridad de identidad en PR-003

- Las contraseñas se verifican con Argon2id mediante `pwdlib`. Se exige entre 12 y 128 caracteres. Un hash señuelo reduce diferencias de tiempo entre correos existentes e inexistentes durante el acceso.
- Cada sesión usa un token aleatorio opaco. Solo su hash SHA-256 se conserva en la base de datos. Caduca a los siete días y se revoca al cerrar sesión.
- La cookie es HttpOnly, SameSite Lax y usa `Secure` cuando `PYRAIZ_COOKIE_SECURE=true`. En producción se exige esta opción mediante `PYRAIZ_ENV=production`; el sitio debe publicarse por HTTPS.
- CORS permite los orígenes configurados. Los POST de identidad comprueban `Origin` contra `PYRAIZ_CORS_ORIGINS` y `PYRAIZ_API_ORIGIN`, sin confiar en el encabezado `Host`. Los próximos endpoints que modifiquen datos deberán aplicar la misma política o un mecanismo CSRF más fuerte antes de publicarse.
- Un límite de 10 intentos por minuto y dirección IP protege registro y acceso. Desde PR-013a se guarda en la base y lo comparten todos los procesos (ADR-0010). `X-Forwarded-For` solo se acepta del proxy propio, configurado con `--forwarded-allow-ips` ([deployment.md](deployment.md)).
- Las sesiones vencidas se purgan al crear otra sesión y con `python -m app.identity.cleanup`, que debe programarse a diario en producción.

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
- La CSP de PR-013b permite `'wasm-unsafe-eval'` solo en el worker y `worker-src 'self'` en las páginas. Cualquier evaluación de alta integridad requerirá un evaluador en el servidor con aislamiento por proceso y su propio análisis de amenazas; queda fuera de este PR.

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

## Progreso en la interfaz (PR-009b)

- Las peticiones de progreso usan `credentials: "include"` para enviar la cookie de sesión; la de ejercicios sigue con `credentials: "omit"`. Las respuestas se validan antes de usarse y los mensajes de error de la API no se muestran tal cual, salvo el texto del límite de guardados.
- El código guardado se muestra en el editor como texto y no se ejecuta hasta que la persona pulsa **Comprobar**. Antes de reemplazar un borrador con cambios propios se pide confirmación.
- La página sigue funcionando sin sesión y sin API de progreso; solo deja de guardar.

## Pantallas del catálogo (PR-010a)

- Las lecturas del catálogo usan `credentials: "omit"`: la API curricular es pública y no necesita la cookie. Las respuestas se validan antes de usarse; un nivel de módulo desconocido o un campo con otro tipo se trata como error.
- El Markdown de lecciones y enunciados se convierte en elementos de React a partir de texto, sin `dangerouslySetInnerHTML`. HTML, `<script>`, imágenes y enlaces (incluidos `javascript:`) se muestran como texto. Las pruebas unitarias y la prueba de punta a punta lo comprueban con contenido malicioso.
- Los bloques de código son regiones con foco de teclado para poder desplazarlos; su texto no se ejecuta.
- La lista de ejercicios de una lección consulta el progreso con la cookie solo después de comprobar con la primera consulta que hay sesión.

## Contenido en archivos (PR-010b)

- El contenido se publica con `python -m app.curriculum.content` desde archivos revisados en un PR. No hay endpoints de escritura: quien ejecuta el comando necesita acceso al servidor y a su base.
- La carga valida todo antes de escribir y usa una sola transacción; nunca borra registros, así que el progreso guardado no se pierde por un cambio de contenido.
- Las soluciones de referencia no se guardan en la base ni salen por la API. Se ejecutan solo en `npm run check:content`, una herramienta de desarrollo en Node; **el backend no ejecuta código**.
- Las soluciones y las pruebas son públicas en el repositorio. Como indica ADR-0007, la evaluación es formativa y no acredita.

## Backend en producción (PR-013a)

- Con `PYRAIZ_ENV=production`, la API se niega a arrancar si la cookie no es `Secure`, la base es SQLite, algún origen permitido no es `https://` (o es `*`) o el origen de la API no es `https://`.
- Cabeceras en todas las respuestas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. En producción, además, `Strict-Transport-Security: max-age=31536000`.
- `Cache-Control: no-store` en identidad, onboarding y progreso, para que ningún navegador ni proxy guarde datos personales.
- `/docs`, `/redoc` y `/openapi.json` se desactivan en producción.
- El límite de intentos se comparte entre procesos y guarda solo hashes de las claves (ADR-0010).
- Las pruebas con PostgreSQL real cubren migraciones, el recorrido de una persona, el límite compartido y la limpieza. Se ejecutan con `uv run --group postgres pytest tests/test_postgres.py`.
- **Pendiente:** el proveedor con HTTPS, copias de seguridad y supervisión (PR-014), y la recuperación de contraseña, que queda fuera del piloto.

## Frontend en producción (PR-013b)

- **CSP con nonce por petición** ([ADR-0011](decisions/0011-frontend-csp-nonces.md)): solo se ejecutan los scripts de Next.js que llevan el nonce. Sin `'unsafe-inline'` para scripts y sin `'unsafe-eval'` en producción. `connect-src` admite solo el propio sitio y la API; `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`.
- Los estilos en línea sí se permiten (CodeMirror y React los necesitan); no ejecutan código.
- El worker de Python y los archivos de Pyodide llevan su propia política: WebAssembly (`'wasm-unsafe-eval'`) y conexiones al mismo origen, nada más. **Sigue sin ser una sandbox:** es una capa más sobre el sombreado de APIs de PR-007.
- En todas las respuestas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin` y `Permissions-Policy`, que desactiva cámara, micrófono, ubicación, pagos y USB. En la compilación de producción, HSTS. Sin `X-Powered-By`.
- Accesibilidad: auditoría con axe-core (WCAG 2.2 A y AA y buenas prácticas) en 11 páginas. Se corrigieron dos problemas: el contraste de tres colores del resaltado de código y los nombres repetidos de los bloques de código de una lección.
- `npm audit` avisa de `braces` (alta), sin versión corregida publicada. Llega solo por las herramientas de lint (`eslint-config-next`) y no forma parte de lo que se publica: `npm audit --omit=dev` no encuentra vulnerabilidades.
