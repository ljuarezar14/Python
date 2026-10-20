# Mapa de la experiencia de aprendizaje

La persona comienza por su objetivo y avanza por **ruta → módulo → lección → práctica → progreso**. Este mapa es la estructura del producto, no una promesa de que todas las etapas ya funcionan.

| Etapa | Pantalla o contrato | Estado en PR-008 |
| --- | --- | --- |
| Objetivo | `/onboarding` | Disponible; recomendación inicial por reglas |
| Ruta | `GET /api/v1/curriculum/paths` | Modelo y API disponibles; catálogo sin contenido publicado |
| Módulo | `GET /api/v1/curriculum/modules/{id}` | Modelo y API disponibles; sin contenido publicado |
| Lección | `GET /api/v1/curriculum/lessons/{id}` | Modelo y API disponibles, con lista de ejercicios; sin pantalla de lección ni contenido publicado |
| Práctica | `/practicar`, `/practicar/ejercicios/{id}` | Práctica libre y ejercicios con pruebas automáticas y retroalimentación; sin ejercicios publicados todavía |
| Progreso | Pendiente | Se implementará con evidencias de ejercicios en PR-009 |

`/aprender` muestra estas etapas con estados honestos y enlaza a las funciones disponibles. La landing page, la cuenta y el resultado del onboarding llevan al mapa. El editor ofrece un ejemplo inicial para experimentar con sintaxis y sangría. El borrador se guarda en el almacenamiento local del navegador y no viaja a la cuenta ni a la API. Desde PR-007, **Ejecutar** corre el código con Pyodide en un Web Worker y la consola muestra la salida real, los errores con su línea, y los cortes por tiempo límite o cancelación. La práctica libre no evalúa respuestas ni registra progreso. Desde PR-008b, cada ejercicio publicado tiene su página con **Comprobar**, que muestra por prueba si es correcta y, si no lo es, qué se esperaba, qué se obtuvo y en qué línea cambia. Todavía no hay ejercicios publicados; `seed_dev` permite probar el flujo en local. Los resultados no se guardan.

## Próximos enlaces reales

Cuando PR-010 publique contenido, el mapa deberá consultar el catálogo y permitir navegar de ruta a módulo y lección. PR-009 guardará progreso; PR-010 publicará lecciones y ejercicios revisados y los enlazará desde el mapa. Cada etapa debe actualizarse solo cuando su flujo completo esté probado.
