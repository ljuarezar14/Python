# ADR-0006 — Ejecución de Python con Pyodide en un Web Worker

Estado: aceptado para PR-007.

## Contexto

La práctica necesita ejecutar Python escrito por estudiantes. ADR-0001 descartó ejecutar ese código en el proceso de FastAPI. Los primeros ejercicios usan la biblioteca estándar, salida por consola y programas cortos; no necesitan red, archivos persistentes ni paquetes externos. La plataforma debe poder evaluar más adelante (PR-008) sin acoplarse a un motor concreto.

## Decisión

La interfaz depende de un contrato propio (`frontend/src/lib/execution/contract.ts`), versionado con `contractVersion`. Una solicitud lleva identificador de ejecución, modo (`practice`), `exerciseId` opcional reservado para PR-008 y código. Un resultado devuelve estado (`success`, `error`, `timeout`, `cancelled`, `rejected`, `engine_error`), salida estándar y de errores, error estructurado (tipo, mensaje, línea del estudiante, traceback), duración, si la salida se recortó, motor y versión, y diagnósticos en español. La interfaz `PythonRunner` ofrece `run`, `cancel`, `restart` y `dispose`.

La implementación actual es Pyodide 314.0.7 (Python 3.14) dentro de un Web Worker de tipo módulo:

- Los archivos del motor se copian desde `node_modules/pyodide` a `public/pyodide/` y se sirven desde el mismo origen. La versión queda fijada en `package-lock.json`; no hay CDN externo.
- Pyodide 314 rechaza los workers clásicos (`Classic web workers are not supported`, comprobado en Chrome). El empaquetador de Next.js 16 crea los workers sin `type: "module"`, por lo que el worker se compila aparte con `tsconfig.worker.json` a `public/execution/` y se crea con `new Worker("/execution/python-worker.js", { type: "module" })`.
- El motor se descarga solo cuando la persona pulsa **Ejecutar** por primera vez, no al abrir la página.
- Cancelar o superar el tiempo límite termina el worker (`worker.terminate()`) y prepara uno nuevo. Es la única forma fiable de detener un bucle infinito sin aislamiento entre orígenes; la alternativa con `SharedArrayBuffer` exige cabeceras COOP/COEP que afectarían al resto del sitio.
- Cada ejecución usa un diccionario de variables nuevo. Los módulos importados permanecen hasta reiniciar Python.

Límites iniciales: 100 000 caracteres de código, 20 000 caracteres de salida combinada, 10 s por ejecución y 60 s para cargar el motor. `input()` responde con un mensaje en español porque la entrada interactiva aún no está diseñada.

## Seguridad

El Web Worker evita bloquear la interfaz y permite cortar ejecuciones, pero **no es una sandbox de seguridad**. Comparte el origen de la página. Tras cargar el motor se sombrean `fetch`, `XMLHttpRequest`, `WebSocket`, `WebTransport`, `EventSource`, `importScripts`, `indexedDB`, `caches`, `Worker`, `SharedWorker` y `BroadcastChannel`, y se retiran los módulos `js` y `pyodide_js`. Pyodide conserva otras vías internas entre Python y JavaScript (por ejemplo `pyodide.ffi`), así que estas medidas dificultan el acceso, no lo impiden. El código se ejecuta en el navegador de la propia persona; nunca llega al backend. Los resultados del navegador no son evidencia confiable para acreditaciones.

## Alternativas

- **Ejecución en el backend:** descartada por ADR-0001; exigiría aislamiento por proceso, cuotas y un análisis de amenazas específico.
- **Pyodide en el hilo principal:** congelaría la interfaz y no permitiría cancelar un bucle infinito.
- **Pyodide desde jsDelivr:** más simple, pero añade un tercero en tiempo de ejecución, envía datos de navegación fuera del sitio y complica una futura CSP.
- **Interrupción con `SharedArrayBuffer`:** conserva el estado tras cancelar, pero requiere COOP/COEP. Se podrá revisar si recargar el motor resulta lento en el piloto.
- **Skulpt o Brython:** más ligeros, pero no son CPython y sus mensajes de error difieren de los que verá el estudiante fuera de la plataforma.

## Consecuencias

La primera ejecución descarga unos 6,4 MB con la compresión gzip del servidor local de Next.js (wasm, biblioteca estándar y cargador); después el navegador puede usar su caché. Tras cancelar o superar el tiempo límite, el motor se recarga en pocos segundos. Los cambios en `src/lib/execution/` requieren `npm run build:python`, que `npm run dev` y `npm run build` ejecutan antes de iniciar. Una futura CSP deberá permitir `'wasm-unsafe-eval'` y `worker-src 'self'`. PR-008 podrá añadir el modo `exercise` y evaluar resultados sobre este contrato sin depender de Pyodide.
