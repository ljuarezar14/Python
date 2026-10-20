# Mapa de la experiencia de aprendizaje

La persona comienza por su objetivo y avanza por **ruta → módulo → lección → práctica → progreso**. Este mapa es la estructura del producto, no una promesa de que todas las etapas ya funcionan.

| Etapa | Pantalla o contrato | Estado en PR-006 |
| --- | --- | --- |
| Objetivo | `/onboarding` | Disponible; recomendación inicial por reglas |
| Ruta | `GET /api/v1/curriculum/paths` | Modelo y API disponibles; catálogo sin contenido publicado |
| Módulo | `GET /api/v1/curriculum/modules/{id}` | Modelo y API disponibles; sin contenido publicado |
| Lección | `GET /api/v1/curriculum/lessons/{id}` | Modelo y API disponibles; sin pantalla de lección ni contenido publicado |
| Práctica | `/practicar` | Editor de Python y borrador local disponibles; sin ejecución |
| Progreso | Pendiente | Se implementará con evidencias de ejercicios en PR-009 |

`/aprender` muestra estas etapas con estados honestos y enlaza a las funciones disponibles. La landing page, la cuenta y el resultado del onboarding llevan al mapa. El editor ofrece un ejemplo inicial para experimentar con sintaxis y sangría. El borrador se guarda en el almacenamiento local del navegador y no viaja a la cuenta ni a la API. La consola es un espacio reservado para PR-007; no muestra una salida ficticia.

## Próximos enlaces reales

Cuando PR-010 publique contenido, el mapa deberá consultar el catálogo y permitir navegar de ruta a módulo y lección. PR-007 habilitará ejecución real y salida; PR-008 evaluación; PR-009 guardará progreso. Cada etapa debe actualizarse solo cuando su flujo completo esté probado.
