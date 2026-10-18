# Sistema de diseño inicial

PR-002 establece una identidad visual sobria inspirada en crecimiento y raíces. La página usa Tailwind CSS 4 para composición y diseño responsive, con variables CSS semánticas para los colores de marca. Esta elección sigue el stack previsto para PyRaíz y permite compartir estilos sin crear componentes para cada variación visual.

## Tokens

`frontend/src/app/globals.css` importa Tailwind y define colores semánticos para página, superficie, texto, texto secundario, marca, bordes y foco. `@theme inline` los expone como utilidades (`bg-page`, `text-brand`, etc.). Los radios y espacios usan la escala de Tailwind. El modo oscuro sigue `prefers-color-scheme`; no se guarda una preferencia de usuario todavía.

## Componentes

`Container` mantiene el ancho de lectura y `SectionHeading` unifica encabezados de sección. Los enlaces con apariencia de botón llevan a secciones disponibles. Las clases compartidas de navegación, botón y tarjeta se mantienen como cadenas literales para que Tailwind pueda detectarlas durante la compilación. Los componentes se ampliarán cuando haya casos de uso nuevos.

## Accesibilidad

- La página usa un enlace para saltar al contenido, encabezados ordenados y navegación con nombre accesible.
- Los enlaces tienen foco visible y tamaño táctil suficiente.
- La navegación se distribuye en varias líneas en pantallas estrechas sin depender de JavaScript.
- El movimiento de desplazamiento se desactiva con `prefers-reduced-motion`.
- El ejemplo de código se puede enfocar y desplazar con teclado si no cabe en pantalla.
- La página declara explícitamente que el editor y los proyectos aún no están disponibles.

El objetivo es WCAG 2.2 AA. Esta base requiere una revisión posterior con lectores de pantalla y dispositivos reales; el build y la inspección de marcado no sustituyen esas pruebas.
