# ADR-0010 — Límite de intentos compartido en la base de datos

Estado: aceptado. Implementado en PR-013a.

## Contexto

Desde PR-003, registro y acceso aceptan 10 intentos por minuto y dirección, y desde PR-009a, el progreso acepta 30 guardados por minuto y persona. El contador vivía en la memoria de cada proceso. Con varios procesos o servidores, cada uno contaba por separado y el límite real se multiplicaba, y al reiniciar se perdía. `security.md` pedía un límite compartido antes de publicar.

## Decisión

Los contadores se guardan en la tabla `rate_limit_counters` de la misma base (migración 0006):

- **Ventana fija.** Cada clave cuenta sus peticiones por minuto en una fila (`key_hash`, `window_start`, `hits`). El incremento es un `INSERT … ON CONFLICT DO UPDATE … RETURNING`, atómico en PostgreSQL y en SQLite, así que dos procesos no pueden contar la misma petición dos veces ni saltarse el límite por una carrera.
- **Claves cifradas con hash.** Se guarda el SHA-256 de `ámbito:clave`, no la dirección IP ni el id de la persona. Los ámbitos (`auth`, `progress`) separan los límites.
- **Limpieza.** Al abrir una ventana nueva se borran las de hace más de una ventana. `python -m app.identity.cleanup` borra además todo lo que tenga más de un día.

Se descartó Redis o un servicio de límites: añadiría infraestructura y otro secreto para un piloto pequeño. También se descartó delegar solo en el proxy, que depende del proveedor y no sirve para el límite por persona del progreso.

## Consecuencias

- **Cada intento limitado escribe en la base.** Es aceptable para el volumen de un piloto; si se convierte en un cuello de botella, se podrá mover a Redis manteniendo la interfaz `RateLimiter.allow(key)`.
- **Con ventana fija, una ráfaga en el cambio de minuto puede llegar al doble del límite.** Es suficiente para frenar la adivinación de contraseñas y los guardados abusivos.
- **La dirección de la persona debe llegar bien desde el proxy** (`--forwarded-allow-ips`, en [deployment.md](../deployment.md)). Si no, todas las peticiones comparten la dirección del proxy y se bloquean entre sí.
