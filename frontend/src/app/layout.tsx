import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "PyRaíz",
  description: "Aprende Python aplicándolo a problemas reales.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Renderizar en cada petición permite que Next.js ponga el nonce de la CSP (src/proxy.ts).
  await connection();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
