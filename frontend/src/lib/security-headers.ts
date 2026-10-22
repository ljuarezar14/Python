// Cabeceras de seguridad del frontend. El proxy aplica la política de las páginas con un
// nonce nuevo por petición; next.config.ts aplica el resto a todas las rutas.

type PagePolicyOptions = {
  nonce: string;
  apiOrigin: string;
  development: boolean;
};

function join(directives: string[]) {
  return directives.join("; ");
}

// Sin 'unsafe-inline' para scripts: solo se ejecutan los que llevan el nonce y lo que ellos
// carguen ('strict-dynamic'). Los estilos en línea sí se permiten: CodeMirror y React los
// necesitan y no ejecutan código. Solo se puede conectar con la propia web y con la API.
export function pagePolicy({ nonce, apiOrigin, development }: PagePolicyOptions) {
  return join([
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${new URL(apiOrigin).origin}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]);
}

// Política propia del worker de Python y de los archivos de Pyodide: compilar WebAssembly y
// descargar la biblioteca estándar desde el mismo origen. Nada más.
export const WORKER_POLICY = join([
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
]);

export function commonHeaders(production: boolean) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
  // Los navegadores ignoran HSTS en http://, así que no afecta a las pruebas locales.
  if (production) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  return headers;
}

export function newNonce() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}
