# Mapa de la experiencia de aprendizaje

La persona comienza por su objetivo y avanza por **ruta → módulo → lección → práctica → progreso**. Este mapa es la estructura del producto, no una promesa de que todas las etapas ya funcionan.

| Etapa | Pantalla o contrato | Estado en PR-010d |
| --- | --- | --- |
| Objetivo | `/onboarding` | Disponible; recomendación inicial por reglas |
| Ruta | `/aprender`, `/aprender/rutas/{id}` | Disponible; primera ruta publicada: «Python desde cero» |
| Módulo | `/aprender/modulos/{id}` | Disponible; primer módulo, «Primeros pasos», completo con 5 lecciones |
| Lección | `/aprender/lecciones/{id}` | Disponible; 5 lecciones publicadas con 16 ejercicios: `print()`, cálculos, variables, textos e `input()` |
| Práctica | `/practicar`, `/practicar/ejercicios/{id}` | Práctica libre y ejercicios con pruebas automáticas y retroalimentación |
| Progreso | Disponible con cuenta | Último intento guardado por ejercicio, ejercicios resueltos y «Continuar donde lo dejaste» en la cuenta (autodeclarado) |

`/aprender` muestra estas etapas con estados honestos y enlaza a las funciones disponibles. La landing page, la cuenta y el resultado del onboarding llevan al mapa. El editor ofrece un ejemplo inicial para experimentar con sintaxis y sangría. El borrador se guarda en el almacenamiento local del navegador y no viaja a la cuenta ni a la API. Desde PR-007, **Ejecutar** corre el código con Pyodide en un Web Worker y la consola muestra la salida real, los errores con su línea, y los cortes por tiempo límite o cancelación. La práctica libre no evalúa respuestas ni registra progreso. Desde PR-008b, cada ejercicio publicado tiene su página con **Comprobar**, que muestra por prueba si es correcta y, si no lo es, qué se esperaba, qué se obtuvo y en qué línea cambia. Los ejercicios publicados llegan con las lecciones (desde PR-010b); `seed_dev` añade datos de prueba en local. Desde PR-009b, con sesión, cada **Comprobar** guarda el último intento en la cuenta, la página ofrece cargarlo de nuevo y **Tu cuenta** resume los ejercicios resueltos y recientes. Sin sesión, los resultados no se guardan. Desde PR-010a, `/aprender` lista las rutas publicadas y se puede navegar de ruta a módulo, lección y ejercicio, y volver; con `seed_dev` se recorre la ruta de prueba.

## Próximos enlaces reales

PR-010a permite navegar de ruta a módulo y lección. PR-010b publica la primera lección revisada, cargada desde `backend/content/` (ADR-0009), y el mapa marca las etapas «Rutas», «Módulos» y «Lecciones» como iniciadas. Cada entrega siguiente (PR-010c en adelante) añade una lección. Cada etapa debe actualizarse solo cuando su flujo completo esté probado.
