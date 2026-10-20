# Alcance inicial del MVP

La primera experiencia útil debe permitir a una persona empezar una ruta básica, estudiar una lección, ejecutar Python en el navegador, resolver un ejercicio con retroalimentación y retomar su progreso. El contenido y los criterios de dominio deben revisarse pedagógicamente.

PR-001 aportó la base técnica; PR-003 añadió autenticación; PR-004 incorporó un cuestionario con recomendación inicial; PR-005 añadió el modelo curricular y una API pública de solo lectura. El contenido pedagógico aún no está publicado. El progreso depende de PRs posteriores. Tutor IA, comunidad, acreditaciones y ejecución remota quedan fuera del MVP inicial.

PR-006 hace visible el mapa del producto y permite editar Python con un borrador en el navegador. PR-007 ejecuta ese código en el navegador con Pyodide dentro de un Web Worker, con tiempo límite, cancelación y reinicio. PR-008 añade ejercicios con pruebas automáticas que se evalúan en el navegador y dan retroalimentación por prueba. Todavía no hay ejercicios publicados, no se guarda progreso y la evaluación no acredita avances.

La plataforma debe poder usarse con teclado y en móvil, y debe ser honesta sobre lo que se ha completado. El progreso se basará en evidencias de aprendizaje, no en tiempo conectado.
