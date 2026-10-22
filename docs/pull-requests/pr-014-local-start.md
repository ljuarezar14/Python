# PR-014 — Arranque local con un solo comando

Estado: implementado y comprobado; pendiente de revisión y PR remoto. Depende de PR-013b, ya unido a `main`.

## Objetivo

Por ahora PyRaíz se usará solo en local. Arrancarlo debe ser un único comando que no olvide ningún paso (migraciones y contenido incluidos), para el desarrollo diario y para un piloto en esta computadora.

## Alcance

- `scripts/local.mjs`, solo con Node.js, sin dependencias nuevas:
  1. Comprueba que la web tenga sus dependencias instaladas y que los puertos 8000 y 3000 estén libres.
  2. Aplica las migraciones y carga las lecciones; si un paso falla, se detiene y lo dice.
  3. Inicia la API y la web, con la salida de cada una marcada como `[api]` y `[web]`.
  4. Espera a que las dos respondan y muestra **PyRaíz listo**.
  5. Ctrl+C apaga las dos. Si una se cae, apaga la otra. En Windows usa `taskkill /T` para cerrar el árbol completo de procesos.
- `--production`: compila la web y la sirve con `next start`, con la CSP de producción. La API sigue en modo desarrollo con SQLite.
- `scripts/local.test.mjs`: 4 pruebas de los pasos y comandos de cada modo.
- **Documentación:** README (inicio en un paso y comprobaciones), roadmap y `deployment.md`, que avisa de que un despliegue futuro necesitará dominio propio para la cookie de sesión.

## Fuera de alcance

- Proveedor, dominio, HTTPS, PostgreSQL gestionado, copias de seguridad y supervisión: cuando se decida publicar en internet.
- Acceso desde otros dispositivos de la red local: la configuración actual (CORS, cookie, CSP) solo admite `localhost`.

## Criterios de aceptación

- [x] Un comando migra, carga el contenido y deja la API y la web funcionando.
- [x] Repetirlo no duplica contenido.
- [x] Si un servicio se cae, el otro también se apaga y no quedan procesos ni puertos ocupados.
- [x] Un puerto ocupado o una opción desconocida se explican sin arrancar nada.
- [x] El modo `--production` sirve la web compilada con la CSP de producción.
- [ ] Ctrl+C comprobado en la terminal del responsable.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

Con una base SQLite temporal, para no tocar `backend/pyraiz.db`:

- `node --test scripts/local.test.mjs`: **4 correctas**.
- **Desarrollo:** migraciones aplicadas, 23 elementos de contenido nuevos, API y web listas; `/api/v1/curriculum/paths` devuelve «Python desde cero» y `/aprender` responde `200`.
- **Producción:** la segunda carga da «sin cambios: 23»; el build termina; `/aprender` lleva la CSP con nonce y HSTS.
- **Apagado en cadena:** al matar el proceso de Python de la API, el script apagó la web; no quedaron procesos de `node`, `uv` ni `python` del proyecto, ni puertos en escucha.
- **Navegador (Chrome) sobre lo que arranca el script en desarrollo:**
  - Python se ejecuta, y el registro y el guardado de un ejercicio funcionan.
  - axe-core encuentra 0 problemas en 11 páginas, y hay 0 violaciones de CSP.
  - Las únicas diferencias con producción son las esperadas: `'unsafe-eval'` en la política y sin HSTS.
- **Solo en local:** la web escucha en `::1:3000` y la API en `127.0.0.1:8000`.
- **Puerto ocupado:** con el 8000 en uso, el script lo explica y sale con código 1.
- **Opción desconocida** (`--prod`): mensaje claro y código 1.
- **No comprobado:** Ctrl+C real, porque desde las herramientas no se puede enviar a la consola; macOS y Linux.
- **Caso límite observado:** si se mata a mano solo el proceso intermedio de recarga de uvicorn (modo desarrollo), su worker queda huérfano fuera del árbol y el script no puede cerrarlo. Para liberar el puerto hay que cerrar ese proceso de Python a mano. Con Ctrl+C o un fallo normal no ocurre.

## Seguridad y riesgos

- Las órdenes que lanza el script son fijas; no incluyen texto de la persona usuaria.
- La API escucha solo en `127.0.0.1` y la web solo en `localhost` (`--hostname localhost`; sin él, `next dev` también escuchaba en la red local). Ninguna es accesible desde otros equipos.
- Sin cambios en la API ni en la web.

## Acciones Git

Rama `feat/pr-014-local-start`. El responsable hace los pasos de Git (commit, push, PR y merge).
