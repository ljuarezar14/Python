# ADR-0007 — Ejercicios con pruebas públicas evaluadas en el navegador

Estado: aceptado para PR-008a (modelo y API). La evaluación en el navegador se implementará en PR-008b.

## Contexto

PR-007 ejecuta Python en el navegador con Pyodide. Para dar retroalimentación, cada ejercicio necesita un enunciado, un código inicial y pruebas que el evaluador pueda ejecutar. ADR-0001 impide ejecutar código del estudiante en el backend, y el catálogo sigue sin contenido revisado.

## Decisión

Los ejercicios se guardan en `learning_exercises`, ligados a una lección, con identificador estable, posición única dentro de la lección, título, enunciado Markdown, código inicial, lista de pruebas JSON, estado `draft` o `published` y versión.

Las pruebas siguen un contrato cerrado, validado con Pydantic en `app/curriculum/exercises.py` (campos desconocidos rechazados, de 1 a 20 pruebas, identificadores únicos):

- **`output`**: ejecuta el programa con líneas de entrada opcionales (`stdin`, hasta 50 líneas de una sola línea cada una) y compara lo que imprime con `expected_stdout` (hasta 10 000 caracteres).
- **`function`**: ejecuta el programa, llama a `function_name` (identificador válido de Python) con `args` JSON y compara el resultado con `expected` JSON. Argumentos y resultado ocupan como máximo 10 000 caracteres serializados.

Reglas que deberá aplicar el evaluador de PR-008b, para que el contenido pueda escribirse desde ahora:

- La salida se compara ignorando los espacios al final de cada línea y las líneas vacías finales. El resto, incluidas mayúsculas y tildes, debe coincidir.
- Durante la evaluación, `input()` devuelve las líneas de `stdin` en orden y **su texto de solicitud no forma parte de la salida comparada**. Si se agotan las líneas, el programa recibe `EOFError`.
- El resultado de una función se compara por igualdad con el valor JSON; las tuplas cuentan como listas. No hay tolerancia para decimales: el contenido debe evitar comparaciones que dependan del redondeo.

Un ejercicio es visible solo si está publicado, sus pruebas cumplen el contrato y su lección es visible según ADR-0004. En cualquier otro caso, `GET /curriculum/exercises/{id}` responde `404` y el ejercicio no aparece en la lección. Ocultar datos inválidos no sustituye la validación al publicar: la futura herramienta editorial deberá llamar a `validate_checks` antes de guardar.

`python -m app.curriculum.seed_dev` carga tres ejercicios de prueba, marcados como datos sin revisión pedagógica, para verificar el flujo en local. No forma parte de las migraciones, se puede ejecutar varias veces sin duplicar registros y se niega a ejecutarse con `PYRAIZ_ENV=production`.

## Seguridad

Las pruebas viajan al navegador porque allí se ejecutan. **Son públicas por diseño**: cualquiera puede leerlas en la API. La evaluación sirve para dar retroalimentación formativa; no prueba que la persona resolvió el ejercicio y no debe usarse para acreditar. Una evaluación con pruebas privadas exigirá un evaluador en el servidor con aislamiento por proceso y su propio análisis de amenazas.

## Alternativas

- **Pruebas como código Python arbitrario (asserts):** más expresivas, pero mezclan contenido con código ejecutable sin un contrato verificable y dificultan explicar el error al estudiante.
- **Ejercicios fijos en el frontend:** más rápido, pero duplicaría el modelo cuando exista edición de contenido y no tendría identificadores estables para el progreso de PR-009.
- **Pruebas ocultas:** imposibles mientras la evaluación ocurra en el navegador.

## Consecuencias

PR-008b podrá cargar ejercicios desde la API y evaluarlos sin depender de Pyodide en el contrato. PR-009 podrá referenciar ejercicios por identificador estable y versión, pero el resultado que reporte el navegador seguirá siendo autodeclarado. Añadir un tipo de prueba nuevo exige ampliar el contrato, el evaluador y esta decisión.
