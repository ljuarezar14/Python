# ADR-0004 — Currículo persistente con lectura pública controlada

Estado: aceptado para PR-005.

## Contexto

PR-004 recomienda empezar por fundamentos, pero aún no existen rutas, módulos o lecciones publicadas. El editor, los ejercicios y la administración llegarán después. El modelo debe permitir identificadores estables, orden, versiones y prerrequisitos sin mostrar borradores a estudiantes.

## Decisión

Guardar rutas, módulos, lecciones y relaciones de prerrequisito en tablas del mismo monolito. Los identificadores públicos son cadenas estables independientes del título; un cambio de título no rompe enlaces. Cada registro tiene estado `draft` o `published` y versión positiva. La API de PR-005 es solo de lectura y no requiere sesión para contenido publicado.

Los niveles básico, intermedio y avanzado son un atributo restringido del módulo. Una tabla de niveles añadiría administración y relaciones sin aportar una regla nueva en esta etapa; si más adelante necesitan objetivos o publicación independientes, se revisará el modelo.

Una ruta aparece únicamente si está publicada. Un módulo requiere que él y su ruta estén publicados. Una lección requiere que ella, su módulo y su ruta estén publicados y que todos sus prerrequisitos visibles pertenezcan a la misma ruta y aparezcan antes en el orden curricular. Dependencias inválidas o circulares quedan ocultas. La futura herramienta de publicación deberá validar estas reglas antes de cambiar el estado; ocultar material defectuoso en lectura no sustituye esa validación.

El contenido de una lección se almacena como Markdown. Su representación segura en el frontend deberá resolverse cuando se implemente la pantalla de lección. No se aceptan escrituras públicas ni se incluyen materiales sin revisión en la migración.

## Consecuencias

La base recién migrada devuelve un catálogo vacío. PR-010 aportará contenido revisado. Las tablas de ejercicios y progreso quedan fuera de este modelo. Las versiones se exponen para que clientes futuros detecten cambios, pero todavía no conservan historial de revisiones. Antes de publicar contenido real habrá que probar el flujo editorial, los prerrequisitos, la accesibilidad y la renderización de Markdown.
