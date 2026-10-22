# PR-010c — Lección «Hacer cálculos con números»

Estado: implementado y comprobado en Chrome y Edge sin interfaz. Pendiente de **revisión pedagógica** y PR remoto. Depende de PR-010b, ya unido a `main`.

## Objetivo

Publicar la segunda lección de «Primeros pasos»: usar Python como calculadora. Prepara la siguiente lección, sobre variables.

## Alcance

- `backend/content/python-desde-cero/lecciones/calculos-con-numeros.toml` (nuevo). Lección 2, con la lección 1 como prerrequisito. Cubre:
  - Los operadores `+ - * /`.
  - La diferencia entre texto y operación.
  - El orden de las operaciones y los paréntesis.
  - Los decimales con punto.
  - `/`, `//` y `%`.
  - Errores frecuentes: `print(3,5)` y `ZeroDivisionError`.
- **4 ejercicios:**
  - «Una suma».
  - «El precio total», sobre el orden de las operaciones.
  - «Repartir caramelos», con `//` y `%`.
  - «La nota media», con paréntesis y resultado decimal. Su código inicial trae el error típico, `7 + 8 + 9 / 3`, para que se descubra al comprobarlo.
- `ruta.toml`: el módulo «Primeros pasos» añade el objetivo «Hacer cálculos con números» y pasa a la versión 2.
- **Corrección del cargador** (`backend/app/curriculum/content.py`):
  - Los prerrequisitos se guardan después de todas las lecciones. Antes, una lección que dependía de otra con un nombre de archivo posterior en orden alfabético fallaba con un error de clave foránea.
  - El resumen se escribe como «Nuevos: N; actualizados: N; sin cambios: N.».
- `backend/tests/test_content.py`:
  - Las pruebas del contenido real ya no dependen del número de lecciones.
  - Prueba de regresión del orden de los prerrequisitos.
- Documentación: mapa, alcance y ADR-0009.

## Fuera de alcance

- Variables y `input()` (próximas lecciones).
- Cambios en el frontend.

## Revisión pedagógica (pendiente del responsable)

Revisa `backend/content/python-desde-cero/lecciones/calculos-con-numeros.toml`:

- [ ] El texto se entiende con lo aprendido en la lección 1.
- [ ] Los ejemplos de la lección cubren todo lo que piden los ejercicios.
- [ ] Contextos adecuados para el público (euros, caramelos, notas).
- [ ] Es adecuado que el código inicial de «La nota media» traiga el error a propósito.
- [ ] Los enunciados de «Una suma» y «El precio total» no pueden comprobar que se escriba la operación en lugar del resultado: lo piden, pero la prueba solo mira la salida. ¿Es aceptable?

## Criterios de aceptación

- [x] El contenido es válido, y cada solución pasa sus pruebas y ningún código inicial las pasa.
- [x] Una base con el contenido de PR-010b se actualiza sin errores: 5 nuevos, 1 actualizado (el módulo) y 5 sin cambios. Al repetir, 11 sin cambios.
- [x] El módulo muestra las 2 lecciones en orden y el prerrequisito con su título.
- [x] Se resuelven los 4 ejercicios, y la lección y la cuenta lo reflejan.
- [x] Sin desplazamiento horizontal a 375 px.
- [ ] Revisión pedagógica del responsable.
- [ ] Prueba en móvil físico, Firefox, Safari y lector de pantalla.

## Pruebas y evidencia

- **Backend:** `pytest` da **80 correctas** (1 nueva). `ruff check` y `ruff format --check` correctos.
  - La prueba nueva falla con el cargador de PR-010b y pasa con el corregido.
  - Lo comprobé ejecutándola contra la versión anterior del archivo, que después restauré.
- **Frontend:**
  - `npm test`: 61 correctas. `npm run lint`, `typecheck` y `build` correctos.
  - `npm run check:content`: 7 ejercicios comprobados, 0 con problemas.
- **Actualización simulada:** en una SQLite temporal cargué el contenido de `main` (6 nuevos) y luego el nuevo (5 nuevos, 1 actualizado y 5 sin cambios). Al repetir, 11 sin cambios.
- **Punta a punta en Chrome y Edge sin interfaz,** sobre esa base: 17 comprobaciones correctas en cada navegador, sin errores en la consola.
  - El módulo muestra 2 lecciones, el objetivo nuevo y el prerrequisito enlazado.
  - La lección tiene 5 secciones, 3 ejemplos y 4 ejercicios.
  - El código inicial de la media muestra `18.0` frente a `8.0` y falla.
  - Las 4 soluciones se aprueban y se guardan, y la lección y la cuenta marcan los 4 resueltos.
  - No hay desplazamiento horizontal a 375 px en el módulo, la lección y un ejercicio.
- **No comprobado:** Firefox, Safari, móviles físicos y lectores de pantalla.

## Seguridad y riesgos

- Sin endpoints nuevos ni cambios de esquema.
- La corrección del cargador solo cambia el orden de escritura dentro de la misma transacción.

## Acciones Git

Rama `feat/pr-010c-numbers-lesson`. El responsable hace los pasos de Git (commit, push, PR y merge).
