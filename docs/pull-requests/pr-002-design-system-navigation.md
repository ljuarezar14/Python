# PR-002 — Sistema de diseño y navegación

Estado: implementado localmente; pendiente de revisión visual y humana.

## Objetivo

Dar a PyRaíz una identidad visual clara y una página pública navegable sin presentar funciones futuras como si ya existieran.

## Contexto

PR-001 dejó una página mínima. Esta entrega define patrones visuales reutilizables antes de construir las pantallas funcionales.

## Alcance

- Tokens de color, espaciado, bordes y estados de foco en modo claro y oscuro.
- Encabezado, navegación a secciones reales, enlace para saltar al contenido y pie de página.
- Página inicial responsive que explica método, ruta y proyectos previstos.
- Componentes `Container` y `SectionHeading`.
- Tailwind CSS 4 y PostCSS para utilidades responsive; colores semánticos compartidos mediante variables CSS.
- Documentación del sistema de diseño.

## Fuera de alcance

Registro, dashboard, lecciones, editor, ejecución de Python y formularios de producción.

## Archivos afectados

`frontend/src/app/page.tsx`, `frontend/src/app/globals.css`, `frontend/src/components/`, `frontend/postcss.config.mjs`, `frontend/package.json`, `frontend/package-lock.json`, `README.md`, `docs/design-system.md` y esta ficha.

## Criterios de aceptación

- [x] Los enlaces de navegación llegan a secciones existentes.
- [ ] La página es legible en escritorio y móvil, en modo claro y oscuro.
- [ ] El teclado permite saltar al contenido y ver el foco.
- [x] No hay llamadas a funciones aún inexistentes.
- [x] Lint, tipos y build terminan sin errores.
- [x] Los cambios quedan limitados a frontend y documentación de PR-002.

## Pruebas y evidencia

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; ruta `/` generada como página estática.
- El CSS generado contiene las utilidades `bg-page`, `text-brand` y la cuadrícula responsive usada por la página.
- `npm audit --omit=dev`: 0 vulnerabilidades reportadas en dependencias de producción.
- Servidor de producción: HTTP 200 en `/`; todos los destinos internos (`contenido`, `inicio`, `metodo`, `ruta`, `proyectos`) existen en el HTML.
- Marcado renderizado: un `main`, un `h1`, enlace para saltar al contenido y aviso de funciones todavía en construcción.
- Contraste calculado para combinaciones principales: texto claro 14.96:1, texto secundario claro 7.67:1, marca clara 8.73:1, texto oscuro 16.09:1, texto secundario oscuro 9.98:1, marca oscura 11.16:1.
- `git diff --check`: sin errores de espacios; Git mostró avisos de conversión LF/CRLF en Windows.
- Se intentó captura visual con Edge y Chrome, pero ambos procesos gráficos fallaron en el entorno aislado. No se verificó visualmente en navegador o móvil real.

## Riesgos

La accesibilidad real requiere validación posterior con teclado, tecnología asistiva y dispositivos diversos. Tailwind y PostCSS añaden dependencias de compilación; las clases y los tokens deberán mantenerse coherentes al crecer las pantallas.

La auditoría completa de npm reporta cinco avisos altos encadenados en dependencias de desarrollo de `eslint-config-next`, vinculados a `braces <=3.0.3` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). El aviso no tiene versión corregida publicada. Las dependencias de producción no reportan vulnerabilidades. No se aplica una sustitución forzada sin una versión compatible y verificada.

## Revisión

- [ ] Requisitos satisfechos por completo: falta revisión visual y de teclado.
- [x] Código revisado.
- [x] Comprobaciones ejecutadas.
- [x] Seguridad revisada: página estática sin formularios; dependencias nuevas y avisos de desarrollo documentados.
- [x] Documentación actualizada.
- [x] Sin secretos expuestos.
- [x] Sin cambios fuera de alcance.
- [x] Sin errores conocidos críticos.

## Pendientes

Revisión humana, commit, push y PR remoto. No se presumen realizados.
