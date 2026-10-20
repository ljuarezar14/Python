# ADR-0007 — Ejercicios con pruebas públicas evaluadas en el navegador

Estado: aceptado. PR-008a implementó el modelo y la API; PR-008b, la evaluación en el navegador.

## Contexto

PR-007 ejecuta Python en el navegador con Pyodide. Para dar retroalimentación, cada ejercicio necesita un enunciado, un código inicial y pruebas que el evaluador pueda ejecutar. ADR-0001 impide ejecutar código del estudiante en el backend, y el catálogo sigue sin contenido revisado.

## Decisión

Los ejercicios se guardan en `learning_exercises`, ligados a una lección, con identificador estable, posición única dentro de la lección, título, enunciado Markdown, código inicial, lista de pruebas JSON, estado `draft` o `published` y versión.

Las pruebas siguen un contrato cerrado, validado con Pydantic en `app/curriculum/exercises.py` (campos desconocidos rechazados, de 1 a 20 pruebas, identificadores únicos):

- **`output`**: ejecuta el programa con líneas de entrada opcionales (`stdin`, hasta 50 líneas de una sola línea cada una) y compara lo que imprime con `expected_stdout` (hasta 10 000 caracteres).
- **`function`**: ejecuta el programa, llama a `function_name` (identificador válido de Python) con `args` JSON y compara el resultado con `expected` JSON. Argumentos y resultado ocupan como máximo 10 000 caracteres serializados.

Reglas que aplica el evaluador (`EVALUATOR_SOURCE` en `frontend/src/lib/execution/python-harness.ts`):

- La salida se compara ignorando los espacios al final de cada línea y las líneas vacías finales. El resto, incluidas mayúsculas y tildes, debe coincidir.
- Durante la evaluación, `input()` devuelve las líneas de `stdin` en orden y **su texto de solicitud no forma parte de la salida comparada**. Si se agotan las líneas, el programa recibe `EOFError`.
- El resultado de una función se compara por igualdad con el valor JSON; las tuplas cuentan como listas. No hay tolerancia para decimales: el contenido debe evitar comparaciones que dependan del redondeo.

Un ejercicio es visible solo si está publicado, sus pruebas cumplen el contrato y su lección es visible según ADR-0004. En cualquier otro caso, `GET /curriculum/exercises/{id}` responde `404` y el ejercicio no aparece en la lección. Ocultar datos inválidos no sustituye la validación al publicar: la futura herramienta editorial deberá llamar a `validate_checks` antes de guardar.

`python -m app.curriculum.seed_dev` carga tres ejercicios de prueba, marcados como datos sin revisión pedagógica, para verificar el flujo en local. No forma parte de las migraciones, se puede ejecutar varias veces sin duplicar registros y se niega a ejecutarse con `PYRAIZ_ENV=production`.

## Evaluación en el navegador (PR-008b)

El contrato de ejecución añade una operación `evaluate`, separada de `run`. Recibe el código y las pruebas, y devuelve el estado global (`passed`, `failed`, `timeout`, `cancelled`, `rejected`, `engine_error`), el número de pruebas correctas y un resultado por prueba (`passed`, `failed`, `error`, `not_run`). Cada resultado incluye un mensaje en español, los valores esperado y obtenido, la primera línea distinta, la salida del programa y el error con la línea del estudiante.

- Cada prueba ejecuta el programa desde cero, con variables limpias. La salida se captura por prueba con el límite de 20 000 caracteres; si se supera, la prueba falla.
- El worker envía cada resultado en cuanto termina la prueba. El tiempo límite de 10 s cubre la evaluación completa: si se agota, se conservan las pruebas terminadas y las demás quedan como `not_run`.
- El hilo principal solo acepta resultados de pruebas solicitadas, una vez cada una.
- La página `/practicar/ejercicios/{id}` carga el ejercicio desde la API, valida su forma y guarda un borrador por ejercicio y versión en el navegador. El enunciado se interpreta con un subconjunto mínimo de Markdown (párrafos, `código` y _énfasis_) que produce elementos de React, nunca HTML.

## Seguridad

Las pruebas viajan al navegador porque allí se ejecutan. **Son públicas por diseño**: cualquiera puede leerlas en la API. La evaluación sirve para dar retroalimentación formativa; no prueba que la persona resolvió el ejercicio y no debe usarse para acreditar. Una evaluación con pruebas privadas exigirá un evaluador en el servidor con aislamiento por proceso y su propio análisis de amenazas.

## Alternativas

- **Pruebas como código Python arbitrario (asserts):** más expresivas, pero mezclan contenido con código ejecutable sin un contrato verificable y dificultan explicar el error al estudiante.
- **Ejercicios fijos en el frontend:** más rápido, pero duplicaría el modelo cuando exista edición de contenido y no tendría identificadores estables para el progreso de PR-009.
- **Pruebas ocultas:** imposibles mientras la evaluación ocurra en el navegador.

## Consecuencias

La interfaz evalúa a través del contrato, sin depender de Pyodide. PR-009 podrá referenciar ejercicios por identificador estable y versión, pero el resultado que reporte el navegador seguirá siendo autodeclarado. Añadir un tipo de prueba nuevo exige ampliar el contrato, el evaluador y esta decisión.
