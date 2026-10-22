# Mapa de la experiencia de aprendizaje

La persona comienza por su objetivo y avanza por **ruta → módulo → lección → práctica → progreso**. Este mapa es la estructura del producto, no una promesa de que todas las etapas ya funcionan.

| Etapa | Pantalla o contrato | Estado en PR-010a |
| --- | --- | --- |
| Objetivo | `/onboarding` | Disponible; recomendación inicial por reglas |
| Ruta | `/aprender`, `/aprender/rutas/{id}` | Pantallas, modelo y API disponibles; sin contenido publicado todavía |
| Módulo | `/aprender/modulos/{id}` | Pantalla con objetivos, lecciones y prerrequisitos; sin contenido publicado |
| Lección | `/aprender/lecciones/{id}` | Pantalla con contenido Markdown y ejercicios, que marca los resueltos con sesión; sin contenido publicado |
| Práctica | `/practicar`, `/practicar/ejercicios/{id}` | Práctica libre y ejercicios con pruebas automáticas y retroalimentación; sin ejercicios publicados todavía |
| Progreso | Disponible con cuenta | Último intento guardado por ejercicio, ejercicios resueltos y «Continuar donde lo dejaste» en la cuenta (autodeclarado) |

`/aprender` muestra estas etapas con estados honestos y enlaza a las funciones disponibles. La landing page, la cuenta y el resultado del onboarding llevan al mapa. El editor ofrece un ejemplo inicial para experimentar con sintaxis y sangría. El borrador se guarda en el almacenamiento local del navegador y no viaja a la cuenta ni a la API. Desde PR-007, **Ejecutar** corre el código con Pyodide en un Web Worker y la consola muestra la salida real, los errores con su línea, y los cortes por tiempo límite o cancelación. La práctica libre no evalúa respuestas ni registra progreso. Desde PR-008b, cada ejercicio publicado tiene su página con **Comprobar**, que muestra por prueba si es correcta y, si no lo es, qué se esperaba, qué se obtuvo y en qué línea cambia. Todavía no hay ejercicios publicados; `seed_dev` permite probar el flujo en local. Desde PR-009b, con sesión, cada **Comprobar** guarda el último intento en la cuenta, la página ofrece cargarlo de nuevo y **Tu cuenta** resume los ejercicios resueltos y recientes. Sin sesión, los resultados no se guardan. Desde PR-010a, `/aprender` lista las rutas publicadas y se puede navegar de ruta a módulo, lección y ejercicio, y volver; con `seed_dev` se recorre la ruta de prueba.

## Próximos enlaces reales

PR-010a ya consulta el catálogo y permite navegar de ruta a módulo y lección. PR-010b cargará la primera lección revisada; desde entonces las etapas «Rutas», «Módulos» y «Lecciones» del mapa podrán marcarse como disponibles. Cada etapa debe actualizarse solo cuando su flujo completo esté probado.
