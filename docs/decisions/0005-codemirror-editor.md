# ADR-0005 — Editor de Python usable en móvil

Estado: aceptado para PR-006.

## Contexto

El stack propuesto mencionaba Monaco Editor y pedía evaluar sus límites en móviles. PyRaíz debe poder usarse en teléfonos y con teclado. El editor de este PR todavía no ejecuta Python; necesita resaltado, numeración, indentación y un borrador recuperable.

## Decisión

Usar CodeMirror 6 con su paquete de lenguaje Python y cargarlo solo en la página de práctica. `basicSetup` aporta numeración, historial y controles básicos; la extensión Python aporta sintaxis e indentación. El editor tiene un nombre accesible y un campo de texto de respaldo si no logra cargarse. El botón Tab conserva su navegación normal entre controles para evitar una trampa de teclado.

Se descartó Monaco en este alcance porque su [documentación oficial](https://github.com/microsoft/monaco-editor/blob/main/README.md) indica que no admite navegadores móviles. La [guía oficial de CodeMirror](https://codemirror.net/docs/guide/) describe su diseño modular y las extensiones que aportan numeración e historial. Esta elección debe verificarse en dispositivos reales y con lector de pantalla antes del piloto.

El código se guarda en `localStorage` con una clave versionada, un límite de 100 000 caracteres y aviso explícito de que reside solo en ese navegador. No se envía al backend, no se vincula a la cuenta y no constituye progreso. Se incorpora una confirmación antes de restablecer el ejemplo.

## Consecuencias

PR-007 conectará un contrato de ejecución real a la interfaz. PR-009 decidirá si los borradores deben guardarse en la cuenta tras revisar privacidad y conflictos entre dispositivos. Los cambios de este PR añaden dependencias frontend; deben auditarse y medirse en el piloto. La consola se mantiene como marcador honesto hasta que exista el motor.
