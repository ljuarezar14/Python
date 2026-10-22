import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/api";
import { newNonce, pagePolicy } from "@/lib/security-headers";

// Next.js lee el nonce de la cabecera Content-Security-Policy de la petición y lo añade a
// sus propios scripts. Por eso todas las páginas se renderizan en cada petición.
export function proxy(request: NextRequest) {
  const policy = pagePolicy({
    nonce: newNonce(),
    apiOrigin: API_BASE,
    development: process.env.NODE_ENV === "development",
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Los archivos estáticos, el worker y Pyodide no son páginas: llevan su propia política.
      source: "/((?!_next/static|_next/image|execution/|pyodide/|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
