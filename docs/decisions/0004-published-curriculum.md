# ADR-0004 — Currículo persistente con lectura pública controlada

Estado: aceptado para PR-005.

## Contexto

PR-004 recomienda empezar por fundamentos, pero aún no existen rutas, módulos o lecciones publicadas. El editor, los ejercicios y la administración llegarán después. El modelo debe permitir identificadores estables, orden, versiones y prerrequisitos sin mostrar borradores a estudiantes.

## Decisión

Guardar rutas, módulos, lecciones y relaciones de prerrequisito en tablas del mismo monolito. Los identificadores públicos son cadenas estables independientes del título; un cambio de título no rompe enlaces. Cada registro tiene estado `draft` o `published` y versión positiva. La API de PR-005 es solo de lectura y no requiere sesión para contenido publicado.

Los niveles básico, intermedio y avanzado son un atributo restringido del módulo. Una tabla de niveles añadiría administración y relaciones sin aportar una regla nueva en esta etapa; si más adelante necesitan objetivos o publicación independientes, se revisará el modelo.

Una ruta aparece únicamente si está publicada. Un módulo requiere que él y su ruta estén publicados. Una lección requiere que ella, su módulo y su ruta estén publicados y que todos sus prerrequisitos visibles pertenezcan a la misma ruta y aparezcan antes en el orden curricular. Dependencias inválidas o circulares quedan ocultas. La futura herramienta de publicación deberá validar estas reglas antes de cambiar el estado; ocultar material defectuoso en lectura no sustituye esa validación.

El contenido de una lección se almacena como Markdown. Su representación segura en el frontend se describe en «Pantallas del catálogo (PR-010a)». No se aceptan escrituras públicas ni se incluyen materiales sin revisión en la migración.

## Consecuencias

La base recién migrada devuelve un catálogo vacío. PR-010 aportará contenido revisado. Las tablas de ejercicios y progreso quedan fuera de este modelo. Las versiones se exponen para que clientes futuros detecten cambios, pero todavía no conservan historial de revisiones. Antes de publicar contenido real habrá que probar el flujo editorial, los prerrequisitos, la accesibilidad y la renderización de Markdown.

## Pantallas del catálogo (PR-010a)

El frontend muestra el catálogo en `/aprender` (rutas publicadas), `/aprender/rutas/{id}`, `/aprender/modulos/{id}` y `/aprender/lecciones/{id}`. Cada página consulta la API pública sin cookie, valida la forma de la respuesta y trata igual el contenido oculto y el inexistente: «no existe o todavía no está publicado».

El Markdown de lecciones y enunciados se interpreta con un subconjunto propio (`frontend/src/lib/markdown.ts`) en lugar de una biblioteca: títulos `#` a `###` (se muestran como `h2` a `h4`, porque el título de la página es el `h1`), párrafos, listas con viñetas o numeradas, bloques de código con tres comillas invertidas, `código`, **negrita** y _énfasis_. El intérprete devuelve datos y el componente crea elementos de React; **nunca inserta HTML**. HTML, enlaces, imágenes y tablas se muestran como texto. Las marcas no se anidan: `**`código`**` muestra las comillas invertidas, y `_` solo marca énfasis si no está pegado a letras, para no romper nombres como `mi_variable`. Ampliar el subconjunto (por ejemplo, con enlaces) exige revisar antes los esquemas de URL permitidos.

Con sesión, la lección muestra el resultado guardado de cada ejercicio (ADR-0008). La primera consulta de progreso indica si hay sesión; sin ella no se piden las demás.
