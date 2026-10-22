# PR-009b — Guardar y retomar el progreso desde la interfaz

Estado: implementado y comprobado en Chrome y Edge sin interfaz; pendiente de revisión y PR remoto. Depende de PR-009a, ya unido a `main`.

## Objetivo

Usar la API de progreso de PR-009a desde las pantallas. Con sesión, cada **Comprobar** guarda el último intento, la página del ejercicio permite recuperarlo en otro dispositivo y **Tu cuenta** muestra los ejercicios resueltos y recientes.

## Contexto

PR-009a guarda el último intento por persona y ejercicio, como progreso autodeclarado (ADR-0008). Hasta ahora la interfaz no lo usaba y los resultados se perdían.

## Alcance

- `frontend/src/lib/progress.ts`: cliente de la API con validación de las respuestas, y `attemptFromEvaluation`, que convierte una evaluación en intento solo si es `passed`, `failed` o `timeout` con números coherentes.
- **Página del ejercicio**, nuevo panel «Tu progreso»:
  - Sin sesión invita a ingresar; con sesión muestra el resultado guardado, los intentos y la fecha.
  - Avisa si el intento es de una versión anterior.
  - Ofrece **Cargar mi último intento guardado** cuando difiere del editor.
  - Tras **Comprobar**, guarda el intento y anuncia el resultado del guardado en una región `role="status"`.
- **Tu cuenta**: ejercicios resueltos y «Continuar donde lo dejaste» con los cinco más recientes.
- `/aprender`: la etapa «Progreso» pasa a «Disponible con tu cuenta» y enlaza a la cuenta.
- Documentación: ADR-0008, seguridad, mapa, alcance y README.

## Fuera de alcance

- Volver al ejercicio después de iniciar sesión (el acceso sigue llevando a la cuenta).
- Historial de intentos, insignias y estadísticas.
- Navegación desde lecciones publicadas (PR-010).
- Cambios en el backend.

## Archivos afectados

`frontend/src/lib/progress.ts`, `progress.test.ts`, `frontend/src/components/exercise-workspace.tsx`, `progress-overview.tsx` (nuevo), `account-panel.tsx`, `frontend/src/app/aprender/page.tsx`, `README.md` y documentación en `docs/`.

## Decisiones de arquitectura

- **El borrador local sigue mandando en el editor.** El intento guardado se ofrece con un botón en vez de reemplazar el borrador al abrir la página: así nunca se pierde trabajo que no se comprobó. Si el borrador tiene cambios propios, se pide confirmación.
- **Se guarda el código evaluado**, no el que haya en el editor cuando responde la API.
- **Sin sesión no se intenta guardar.** El estado de la sesión sale de la consulta inicial; si la sesión vence durante el trabajo, el guardado lo detecta (`401`) y lo avisa.
- **Cancelar o un fallo del motor no se guardan**, porque no describen el programa.
- Los mensajes de error de la API no se muestran tal cual, salvo el del límite de guardados, que es texto controlado por el backend.

## Criterios de aceptación

- [x] Sin sesión, la evaluación funciona igual, se invita a ingresar y no se envía ningún guardado.
- [x] Con sesión, **Comprobar** guarda el intento y el panel muestra «✓ Resuelto» o las pruebas correctas.
- [x] Sin borrador local (otro dispositivo), el intento guardado se carga con un botón.
- [x] Cancelar no guarda nada.
- [x] Si el ejercicio cambia con la página abierta, se pide recargar; tras recargar se marca la versión anterior, y resolver la nueva vuelve a contar.
- [x] Si la sesión termina, se avisa de que el intento no se guardó.
- [x] **Tu cuenta** muestra resueltos y recientes con enlaces, sin desplazamiento horizontal en móvil.
- [x] El recorrido con teclado y en móvil de PR-008b sigue funcionando.
- [x] Lint, tipos, build, pruebas y auditoría correctos; sin cambios en el backend.
- [ ] Prueba en móvil físico, Firefox, Safari y lector de pantalla.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `npm test`: **55 correctas**, 5 nuevas en `progress.test.ts`. Cubren la validación de respuestas, la conversión de evaluaciones, `credentials: "include"`, las respuestas `401`, `404`, `409`, `429` y `422`, y la falta de conexión.
- `npm run lint`, `npm run typecheck`, `npm run build`: correctos. `npm audit --omit=dev`: 0 vulnerabilidades.
- Backend sin cambios (65 pruebas de PR-009a).
- Prueba de punta a punta en **Chrome y Edge sin interfaz**, por DevTools Protocol. API en el puerto 8107 sobre una SQLite temporal con `seed_dev`, frontend en el 3107; no se tocaron los servidores del responsable. Resultados iguales en ambos navegadores:
  1. Sin sesión, `dev-greeting` aprobó, el panel invitó a ingresar y se enviaron 0 `PUT`.
  2. El registro respondió `201`.
  3. Con sesión, el panel decía «Cuando pulses Comprobar…»; al aprobar se envió 1 `PUT` y el panel mostró «✓ Resuelto · 1 intento».
  4. Un intento fallido en `dev-rectangle-area` se guardó como «0 de 2 pruebas correctas».
  5. Un bucle detenido con **Detener** envió 0 `PUT`.
  6. Sin borrador local, el editor mostró el código inicial, y **Cargar mi último intento guardado** cargó `print("Hola, PyRaíz")`.
  7. **Tu cuenta** mostró «1 ejercicio resuelto» y los dos ejercicios, del más reciente al más antiguo, con sus enlaces; sin desplazamiento horizontal a 375 px.
  8. Con la versión del ejercicio cambiada en la base:
     - Con la página abierta, el guardado pidió recargar.
     - Tras recargar, apareció «Versión anterior del ejercicio».
     - Al aprobar de nuevo, volvió «✓ Resuelto · 2 intentos».
  9. Tras cerrar la sesión, apareció «Tu sesión terminó; el intento no se guardó».

  No hubo errores en la consola.
- El recorrido con teclado y en móvil de PR-008b, repetido en Chrome, sigue correcto.
- No comprobado: Firefox, Safari, móviles físicos y lectores de pantalla.

## Revisión de código

- **Aceptado:** si la persona inicia sesión en otra pestaña, esta página no guarda hasta recargarla.
- **Aceptado:** si se pulsa **Comprobar** dos veces muy seguidas, el aviso puede mostrar el resultado del guardado anterior; el dato guardado es siempre el del último intento que llega a la API.

## Seguridad y riesgos

El progreso sigue siendo autodeclarado: la interfaz lo dice en la página del ejercicio y en la cuenta. Solo las peticiones de progreso envían la cookie. El código guardado se muestra como texto y no se ejecuta hasta que la persona pulsa **Comprobar**. Detalle en [security.md](../security.md) y [ADR-0008](../decisions/0008-self-reported-progress.md).

## Checklist

- [x] Alcance implementado y verificaciones ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos ni archivos generados en Git.
- [x] Sin cambios de backend.
- [ ] Prueba manual en otros navegadores y revisión del PR.

## Conocimientos aplicados

Uniones discriminadas en TypeScript para estados de carga, validación de datos de red, `credentials` en `fetch`, referencias de React para evitar valores viejos en funciones asíncronas, regiones `role="status"` y pruebas de punta a punta con DevTools Protocol. Actividad sugerida: en `attemptFromEvaluation` (`frontend/src/lib/progress.ts`), explica por qué una evaluación `cancelled` devuelve `null` y qué pasaría en tu cuenta si se guardara.

## Acciones Git

Rama `feat/pr-009b-progress-ui`. El responsable hace los pasos de Git (commit, push, PR y merge).
