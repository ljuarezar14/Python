# PR-008b — Evaluador de ejercicios y retroalimentación

Estado: implementado localmente y comprobado en Chrome y Edge sin interfaz; pendiente de prueba manual con móvil y lector de pantalla, revisión y PR remoto. Depende de PR-008a.

## Objetivo

Evaluar en el navegador los ejercicios publicados por la API de PR-008a y mostrar retroalimentación por prueba: si es correcta y, si no lo es, qué se esperaba, qué se obtuvo, en qué línea cambia y qué error se produjo.

## Contexto

PR-007 ejecuta Python con Pyodide en un Web Worker. PR-008a define los ejercicios, sus pruebas públicas y las reglas de comparación (ADR-0007). Este PR conecta ambas partes.

## Alcance

- Operación `evaluate` en el contrato de ejecución (`EvaluationRequest`, `EvaluationResult` y `CheckResult`), con validación de los mensajes del worker.
- Evaluador en Python dentro del arnés:
  - Variables limpias en cada prueba y `input()` alimentado por `stdin` sin incluir el texto de solicitud.
  - Comparación de salida tolerante a espacios finales y primera línea distinta.
  - Comparación estricta de valores JSON (tuplas como listas, booleanos distintos de enteros).
  - Mensajes en español.
- El worker envía cada resultado al terminar su prueba. Si se agota el tiempo, se conservan las pruebas terminadas.
- Página `/practicar/ejercicios/[id]`: carga y valida el ejercicio desde la API, muestra un enunciado con Markdown mínimo y seguro, tiene borrador por ejercicio, **Comprobar** (Ctrl/⌘ + Enter), **Detener** y resultados por prueba.
- Piezas compartidas con la práctica libre: `createBrowserRunner` y `useLocalDraft`.
- Documentación de ADR-0007, arquitectura, seguridad, diseño, mapa, alcance y README.

## Fuera de alcance

Guardar intentos o progreso (PR-009), pantalla de lección y navegación desde el mapa hacia ejercicios (PR-010), contenido publicado, pruebas ocultas o evaluación en el servidor, y cambios en el backend.

## Archivos afectados

`frontend/src/lib/execution/` (contrato, arnés, worker, controlador, `browser-runner.ts` y pruebas), `frontend/src/lib/exercises.ts`, `prompt-text.ts`, `use-local-draft.ts`, `exercises.test.ts`, `frontend/src/components/exercise-workspace.tsx`, `practice-workspace.tsx`, `frontend/src/app/practicar/ejercicios/[id]/page.tsx`, `aprender/page.tsx`, `globals.css`, `README.md` y documentación en `docs/`.

## Decisiones de arquitectura

- `evaluate` es una operación aparte de `run`: el resultado por prueba no encaja en el de una ejecución libre.
- Cada prueba ejecuta el programa desde cero. Es más lento si el programa hace mucho trabajo al inicio, pero evita que una prueba contamine a otra.
- Los resultados se envían uno a uno para que un bucle infinito no borre las pruebas ya evaluadas.
- El enunciado admite solo párrafos, `código` y _énfasis_, convertidos a elementos de React. El renderizador completo de Markdown queda para la pantalla de lección.
- En la página de ejercicio no hay botón **Ejecutar**: con pruebas que usan `input()`, la ejecución libre fallaría. Cada prueba muestra su propia salida.

## Criterios de aceptación

- [x] Una solución correcta aprueba todas las pruebas, y una incorrecta muestra esperado, obtenido y primera línea distinta.
- [x] `input()` recibe las entradas de cada prueba; su texto de solicitud no afecta a la comparación; pedir datos de más da `EOFError` con un mensaje claro.
- [x] Las pruebas de función comparan valores y explican si la función falta, no es invocable o lanza un error.
- [x] Un bucle infinito se corta a los 10 s, conserva las pruebas terminadas y marca las demás como «Sin ejecutar».
- [x] Un valor devuelto con recursión o con `__repr__`/`__eq__` defectuosos no detiene el evaluador.
- [x] Un ejercicio inexistente o con formato inválido muestra un mensaje sin romper la página.
- [x] La práctica libre sigue funcionando.
- [x] Lint, tipos, build y pruebas correctas; backend sin cambios.
- [ ] Recorrido manual con teclado, móvil real y lector de pantalla.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `npm test`: 50 correctas, 22 más que en PR-007:
  - 13 del evaluador con **Pyodide 314.0.7 real en Node**.
  - 6 de `evaluate` en el controlador con worker simulado.
  - 3 del cliente de API y del enunciado.
- Comprobaciones de mutación: al quitar la protección alrededor de la comparación y de `repr`, falló la prueba «un valor devuelto problemático no detiene el evaluador». Se restauró el código y la suite volvió a 50/50.
- `npm run lint`, `npm run typecheck`, `npm run build`: correctos. La nueva ruta se genera como dinámica (`ƒ /practicar/ejercicios/[id]`).
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Backend: 42 pruebas correctas, sin cambios en `backend/`.
- Prueba de punta a punta en **Chrome y Edge sin interfaz**, controlados por DevTools Protocol. Se usó la API en el puerto 8107 sobre una SQLite temporal con `seed_dev` y el frontend en el 3107; no se tocaron los servidores del responsable en 3000 y 8000. En ambos navegadores:
  1. El código inicial de `dev-greeting` falló con «Obtenido: (sin salida)».
  2. La solución correcta aprobó usando Ctrl+Enter.
  3. `input("¿Nombre? ")` aprobó 2 de 2.
  4. Una salida en minúsculas falló en la línea 1, mostrando esperado y obtenido.
  5. La función sin implementar dio «Obtenido None».
  6. La función correcta aprobó 2 de 2.
  7. El bucle infinito se cortó en unos 13 s, incluida la recarga de la página y del motor, con «Sin ejecutar».
  8. El identificador inexistente mostró «Ejercicio no disponible».
  9. La práctica libre siguió mostrando `Total: S/ 35`.

  No hubo excepciones en la consola.
- Contrastes calculados para los bordes de estado: fallo 4,80:1 (claro) y 9,55:1 (oscuro); acierto 7,22:1 y 6,66:1.
- No comprobado: Firefox, Safari, móviles reales y lectores de pantalla.

## Revisión de código

Antes del commit se revisó el diff completo:

- **Corregido:** la comparación del valor devuelto y su `repr` se ejecutaban fuera de cualquier `try`, y ambas pueden ejecutar código del estudiante. Una lista recursiva o un `__repr__` defectuoso habrían detenido el worker. Ahora se capturan, y una prueba lo cubre.
- **Corregido:** `border-focus` no existía como utilidad de Tailwind; se expuso `--color-focus`.
- **Mejorado:** el recuadro «Obtenido» vacío ahora dice «(sin salida)».
- **Aceptado:** un programa puede modificar `builtins` y afectar a ejecuciones posteriores del mismo worker; **Reiniciar Python** en la práctica libre, o recargar la página, lo restablece.

## Seguridad y riesgos

La evaluación ocurre en el Web Worker de PR-007, que no es una sandbox. Los resultados se pueden falsificar desde el navegador y son formativos: no se guardan y no acreditan. Las pruebas son públicas. Los datos de la API y los mensajes del worker se validan antes de usarse; la petición no envía cookies. El enunciado no admite HTML. Detalle en [security.md](../security.md) y [ADR-0007](../decisions/0007-exercise-checks.md).

## Checklist

- [x] Alcance implementado y verificaciones ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos ni archivos generados en Git.
- [x] Sin cambios de backend ni funciones de PR-009.
- [ ] Prueba manual y revisión del PR.

## Conocimientos aplicados

Captura de salida con `contextlib.redirect_stdout`, sustitución temporal de `builtins.input`, comparación estructural de valores, uniones discriminadas en TypeScript, validación de datos de red, mensajes incrementales entre worker e interfaz, y accesibilidad de resultados con estado textual. Actividad sugerida: en `dev-greeting-input`, escribe `print("Hola,", nombre)` y explica por qué aprueba aunque `print` separe con un espacio.

## Acciones Git

Rama `feat/pr-008b-exercise-feedback`, creada a partir de `feat/pr-008a-exercise-model`. Por indicación del responsable, el agente hizo el commit y el push de PR-008; el merge queda a cargo del responsable, primero 008a y después 008b.
