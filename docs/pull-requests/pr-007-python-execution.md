# PR-007 — Contrato de ejecución y Pyodide en Web Worker

Estado: implementado localmente; comprobado en Chrome y Edge sin interfaz; pendiente de prueba manual con móvil y lector de pantalla, revisión y PR remoto.

## Objetivo

Ejecutar en el navegador el Python escrito en `/practicar`, con salida, errores comprensibles, cancelación, reinicio y límites prácticos, detrás de un contrato que no dependa del motor.

## Contexto

PR-006 dejó el editor y una consola sin ejecución. ADR-0001 descarta ejecutar código del estudiante en el backend. PR-008 necesitará un resultado estructurado para evaluar ejercicios.

## Alcance

- Contrato versionado `RunRequest` / `RunResult` / `PythonRunner` en `frontend/src/lib/execution/contract.ts`.
- `WorkerPythonRunner`: carga bajo demanda, tiempo límite, cancelación y reinicio terminando el worker, validación de mensajes y límite de salida repetido en el hilo principal.
- Arnés de Pyodide: variables limpias por ejecución, traceback filtrado a `programa.py` con la línea del estudiante, `input()` con mensaje en español, recorte de salida, retiro de los módulos `js` y `pyodide_js`.
- Worker de módulo compilado con `tsconfig.worker.json` y endurecimiento del ámbito global tras la carga.
- Pyodide 314.0.7 fijado y servido desde el mismo origen (`scripts/copy-pyodide.mjs`).
- Botones **Ejecutar**, **Detener** y **Reiniciar Python**, atajo Ctrl/⌘ + Enter, consola con salida real, bloque de error y estado anunciado.
- Primera suite de pruebas del frontend (`npm test`).
- ADR-0006 y actualización de README, arquitectura, seguridad, diseño, mapa de producto y alcance.

## Fuera de alcance

Evaluación de ejercicios y feedback (PR-008), progreso (PR-009), `input()` interactivo, paquetes adicionales o `micropip`, cabeceras COOP/COEP, CSP, límite de memoria y cualquier cambio en el backend.

## Archivos afectados

`frontend/src/lib/execution/` (contrato, arnés, worker, endurecimiento, controlador y cuatro archivos de prueba), `frontend/src/components/practice-workspace.tsx`, `python-code-editor.tsx`, `frontend/src/app/practicar/page.tsx`, `aprender/page.tsx`, `globals.css`, `frontend/scripts/copy-pyodide.mjs`, `frontend/tsconfig.worker.json`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `docs/decisions/0006-pyodide-web-worker.md` y documentación en `docs/`.

## Decisiones de arquitectura

- Contrato propio con estados `success`, `error`, `timeout`, `cancelled`, `rejected` y `engine_error`; la interfaz no importa Pyodide.
- Cancelar o agotar el tiempo termina el worker y prepara otro, en lugar de usar `SharedArrayBuffer`, que exige COOP/COEP.
- Pyodide 314 rechaza workers clásicos y Next.js 16 crea los workers sin `type: "module"`. Ambos hechos se comprobaron en Chrome durante este PR. Por eso el worker se compila aparte con `tsc` a `public/execution/`.
- Pruebas con `node --test` y la eliminación de tipos de Node, sin dependencias nuevas de desarrollo.

Detalles y alternativas en [ADR-0006](../decisions/0006-pyodide-web-worker.md).

## Criterios de aceptación

- [x] `print` aparece en la consola; `SyntaxError`, `IndentationError` y errores de ejecución muestran tipo, mensaje y línea del estudiante.
- [x] Un bucle infinito se corta a los 10 s con estado `timeout` y la siguiente ejecución funciona.
- [x] **Detener** cancela una ejecución en curso; **Reiniciar Python** borra el estado acumulado.
- [x] La salida superior a 20 000 caracteres se recorta y se avisa; el código superior a 100 000 se rechaza sin ejecutarse.
- [x] Si el motor no carga, se informa `engine_error` sin salida inventada (prueba automatizada con worker simulado).
- [x] Controles con nombre accesible, atajo declarado y estado en `role="status"`.
- [x] El backend no cambia ni recibe código.
- [x] Lint, tipos, build, 28 pruebas de frontend y 19 de backend correctas.
- [ ] Recorrido manual con teclado, móvil real y lector de pantalla.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `npm test`: 28 pruebas correctas. Incluyen 11 del arnés con **Pyodide 314.0.7 real en Node**, 13 del controlador con worker simulado, 3 del contrato y 1 del endurecimiento.
- Comprobación de mutaciones: al quitar el filtro del traceback falló la prueba "sin marcos internos"; al quitar la terminación del worker por tiempo límite falló la prueba de timeout. Ambos cambios se revirtieron y la suite volvió a 28/28.
- `npm run lint`, `npm run typecheck`, `npm run build`: correctos. El build ya no emite el worker por medio de Turbopack.
- Servidor de producción local: `/practicar` y `/aprender` respondieron HTTP 200. Los archivos de `/pyodide/` se sirvieron con el tipo correcto; la wasm como `application/wasm`. Transferencia con gzip: wasm 3,6 MB y biblioteca estándar 2,5 MB.
- Prueba de humo en **Chrome y Edge sin interfaz**, controlados por DevTools Protocol desde un script fuera del repositorio. En ambos:
  - El ejemplo muestra `Total: S/ 35`. La primera ejecución, con carga del motor, tardó unos 6,4 s en local.
  - Ctrl+Enter ejecuta; con `NameError` se ve la salida previa y se informa la línea 2.
  - El bucle infinito se cortó a unos 10,2 s y la ejecución siguiente funcionó tras recargar el motor (entre 2,2 y 3,5 s).
  - `import pyodide_js` dio `ModuleNotFoundError`, y la salida grande quedó recortada en exactamente 20 000 caracteres.
  - **Detener** canceló un bucle en curso.
  - Una marca en `sys` persistió entre ejecuciones y desapareció tras **Reiniciar Python**.
  - Dentro del worker, `fetch`, `XMLHttpRequest`, `WebSocket` e `indexedDB` valían `undefined`. No hubo excepciones en la consola.
- Contraste calculado del nuevo token `--code-error`: 9,52:1 en modo claro y 10,92:1 en oscuro.
- `uv run pytest -q`: 19 correctas. En este equipo requiere `--basetemp` y `-p no:cacheprovider` porque pytest no tiene permiso en su carpeta temporal predeterminada; es un problema del entorno y no del código. `uv run ruff check .`: correcto.
- `npm audit --omit=dev`: 0 vulnerabilidades. `npm audit`: los mismos 5 avisos altos de `braces` en herramientas de desarrollo ya documentados en PR-002.
- No comprobado: Firefox, Safari, móviles reales, lectores de pantalla y conexiones lentas.

## Seguridad y riesgos

El Web Worker **no es una sandbox**. Comparte el origen de la página. Las APIs de red y almacenamiento se sombrean y se retiran `js` y `pyodide_js`, pero Pyodide mantiene otras vías hacia JavaScript (`pyodide.ffi`, `_pyodide_core`, verificadas como importables). El código corre solo en el navegador de la persona y nunca llega al backend. No hay límite de memoria: un programa puede cerrar la pestaña. El resultado del navegador puede falsificarse y no sirve como evidencia de alta integridad. La salida se muestra como texto, sin HTML. Una futura CSP necesitará `'wasm-unsafe-eval'` y `worker-src 'self'`. La primera ejecución descarga unos 6,4 MB, lo que puede costar en datos móviles; por eso el motor no se carga al abrir la página. Detalle en [security.md](../security.md).

## Checklist

- [x] Alcance implementado y verificaciones automáticas ejecutadas.
- [x] Seguridad revisada y límites documentados con honestidad.
- [x] Documentación actualizada.
- [x] Sin secretos ni archivos generados en Git (`public/pyodide/` y `public/execution/` ignorados).
- [x] Sin cambios de backend ni funciones de PR-008.
- [ ] Prueba manual y revisión del PR.

## Conocimientos aplicados

Web Workers y paso de mensajes, WebAssembly, Pyodide, módulos ES, tracebacks de Python, temporizadores y cancelación, regiones vivas ARIA y pruebas con dobles de prueba. Actividad sugerida: ejecuta `while True: pass`, espera el corte y explica por qué la siguiente ejecución tarda más que una normal.

## Acciones Git

Rama sugerida `feat/pr-007-python-execution`; sin commit, push ni PR remoto por parte del agente.
