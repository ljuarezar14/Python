# ADR-0003: recomendación inicial por reglas visibles

Estado: aceptada para PR-004.

## Contexto

El cuestionario reúne objetivo, experiencia, tiempo, intereses, preferencia de ejemplos y temas conocidos. Todavía no existe un catálogo publicado ni una evaluación diagnóstica. No sería honesto afirmar que una autodeclaración demuestra dominio o que un algoritmo complejo mejora la ruta sin datos de aprendizaje.

## Decisión

Una función pura y versionada genera la recomendación. Todos empiezan en Fundamentos de Python. El objetivo define el enfoque, el primer interés define el tema sugerido, el tiempo disponible propone un ritmo y la preferencia de ejemplos define un proyecto ilustrativo. La experiencia y los temas declarados explican qué repasar. Las preferencias se pueden cambiar y la recomendación se recalcula, sin guardar una copia obsoleta.

## Alternativas

- Cuatro rutas rígidas: impedirían cambiar intereses y duplicarían fundamentos.
- Saltar módulos por autodeclaración: confundiría familiaridad con dominio demostrado.
- IA para clasificar: introduciría costo, privacidad y dificultad de explicar sin una necesidad validada.

## Consecuencias

La recomendación es reproducible y fácil de probar. El punto de partida es textual hasta que PR-005 publique módulos reales. Un diagnóstico opcional podrá validar competencias antes de permitir saltos. Cambios futuros de reglas requerirán subir `rule_version` y revisar el efecto pedagógico.
