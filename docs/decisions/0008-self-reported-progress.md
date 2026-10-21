# ADR-0008 — Progreso autodeclarado por ejercicio

Estado: aceptado. PR-009a implementa el modelo y la API; PR-009b, la interfaz.

## Contexto

PR-008 evalúa ejercicios en el navegador, pero el resultado se pierde al cerrar la página y el borrador vive solo en ese navegador. Para retomar el trabajo desde otro dispositivo y saber qué ejercicios están resueltos, la cuenta necesita guardar el último intento. ADR-0001 impide ejecutar código del estudiante en el backend, y ADR-0007 establece que la evaluación del navegador es formativa.

## Decisión

`exercise_progress` guarda **una fila por persona y ejercicio**, que se reemplaza en cada **Comprobar**:

- El último código (hasta 100 000 caracteres, el mismo límite del editor).
- La versión del ejercicio del intento.
- El último estado (`passed`, `failed` o `timeout`) con pruebas correctas y totales.
- El número de comprobaciones.
- `solved_version` y `solved_at`: la versión en la que todas las pruebas pasaron por primera vez.

Un ejercicio cuenta como **resuelto** mientras `solved_version` coincida con la versión actual del ejercicio. Un intento posterior que falla no lo desmarca. Si el contenido cambia de versión, el intento se conserva, se marca como `outdated` y el ejercicio deja de contar como resuelto hasta resolver la versión nueva.

La API acepta un intento solo si:

- Hay sesión y la petición viene de un origen autorizado.
- El ejercicio es visible según ADR-0007, y la versión enviada coincide con la actual (si no, `409`).
- El número total de pruebas coincide con el del ejercicio.
- El estado es coherente con los números: `passed` exige todas las pruebas correctas; `failed` y `timeout`, alguna incorrecta.
- No se superan 30 guardados por minuto y persona.

Los estados `cancelled`, `rejected` y `engine_error` no se guardan: no describen el programa del estudiante.

## Seguridad

**El resultado es autodeclarado.** Lo calcula el navegador y cualquiera puede enviar un `passed` falso con una petición propia. Las validaciones solo impiden datos incoherentes, no el engaño. El progreso sirve para orientar y retomar el trabajo, no para acreditar ni para comparar personas. Una acreditación exigirá un evaluador en el servidor con pruebas privadas y aislamiento por proceso.

El código guardado es dato personal: solo lo lee su autor y no aparece en el resumen. Se borra en cascada si se elimina la cuenta o el ejercicio.

## Alternativas

- **Historial completo de intentos:** útil para analizar el aprendizaje, pero multiplica los datos personales guardados sin un uso definido. Se puede añadir más adelante con su política de retención.
- **Guardar solo en el navegador:** no permite cambiar de dispositivo.
- **Guardar el borrador en cada tecla:** más tráfico y más datos sin un resultado asociado; el borrador local de PR-006 ya cubre ese caso.
- **Recalcular el resultado en el servidor:** contradice ADR-0001.

## Consecuencias

La interfaz puede ofrecer «continuar donde lo dejaste» y contar ejercicios resueltos. Los indicadores de dominio, insignias o rachas quedan fuera; si llegan, deberán decir que se basan en resultados autodeclarados.
