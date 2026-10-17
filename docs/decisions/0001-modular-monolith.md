# ADR 0001 — Monolito modular como punto de partida

Estado: aceptada para la base inicial.

## Contexto

PyRaíz necesita una interfaz educativa, reglas de aprendizaje y persistencia, pero todavía no tiene tráfico ni equipos independientes que justifiquen servicios separados.

## Decisión

Usar Next.js para la interfaz y una API FastAPI organizada por capacidades reales. Mantener una sola base de datos PostgreSQL cuando se incorpore persistencia. Incorporar módulos y capas de aplicación o dominio donde existan reglas que lo requieran.

## Consecuencias

Esta estructura reduce el costo operativo y facilita pruebas y cambios tempranos. Habrá que vigilar acoplamientos entre módulos. La ejecución de código del estudiante queda fuera del proceso del backend; para práctica inicial se evaluará Pyodide en un Web Worker.

## Alternativas consideradas

Microservicios y colas se descartan por complejidad operativa sin necesidad demostrada. Una aplicación exclusivamente frontend no cubre identidad y progreso confiable. Un evaluador remoto dentro de FastAPI se descarta por riesgo de seguridad.
