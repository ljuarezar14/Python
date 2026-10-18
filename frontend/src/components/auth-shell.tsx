import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/container";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <>
      <a className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:not-sr-only focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3" href="#contenido">
        Saltar al contenido
      </a>
      <header className="border-b border-border bg-surface py-5">
        <Container>
          <Link className="text-xl font-extrabold no-underline hover:underline" href="/">PyRaíz</Link>
        </Container>
      </header>
      <main id="contenido" tabIndex={-1} className="min-h-[calc(100vh-5rem)] py-12 sm:py-20">
        <Container>
          <div className="mx-auto max-w-lg">
            <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-brand">Tu aprendizaje empieza aquí</p>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight">{title}</h1>
            <p className="mb-8 leading-relaxed text-muted">{description}</p>
            {children}
          </div>
        </Container>
      </main>
    </>
  );
}
