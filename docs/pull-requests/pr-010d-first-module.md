# PR-010d — Variables, textos e input(): primer módulo completo

Estado: implementado y comprobado en Chrome y Edge sin interfaz. Pendiente de **revisión pedagógica** y PR remoto. Depende de PR-010c, ya unido a `main`.

## Objetivo

Completar el módulo «Primeros pasos» con 3 lecciones en una sola entrega, para llegar antes al piloto. Con ellas, una persona sin experiencia puede escribir programas que piden datos, calculan y muestran resultados.

## Alcance

- **Lección 3, `guardar-datos-en-variables.toml`:**
  - Crear variables con `=` y usarlas en `print()` y en cálculos.
  - Cambiar su valor y elegir nombres.
  - Errores frecuentes: `NameError`, comillas alrededor del nombre y `15 = edad`.
  - Ejercicios: mostrar una variable, calcular con variables y sumar puntos.
- **Lección 4, `trabajar-con-textos.toml`:**
  - Unir textos con `+`.
  - El `TypeError` de mezclar texto y número, y `str()`.
  - Mensajes con f-strings.
  - Ejercicios: nombre completo, un mensaje con f-string y corregir un `TypeError`, cuyo código inicial trae el error.
- **Lección 5, `pedir-datos-con-input.toml`:**
  - `input()` con pregunta, y cómo se prueba en PyRaíz.
  - Aviso de que el Editor libre todavía no lo admite.
  - `input()` siempre devuelve texto (`"4" * 2` da `44`), y `int()` para convertirlo.
  - `ValueError`.
  - Ejercicios con datos de entrada, 2 pruebas cada uno: un saludo, el doble de un número (cuyo código inicial muestra `44`) y la edad dentro de 10 años.
- `ruta.toml`: el módulo pasa a la versión 3, con una descripción nueva y 5 objetivos.
- `/aprender`: la etapa «Módulos» pasa a «Primer módulo completo».
- Documentación: mapa, alcance y roadmap, este último con el camino corto hacia el piloto.

## Fuera de alcance

- `input()` en el Editor de práctica libre.
- Condicionales, bucles y más módulos: después del piloto, según el roadmap.

## Revisión pedagógica (pendiente del responsable)

- [ ] Las lecciones 3 a 5 se entienden con lo aprendido antes y en ese orden.
- [ ] Es adecuado introducir f-strings en la lección 4 y usarlas en la 5.
- [ ] Los ejercicios con errores a propósito (`TypeError` y `44`) ayudan a aprender a leer errores.
- [ ] Como en la lección 2, los ejercicios solo comprueban la salida: `print("Lima")` también pasa «Mostrar una variable». ¿Es aceptable?

## Criterios de aceptación

- [x] El contenido es válido, y cada solución pasa sus pruebas y ningún código inicial las pasa (16 ejercicios).
- [x] Una base con el contenido de PR-010c se actualiza sin errores: 12 nuevos, 1 actualizado (el módulo) y 10 sin cambios. Al repetir, 23 sin cambios.
- [x] El módulo muestra las 5 lecciones en orden, con sus prerrequisitos encadenados.
- [x] Se resuelven los 9 ejercicios nuevos, incluidos los que leen datos con `input()`.
- [x] La lección y la cuenta reflejan el progreso.
- [x] Sin desplazamiento horizontal a 375 px.
- [ ] Revisión pedagógica del responsable.
- [ ] Prueba en móvil físico, Firefox, Safari y lector de pantalla.

## Pruebas y evidencia

- **Backend:** `pytest` da **80 correctas** y `ruff check` está limpio. Sin cambios de código: las pruebas del contenido real no dependen del número de lecciones.
- **Frontend:**
  - `npm test`: 61 correctas. `npm run lint`, `typecheck` y `build` correctos.
  - `npm run check:content`: 16 ejercicios comprobados, 0 con problemas.
- **Actualización simulada en una SQLite temporal:**
  - Contenido de `main`: 11 nuevos.
  - Contenido nuevo: 12 nuevos, 1 actualizado y 10 sin cambios.
  - Al repetir: 23 sin cambios.
- **Punta a punta en Chrome y Edge sin interfaz:** 25 comprobaciones correctas en cada navegador, sin errores en la consola.
  - El módulo muestra las 5 lecciones en orden, con los 5 objetivos y los prerrequisitos enlazados.
  - Cada lección nueva tiene 3 ejemplos y 3 ejercicios, sin enlaces, imágenes ni scripts.
  - El código inicial de «El doble de un número» muestra `44` frente a `8` y falla.
  - El de «Corrige el TypeError» muestra el `TypeError` en la línea 2.
  - Las 9 soluciones se aprueban y se guardan, y las lecciones y la cuenta marcan los 9 resueltos.
  - No hay desplazamiento horizontal a 375 px.
- La primera pasada dio 2 fallos por un error de mi script: esperaba 4 ejemplos de código donde hay 3. Lo comprobé en los archivos, lo corregí y repetí la prueba completa.
- **No comprobado:** Firefox, Safari, móviles físicos y lectores de pantalla.

## Seguridad y riesgos

- Solo contenido y textos: sin endpoints, sin esquema y sin cambios en el cargador.
- Los ejercicios con `input()` usan las entradas de las pruebas (ADR-0007). No se ejecuta nada en el backend.

## Acciones Git

Rama `feat/pr-010d-first-module`. El responsable hace los pasos de Git (commit, push, PR y merge).
