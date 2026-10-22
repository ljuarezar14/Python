# PR-010b — Contenido desde archivos y primera lección

Estado: implementado y comprobado en Chrome y Edge sin interfaz. Revisión pedagógica aprobada por el responsable; pendiente de PR remoto. Depende de PR-010a, ya unido a `main`.

## Objetivo

Publicar la primera lección real, «Mostrar mensajes con `print()`», con un mecanismo que permita añadir más lecciones revisadas en entregas pequeñas.

## Contexto

PR-010a permite recorrer rutas, módulos y lecciones, pero la base solo podía llenarse con `seed_dev` (datos de prueba, bloqueado en producción). La administración llegará en PR-012.

## Alcance

- `backend/app/curriculum/content.py`: comando `python -m app.curriculum.content`, que valida y carga el contenido en una transacción. Tiene `--check` para solo validar y `--json` para exportar los ejercicios con sus soluciones. Exige subir la versión de lo que cambia.
- `backend/content/python-desde-cero/`:
  - **Ruta:** «Python desde cero».
  - **Módulo:** «Primeros pasos».
  - **Lección:** «Mostrar mensajes con `print()`», con 3 ejercicios:
    - «Tu primer mensaje».
    - «Dos líneas».
    - «Texto y números».
- `frontend/scripts/check-content.ts` (`npm run check:content`): ejecuta cada solución de referencia con el evaluador real y comprueba que el código inicial no pasa las pruebas.
- **Textos de la interfaz:**
  - El mapa marca las etapas «Rutas», «Módulos» y «Lecciones» como iniciadas.
  - La cuenta, el acceso y el onboarding ya no dicen que las lecciones llegarán más adelante.
- Documentación: ADR-0009 (nueva), ADR-0004, seguridad, arquitectura, mapa, alcance y README.

## Fuera de alcance

- Más lecciones (PR-010c en adelante).
- `input()` en las lecciones: la práctica libre todavía no lo admite y la primera lección no lo necesita.
- Herramienta de administración (PR-012) y despliegue.
- Cambios de esquema: no hay migraciones nuevas.

## Archivos afectados

- **Backend:** `backend/app/curriculum/content.py` y `backend/tests/test_content.py` (nuevos), y `backend/content/python-desde-cero/ruta.toml` y `lecciones/mostrar-mensajes.toml` (nuevos).
- **Frontend:**
  - `frontend/scripts/check-content.ts` (nuevo) y `frontend/package.json`.
  - `frontend/src/app/aprender/page.tsx`, `cuenta/page.tsx` e `ingresar/page.tsx`.
  - `frontend/src/components/account-panel.tsx` y `onboarding-form.tsx`.
- `README.md` y documentación en `docs/`.

## Decisiones de arquitectura

Ver [ADR-0009](../decisions/0009-content-files.md):

- **TOML en el repositorio:** la revisión pedagógica se hace en el PR.
- **Versiones explícitas** que el cargador hace cumplir.
- **El cargador nunca borra registros.**
- **Las soluciones no van a la base.** Solo las ejecuta una herramienta de desarrollo, nunca el backend.

## Revisión pedagógica (aprobada por el responsable)

Revisado en `backend/content/python-desde-cero/lecciones/mostrar-mensajes.toml`:

- [x] El texto se entiende sin conocimientos previos y el orden de las secciones es adecuado.
- [x] Los objetivos coinciden con lo que enseña la lección y con lo que piden los ejercicios.
- [x] Los enunciados dicen exactamente qué mostrar y avisan de que la comparación es exacta.
- [x] La dificultad sube poco a poco: un mensaje, dos líneas y varios valores.
- [x] Los errores frecuentes son los que más ves en principiantes.

Si cambias algo, sube la `version` del registro que cambies y ejecuta `npm run check:content`.

## Criterios de aceptación

- [x] El comando valida y carga el contenido; repetirlo no cambia nada.
- [x] Un cambio sin subir la versión, una versión menor o cualquier error dejan la base sin cambios.
- [x] La API publica la ruta, el módulo, la lección y los 3 ejercicios, sin las soluciones.
- [x] Cada solución supera sus pruebas con el evaluador real y ningún código inicial las supera.
- [x] Se navega del mapa a la lección, se resuelven los 3 ejercicios y la lección y la cuenta lo reflejan.
- [x] Sin desplazamiento horizontal a 375 px en la lección y el ejercicio.
- [x] Revisión pedagógica del responsable.
- [ ] Prueba en móvil físico, Firefox, Safari y lector de pantalla.

## Pruebas y evidencia

- **Backend:** `pytest` da **79 correctas**, 14 nuevas en `test_content.py`:
  - Contenido del repositorio válido y publicado por la API sin soluciones.
  - Idempotencia y versiones (cambio sin subir la versión, versión mayor y menor).
  - Prerrequisitos sincronizados y transacción sin cambios ante un error.
  - 8 casos de archivos inválidos y la línea de comandos.
- **Calidad del backend:** `ruff check` y `ruff format --check` correctos. `uv audit`: sin vulnerabilidades.
- **Frontend:**
  - `npm test`: 61 correctas. `npm run lint`, `typecheck` y `build` correctos.
  - `npm audit --omit=dev`: 0 vulnerabilidades.
  - `npm run check:content`: 3 ejercicios comprobados, 0 con problemas.
  - Para confirmar que el script detecta errores, rompí temporalmente una solución e hice que un código inicial pasara las pruebas. Informó los 2 problemas y salió con código 1.
- **Carga en una SQLite temporal:** «6 nuevos», y al repetir, «6 sin cambios».
- **Punta a punta en Chrome y Edge sin interfaz, por DevTools Protocol** (API en el 8107 y frontend en el 3107; no se tocaron los servidores del responsable). 17 comprobaciones correctas en cada navegador, sin errores en la consola:
  - El mapa muestra «Python desde cero», y se navega a la ruta, al módulo y a la lección.
  - La lección tiene 5 secciones, 3 ejemplos de código y los 3 ejercicios.
  - Un intento sin exclamaciones falla y muestra lo esperado.
  - Las tres soluciones se aprueban y se guardan.
  - La lección marca los 3 ejercicios como resueltos y la cuenta dice «3 ejercicios resueltos».
  - No hay desplazamiento horizontal a 375 px.
- La primera pasada dio un fallo por un error del script: buscaba «Esperado», que el CSS muestra en mayúsculas. Lo corregí y repetí la prueba completa en los dos navegadores.
- **No comprobado:** Firefox, Safari, móviles físicos y lectores de pantalla.

## Seguridad y riesgos

- La publicación sigue sin endpoints de escritura.
- La carga nunca borra registros, así que el progreso no se pierde.
- Las soluciones no salen por la API, aunque son públicas en el repositorio.

Detalle en [security.md](../security.md).

## Checklist

- [x] Alcance implementado y verificaciones ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos ni archivos generados en Git.
- [x] Sin migraciones nuevas.
- [x] Revisión pedagógica.
- [ ] Prueba manual en otros navegadores.

## Conocimientos aplicados

- Validación con Pydantic de archivos TOML.
- Transacciones y control de versiones optimista.
- Separar contenido y código.
- Probar el contenido con el mismo evaluador que usa el navegador.

**Actividad sugerida:** añade un cuarto ejercicio a la lección, por ejemplo mostrar tu nombre y tu edad con un solo `print()`. Sube la `version` de la lección y comprueba el resultado con `--check` y `npm run check:content`.

## Acciones Git

Rama `feat/pr-010b-first-lesson`. El responsable hace los pasos de Git (commit, push, PR y merge).
