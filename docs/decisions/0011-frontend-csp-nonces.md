# ADR-0011: CSP del frontend con nonces

Estado: aceptada en PR-013b.

## Contexto

El frontend muestra contenido de lecciones, código del estudiante y su salida. Todo se renderiza como texto con React, pero una política de seguridad de contenido (CSP) es una segunda barrera si algún día se cuela HTML. Next.js añade scripts en línea a cada página, así que una CSP sin `'unsafe-inline'` necesita un nonce por petición o hashes.

Pyodide necesita compilar WebAssembly (`'wasm-unsafe-eval'`) y crear un worker de módulo desde el mismo origen.

## Decisión

- `src/proxy.ts` genera un nonce aleatorio por petición y envía `script-src 'self' 'nonce-…' 'strict-dynamic'`. Next.js lo añade a sus propios scripts. Ningún script sin nonce se ejecuta.
- El layout raíz llama a `connection()`: todas las páginas se renderizan en cada petición, porque una página estática no puede llevar un nonce nuevo.
- `connect-src` admite solo el propio origen y el de la API (`NEXT_PUBLIC_PYRAIZ_API_URL`). `worker-src 'self'`, `object-src 'none'`, `base-uri 'none'` y `frame-ancestors 'none'`.
- `style-src` permite `'unsafe-inline'`: CodeMirror inserta estilos y React usa atributos `style`. Los estilos no ejecutan código.
- El worker de Python (`/execution/`) y los archivos de Pyodide (`/pyodide/`) llevan su propia política: `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. El worker no hereda la de la página: puede compilar WebAssembly, pero no hacer `eval` ni conectarse a otros orígenes. Es una capa más sobre el sombreado de APIs de ADR-0006, **no una sandbox**: el worker sigue compartiendo el origen.
- En desarrollo se añade `'unsafe-eval'`, que React usa para depurar. En producción no.

## Alternativas

- **CSP con `'unsafe-inline'` en `next.config.ts`:** mantiene las páginas estáticas, pero cualquier script inyectado se ejecutaría. Descartada: la protección principal de la CSP desaparece.
- **SRI experimental de Next.js:** conserva las páginas estáticas con hashes, pero es experimental y no cubre los scripts en línea que Next.js genera.
- **Sin CSP:** depender solo de que React no inserte HTML. Descartada para un sitio con cuentas.

## Consecuencias

- Cada página se genera en el servidor en cada visita: más trabajo de servidor y sin caché de CDN para el HTML. Para el piloto el volumen es pequeño. Los archivos de `_next/static`, Pyodide y el worker se siguen sirviendo como estáticos.
- El despliegue necesita un servidor Node.js (`next start` o un proveedor equivalente); no vale una exportación estática.
- Si cambia el origen de la API hay que recompilar el frontend, como ya ocurría con `NEXT_PUBLIC_PYRAIZ_API_URL`.
- Un script de terceros (analítica, etc.) tendría que añadirse con el nonce y revisarse en un PR propio.
