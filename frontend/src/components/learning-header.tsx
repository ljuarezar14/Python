import Link from "next/link";
import { Container } from "@/components/container";

type LearningHeaderProps = {
  current: "map" | "practice";
};

const linkClass = "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold no-underline hover:bg-surface-muted";

export function LearningHeader({ current }: LearningHeaderProps) {
  return (
    <>
      <a
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:not-sr-only focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3"
        href="#contenido"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-border bg-surface">
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-3 py-3">
          <Link className="text-xl font-extrabold no-underline" href="/" aria-label="PyRaíz, ir al inicio">
            PyRaíz
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Navegación de aprendizaje">
            <Link className={linkClass} href="/aprender" aria-current={current === "map" ? "page" : undefined}>Mapa</Link>
            <Link className={linkClass} href="/practicar" aria-current={current === "practice" ? "page" : undefined}>Editor</Link>
            <Link className={linkClass} href="/cuenta">Mi cuenta</Link>
          </nav>
        </Container>
      </header>
    </>
  );
}
