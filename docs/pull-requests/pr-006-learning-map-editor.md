# PR-006 — Mapa de aprendizaje, editor y borradores

Estado: implementado localmente; pendiente de revisión manual y PR remoto.

## Objetivo

Hacer visible la estructura del aprendizaje y permitir escribir Python y recuperar un borrador antes de integrar su ejecución.

## Contexto

PR-005 aportó la estructura curricular a la API, pero el catálogo sigue sin contenido. Los estudiantes necesitan una navegación honesta y un lugar para experimentar con código sin confundir edición con ejecución.

## Alcance

- Página `/aprender` con ruta, módulo, lección, práctica y progreso, y estado real de cada etapa.
- Página `/practicar` con CodeMirror 6, sintaxis Python, numeración, sangría e interfaz adaptable.
- Borrador automático en este navegador, ejemplo inicial y restablecimiento con confirmación.
- Consola visual que informa que la ejecución llegará en PR-007.
- Enlaces desde landing, cuenta y resultado del onboarding.
- Documentación de producto, decisión de editor y seguridad.

## Fuera de alcance

Ejecución de Python, evaluación, lecciones publicadas, persistencia de código en la cuenta y progreso. No se modificó el backend.

## Archivos afectados

`frontend/src/app/aprender/`, `frontend/src/app/practicar/`, `frontend/src/components/learning-header.tsx`, `practice-workspace.tsx`, `python-code-editor.tsx`, navegación existente, `frontend/package.json`, `frontend/package-lock.json`, `README.md` y documentación en `docs/`.

## Criterios de aceptación

- [x] El mapa diferencia funciones disponibles y pendientes sin enlaces que simulen lecciones.
- [x] El editor admite edición de Python, resaltado, números de línea e indentación.
- [x] El borrador se recupera del mismo navegador y se puede restablecer.
- [x] La consola aclara que todavía no ejecuta código.
- [x] Las páginas se generan y responden correctamente.
- [ ] Guardado, recarga, restablecimiento, teclado y móvil recorridos manualmente.
- [ ] Cambios revisados y aprobados en PR.

## Pruebas y evidencia

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; Next.js genera `/aprender` y `/practicar`.
- Servidor de producción local: ambas rutas respondieron HTTP 200 y mostraron sus títulos.
- `npm audit --omit=dev`: cero avisos para dependencias de producción.
- `npm audit`: cinco avisos altos en dependencias transitivas de desarrollo de ESLint. `npm audit fix --force` propone un cambio mayor; no se aplicó en este PR.
- Prueba visual e interacción en navegador: pendiente; el entorno del agente no expuso un navegador.

## Arquitectura

CodeMirror se carga solo al abrir la práctica. El estado del código vive en React y se guarda con una clave versionada en `localStorage`; la API no recibe código. La elección frente a Monaco se justifica en [ADR-0005](../decisions/0005-codemirror-editor.md). El mapa indica estados de producto y no inventa progreso del estudiante.

## Seguridad y riesgos

El borrador es local y podría ser visible para otra persona que use el mismo navegador. Se muestra esta limitación y se desaconsejan secretos. El editor no ejecuta código. Faltan pruebas con móvil y lector de pantalla. Los avisos de dependencias de desarrollo deben revisarse cuando exista una actualización compatible del tooling.

## Checklist

- [x] Alcance implementado y verificaciones automáticas ejecutadas.
- [x] Documentación y seguridad revisadas.
- [x] Sin secretos incluidos.
- [x] Sin cambios de backend ni funciones fuera de alcance.
- [ ] Prueba manual y revisión del PR.

## Conocimientos aplicados

Componentes cliente de React, estado y efectos, almacenamiento del navegador, carga diferida, etiquetas accesibles y separación entre interfaz de edición y motor de ejecución. Actividad sugerida: cambia un valor del ejemplo, recarga la página y observa qué persiste; luego explica por qué ese borrador no aparece en otro navegador.

## Acciones Git

Rama local `feat/pr-006-python-editor`; sin commit, push ni PR remoto por parte del agente.
