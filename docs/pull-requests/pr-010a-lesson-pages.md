# PR-010a — Pantallas de ruta, módulo y lección

Estado: implementado y comprobado en Chrome y Edge sin interfaz; pendiente de revisión y PR remoto. Depende de PR-009b, ya unido a `main`.

## Objetivo

Que se pueda estudiar desde la web: `/aprender` lista las rutas publicadas y se navega de ruta a módulo, lección y ejercicio, y de vuelta. Es el paso previo para publicar contenido revisado en PR-010b.

## Contexto

La API pública del currículo existe desde PR-005, pero ninguna página la mostraba; solo había páginas de ejercicio sueltas. El Markdown de las lecciones no tenía una representación segura: los enunciados usaban un subconjunto mínimo (`prompt-text.ts`) pensado para reemplazarse cuando llegara la pantalla de lección.

## Alcance

- `frontend/src/lib/curriculum.ts`: cliente del catálogo (rutas, ruta, módulo, lección) sin cookie y con validación de cada respuesta.
- `frontend/src/lib/markdown.ts` y `components/markdown-content.tsx`: subconjunto de Markdown que produce elementos de React (títulos, párrafos, listas, bloques de código, `código`, **negrita** y _énfasis_). Sustituye a `prompt-text.ts`, que se elimina.
- **Páginas nuevas:**
  - `/aprender/rutas/{id}`: descripción y módulos, con su nivel.
  - `/aprender/modulos/{id}`: objetivos, lecciones y prerrequisitos.
  - `/aprender/lecciones/{id}`: resumen, objetivos, contenido y ejercicios. Con sesión, marca el resultado de cada ejercicio.
- `/aprender`: sección «Rutas publicadas», con un aviso honesto si no hay ninguna.
- **Página del ejercicio:** enlace «← Volver a la lección» y enunciado con el renderizador nuevo.
- Documentación: ADR-0004 (pantallas y reglas del Markdown), ADR-0007, seguridad, arquitectura, mapa, alcance, roadmap y README.

## Fuera de alcance

- Contenido nuevo y su mecanismo de carga (PR-010b).
- Enlaces, imágenes y tablas en Markdown.
- Marcar como disponibles las etapas «Rutas», «Módulos» y «Lecciones» del mapa: se hará cuando haya contenido publicado.
- Paginación del catálogo: se piden hasta 100 rutas.
- Cambios en el backend.

## Archivos afectados

`frontend/src/lib/curriculum.ts`, `curriculum.test.ts`, `markdown.ts`, `markdown.test.ts`, `exercises.test.ts`, `prompt-text.ts` (eliminado), `frontend/src/components/catalog-views.tsx` y `markdown-content.tsx` (nuevos), `exercise-workspace.tsx`, `frontend/src/app/aprender/page.tsx`, `aprender/rutas/[id]/page.tsx`, `aprender/modulos/[id]/page.tsx` y `aprender/lecciones/[id]/page.tsx` (nuevos), `README.md` y documentación en `docs/`.

## Decisiones de arquitectura

- **Intérprete de Markdown propio, sin dependencias.** Devuelve datos y React los convierte en elementos; nunca se inserta HTML. Una biblioteca completa más un sanitizador añadiría dependencias y superficie para funciones que el contenido aún no necesita. Las reglas están en [ADR-0004](../decisions/0004-published-curriculum.md).
- **Las marcas no se anidan** y `_` solo marca énfasis si no está pegado a letras, para no romper nombres de Python como `mi_variable`. Es una regla de redacción para PR-010b.
- **Los títulos del contenido bajan un nivel** (`#` → `h2`), porque el título de la página es el `h1`.
- **Componentes de cliente**, como el resto de páginas que leen la API, para que la dirección de la API siga siendo la del navegador.
- **El progreso de la lección** se consulta por ejercicio: la primera consulta indica si hay sesión y solo entonces se piden las demás. El resumen de la cuenta no sirve aquí, porque solo trae los 50 intentos más recientes.

## Criterios de aceptación

- [x] `/aprender` enlaza las rutas publicadas y avisa cuando no hay ninguna.
- [x] Se navega de ruta a módulo, lección y ejercicio, y cada página enlaza a la anterior.
- [x] El contenido de la lección muestra títulos, listas, código y énfasis; el HTML, los enlaces y los scripts aparecen como texto y no se ejecutan.
- [x] Sin sesión, la lección invita a ingresar; con sesión, marca «✓ Resuelto» o «Sin intentos».
- [x] El contenido oculto o inexistente muestra «no disponible» con un enlace al mapa.
- [x] Sin desplazamiento horizontal a 375 px; los bloques de código se desplazan dentro y se alcanzan con Tab.
- [x] El recorrido con teclado y en móvil de PR-008b sigue funcionando.
- [x] Lint, tipos, build, pruebas y auditoría correctos; sin cambios en el backend.
- [ ] Prueba en móvil físico, Firefox, Safari y lector de pantalla.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `npm test`: **61 correctas**. Hay 7 nuevas: 4 en `markdown.test.ts`, que incluyen contenido malicioso y un bloque sin cerrar, y 3 en `curriculum.test.ts`, sobre validación, URL codificadas, `credentials: "omit"` y errores. La prueba de `prompt-text` se reemplazó por las del renderizador nuevo.
- `npm run lint`, `npm run typecheck`, `npm run build`: correctos. `npm audit --omit=dev`: 0 vulnerabilidades.
- Backend sin cambios (65 pruebas de PR-009a).
- Prueba de punta a punta en **Chrome y Edge sin interfaz**, por DevTools Protocol:
  - **Entorno:** API en el puerto 8107 sobre una SQLite temporal con `seed_dev`, y frontend en el 3107. La lección de prueba se reescribió con Markdown variado y contenido malicioso: `<img onerror>`, `<script>` y un enlace `javascript:`. No se tocaron los servidores del responsable.
  - **Resultado:** 26 comprobaciones correctas en ambos navegadores, sin errores en la consola:
    1. El mapa enlaza la ruta, y se navega a la ruta, al módulo (objetivos y nivel «Básico») y a la lección.
    2. `#` y `##` se muestran como `h2` y `h3`. Se ven negrita, código, énfasis, una lista numerada que empieza en 1 y otra con viñetas, y un bloque de código con su sangría. `mi_variable` queda como texto. No se crea ningún `img`, `script` ni `a`, y el script no se ejecuta.
    3. Sin sesión aparecen los 3 ejercicios con su enlace y una invitación a ingresar, con una sola consulta de progreso.
    4. Con sesión y un ejercicio resuelto: «✓ Resuelto» en ese ejercicio y «Sin intentos» en los otros dos.
    5. El ejercicio enlaza a su lección, y su enunciado muestra código, negrita y lista.
    6. A 375 px no hay desplazamiento horizontal en el mapa, la ruta, el módulo ni la lección; el bloque de código largo se desplaza dentro.
    7. Tab llega al bloque de código con el anillo de foco de 3 px.
    8. Una lección inexistente, un módulo en borrador, una ruta sin módulos publicados y un catálogo vacío muestran su aviso.
- El recorrido con teclado y en móvil de PR-008b, repetido en Chrome, sigue correcto. El enlace nuevo aparece en el orden de tabulación con anillo de foco.
- No comprobado: Firefox, Safari, móviles físicos y lectores de pantalla.

## Seguridad y riesgos

- No hay HTML generado a partir del contenido.
- Las lecturas del catálogo no envían la cookie, y solo las consultas de progreso la usan.
- Si en el futuro se admiten enlaces, habrá que limitar los esquemas de URL antes de publicarlos.

Detalle en [security.md](../security.md).

## Checklist

- [x] Alcance implementado y verificaciones ejecutadas.
- [x] Seguridad y documentación revisadas.
- [x] Sin secretos ni archivos generados en Git.
- [x] Sin cambios de backend.
- [ ] Prueba manual en otros navegadores y revisión del PR.

## Conocimientos aplicados

- Intérpretes de texto línea a línea.
- Por qué React escapa el texto y qué rompe `dangerouslySetInnerHTML`.
- Rutas dinámicas de Next.js y validación de datos de red.
- Accesibilidad de regiones desplazables y jerarquía de títulos.

**Actividad sugerida:** en `frontend/src/lib/markdown.ts`, explica por qué el patrón de `_énfasis_` mira las letras de alrededor, y escribe una prueba que falle si se quita esa condición.

## Acciones Git

Rama `feat/pr-010a-lesson-pages`. El responsable hace los pasos de Git (commit, push, PR y merge).
