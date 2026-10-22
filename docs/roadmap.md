# Roadmap por PRs

Cada PR requiere criterios de aceptación, pruebas pertinentes, revisión de seguridad y evidencia. No se avanza automáticamente al siguiente PR.

1. **PR-001:** base ejecutable, calidad y documentación.
2. **PR-002:** sistema de diseño y navegación accesible.
3. **PR-003:** registro, inicio de sesión y sesiones; dividir recuperación de contraseña y verificación de correo si requieren infraestructura aparte.
4. **PR-004:** onboarding y recomendación explicable.
5. **PR-005:** modelo curricular y API de contenidos.
6. **PR-006:** mapa visible del aprendizaje, editor y borradores locales.
7. **PR-007:** contrato de ejecución y Pyodide en worker.
8. **PR-008:** evaluación de ejercicios y retroalimentación, dividido en **PR-008a** (modelo, pruebas y API de ejercicios) y **PR-008b** (evaluador en el navegador e interfaz de retroalimentación).
9. **PR-009:** progreso y reanudación, dividido en **PR-009a** (modelo y API de progreso) y **PR-009b** (guardado desde la página del ejercicio y «continuar donde lo dejaste»).
10. **PR-010:** contenido básico en entregas pedagógicas pequeñas: **PR-010a** (pantallas de ruta, módulo y lección, con Markdown seguro), **PR-010b** (carga de contenido revisado desde archivos y primera lección real) **PR-010c** (lección de cálculos) y **PR-010d** (variables, textos e `input()`, que completan el primer módulo). Para llegar antes a un piloto, se priorizan la preparación para producción y el despliegue; proyectos (PR-011), administración (PR-012) y más módulos quedan para después del piloto.
11. **PR-011:** proyectos integradores.
12. **PR-012a en adelante:** administración según los modelos existentes.
13. **PR-013 a PR-016:** auditorías, despliegue y piloto, con alcance ajustado a evidencia de uso. PR-013 se divide en **PR-013a** (backend para producción) y **PR-013b** (cabeceras del frontend y accesibilidad).

Dependencias principales: el evaluador necesita ejecución y ejercicios definidos; el progreso necesita resultados claros; la administración necesita contenido y permisos; el piloto necesita los flujos críticos probados.
