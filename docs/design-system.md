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
- La página declara explícitamente que los proyectos aún no están disponibles. El mapa y la práctica distinguen ejecución disponible de evaluación futura.

PR-006 amplía la navegación con una cabecera compartida para mapa y práctica. El editor usa CodeMirror con una etiqueta accesible, foco visible y diseño de una columna en pantallas estrechas. La consola tiene texto explicativo en lugar de una salida simulada. Quedan pendientes pruebas manuales con móvil y lectores de pantalla.

PR-007 añade los botones **Ejecutar**, **Detener** y **Reiniciar Python** con altura táctil de 44 px y el atajo Ctrl/⌘ + Enter declarado con `aria-keyshortcuts`. Los botones no disponibles usan `aria-disabled` en lugar de `disabled` para no perder el foco al cambiar de estado. Una región `role="status"` anuncia un resumen breve (inicio, duración, línea del error, recorte o tiempo límite); la salida completa vive en un `<pre>` enfocable que no se anuncia línea por línea. El token `--code-error` (#ffb4a3) marca la salida de errores sobre el fondo de código, con contraste calculado de 9,52:1 en modo claro y 10,92:1 en oscuro; el bloque de error añade tipo y línea en texto para no depender solo del color.

PR-008b muestra cada prueba de un ejercicio como un elemento de lista con su estado en texto (✓ Correcta, ✗ Incorrecta, ⚠ Error, – Sin ejecutar) y un borde de color como refuerzo: `brand` para las correctas y el nuevo utilitario `border-focus`, expuesto como `--color-focus`, para las incorrectas. Contrastes calculados para el borde: 4,80:1 (claro) y 9,55:1 (oscuro) en fallos; 7,22:1 y 6,66:1 en aciertos. El resumen ("2 de 3 pruebas correctas") se anuncia en `role="status"` y el foco no se mueve automáticamente. Esperado y obtenido se muestran en paralelo en pantallas anchas y uno debajo del otro en móviles.

El objetivo es WCAG 2.2 AA. Esta base requiere una revisión posterior con lectores de pantalla y dispositivos reales; el build y la inspección de marcado no sustituyen esas pruebas.
