# PR-013b — Frontend listo para producción

Estado: implementado y comprobado; pendiente de revisión y PR remoto. Depende de PR-013a, ya unido a `main`.

## Objetivo

Que el frontend se pueda publicar con una política de seguridad de contenido (CSP) estricta que no rompa Python en el navegador, y revisar su accesibilidad.

## Alcance

- **CSP con nonce** ([ADR-0011](../decisions/0011-frontend-csp-nonces.md)):
  - `src/proxy.ts` genera un nonce por petición y aplica la política a las páginas.
  - `src/app/layout.tsx` llama a `connection()` para que todas las páginas se rendericen en cada petición y Next.js pueda poner el nonce.
  - `src/lib/security-headers.ts` construye las políticas y cabeceras; `security-headers.test.ts` las prueba (5 pruebas).
- **Política del worker:** `next.config.ts` aplica a `/execution/` y `/pyodide/` `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`.
- **Cabeceras en todas las respuestas:** `nosniff`, `DENY`, `strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` y, en producción, HSTS. Se quita `X-Powered-By`.
- **Accesibilidad** (auditoría con axe-core, sin añadirlo al proyecto):
  - El editor usa un resaltado propio: los colores por defecto de CodeMirror, salvo tres que no llegaban a 4,5:1 de contraste. Por eso `@codemirror/language` y `@lezer/highlight`, que ya estaban instalados como dependencias indirectas, pasan a ser directas.
  - Los bloques de código de una lección se nombran «Ejemplo de código Python 1 de 3», etc., para que los lectores de pantalla los distingan.
- `.gitignore`: `frontend/AGENTS.md`, que `next dev` genera solo.
- **Documentación:** ADR-0011 (nueva), seguridad, despliegue, arquitectura, roadmap y ADR-0006.

## Fuera de alcance

- Proveedor, dominio, HTTPS, copias de seguridad y supervisión (PR-014).
- Pruebas con lectores de pantalla reales, Firefox, Safari y dispositivos móviles físicos.

## Criterios de aceptación

- [x] Las páginas llevan una CSP sin `'unsafe-inline'` ni `'unsafe-eval'` para scripts en producción, con un nonce distinto en cada petición.
- [x] Python se ejecuta y los ejercicios se comprueban y guardan con la CSP activa, sin violaciones.
- [x] El worker y Pyodide tienen su propia política, más estrecha.
- [x] axe-core no encuentra problemas en las 11 páginas revisadas.
- [x] `npm run dev` sigue funcionando.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- **Frontend:** `npm test` da **66 correctas** (61 anteriores y 5 nuevas). `lint`, `typecheck` y `build` correctos; el build marca todas las páginas como dinámicas (ƒ).
- **Navegador, compilación de producción** contra la API de PR-013a, en Chrome y en Edge: **26 de 26 comprobaciones** en cada uno.
  - Cabeceras: CSP con nonce y sin `'unsafe-inline'` en scripts; nonce distinto en cada petición; los 11 scripts del HTML llevan nonce; `connect-src` con la API; las demás cabeceras y HSTS; sin `X-Powered-By`; la política del worker en `/execution/` y `/pyodide/`.
  - Funcionamiento: la práctica libre ejecuta Python; el registro desde la página funciona; un ejercicio se comprueba y se guarda.
  - **0 violaciones de CSP** registradas por el navegador y 0 errores en la consola.
  - axe-core 4.10.3 (WCAG 2.0, 2.1 y 2.2 A y AA y buenas prácticas): **0 problemas** en inicio, aprender, ruta, módulo, lección, práctica libre, ejercicio, onboarding, cuenta, ingresar y registro. Antes de las correcciones encontró 2: contraste del resaltado (3,65:1) y regiones de código con el mismo nombre.
- **Regresión:** el recorrido de la primera lección de PR-010b, con la CSP activa: 15 de 15 en Chrome, móvil incluido.
- **Desarrollo** (`next dev`): las mismas comprobaciones funcionan. Las únicas diferencias son las esperadas: `'unsafe-eval'` en la política y sin HSTS.
- **`npm audit`:** 5 avisos altos de `braces`, sin versión corregida, que llegan solo por `eslint-config-next`. `npm audit --omit=dev`: 0.
- **No comprobado:** Firefox, Safari, móviles físicos, lectores de pantalla reales y el sitio detrás de un proxy o CDN real.

## Seguridad y riesgos

- **Todas las páginas se generan en cada petición.** Más carga en el servidor, aceptable para el piloto (ADR-0011).
- **El worker sigue sin ser una sandbox.** La política nueva añade una capa, pero comparte el origen de la página.
- **Si el proveedor reescribe cabeceras,** podría quitar la CSP. Se comprobará en PR-014 con `curl -I`.

## Acciones Git

Rama `feat/pr-013b-frontend-production`. El responsable hace los pasos de Git (commit, push, PR y merge).
