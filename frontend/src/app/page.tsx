import Link from "next/link";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

const navLink = "inline-flex min-h-11 items-center text-sm font-bold no-underline hover:underline hover:underline-offset-4";
const buttonBase = "inline-flex min-h-12 items-center justify-center rounded-xl border border-transparent px-5 py-3 text-center font-bold no-underline";
const cardBase = "rounded-2xl border border-border bg-surface p-6 lg:p-8";

const learningSteps = [
  {
    number: "01",
    title: "Comprende",
    description: "Empieza con una idea clara, un ejemplo cercano y los conocimientos que necesitas para avanzar.",
  },
  {
    number: "02",
    title: "Practica",
    description: "Prueba tu código, interpreta los errores y mejora tu solución con pistas progresivas.",
  },
  {
    number: "03",
    title: "Construye",
    description: "Aplica lo aprendido en proyectos que muestran lo que puedes resolver por tu cuenta.",
  },
];

const projects = [
  {
    label: "Primeros pasos",
    title: "Presupuesto personal",
    description: "Organiza gastos y calcula cuánto queda disponible con variables, listas y funciones.",
  },
  {
    label: "Aplicación práctica",
    title: "Reportes automáticos",
    description: "Lee datos de archivos y prepara un resumen que ahorre trabajo repetitivo.",
  },
  {
    label: "Impacto local",
    title: "Datos ambientales",
    description: "Explora mediciones y presenta información útil para una comunidad.",
  },
];

export default function Home() {
  return (
    <>
      <a
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:not-sr-only focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3"
        href="#contenido"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-border bg-surface">
        <Container className="flex min-h-22 flex-col justify-center gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <a className="inline-flex items-center gap-3 text-xl font-extrabold no-underline" href="#inicio" aria-label="PyRaíz, ir al inicio">
            <span className="grid size-9 place-items-center rounded-xl rounded-bl-sm bg-[#17553e] text-lg text-white" aria-hidden="true">P</span>
            <span>PyRaíz</span>
          </a>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-1" aria-label="Navegación principal">
            <a className={navLink} href="#metodo">Cómo aprenderás</a>
            <a className={navLink} href="#ruta">Ruta inicial</a>
            <a className={navLink} href="#proyectos">Proyectos</a>
            <Link className={navLink} href="/ingresar">Ingresar</Link>
            <Link className={navLink} href="/registro">Crear cuenta</Link>
          </nav>
        </Container>
      </header>

      <main id="contenido" tabIndex={-1}>
        <section
          className="bg-page bg-[radial-gradient(circle_at_85%_25%,var(--brand-soft),transparent_32%)] py-16 lg:py-28"
          id="inicio"
          aria-labelledby="hero-title"
        >
          <Container className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <p className="mb-4 text-sm font-extrabold uppercase tracking-widest text-brand">Aprender Python con propósito</p>
              <h1 className="mb-6 max-w-[12ch] text-5xl leading-[1.08] font-extrabold tracking-[-0.045em] sm:text-6xl lg:text-[5.1rem]" id="hero-title">
                El conocimiento echa raíces cuando lo aplicas.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted">
                PyRaíz será un espacio gratuito para aprender Python desde cero, practicar con orientación y crear proyectos que resuelvan problemas reales.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className={`${buttonBase} bg-[#17553e] text-white hover:bg-[#0f422f]`} href="/registro">Crea tu cuenta</Link>
                <a className={`${buttonBase} border-border bg-surface hover:bg-surface-muted`} href="#metodo">Descubre el método</a>
              </div>
              <p className="mt-5 text-sm text-muted">La plataforma de aprendizaje está en construcción.</p>
            </div>

            <figure className="m-0 overflow-hidden rounded-[1.25rem] border border-border bg-code text-code-text shadow-2xl" aria-labelledby="preview-title">
              <figcaption className="flex items-center gap-3 border-b border-white/15 px-6 py-4 text-sm" id="preview-title">
                <span className="size-2.5 rounded-full bg-[#91deb0]" aria-hidden="true" />
                Un ejemplo de lo que aprenderás
              </figcaption>
              <pre className="overflow-x-auto px-6 py-8 font-mono text-base leading-loose" tabIndex={0}><code>{`gastos = [12, 8, 15]
total = sum(gastos)
print(f"Total: S/ {total}")`}</code></pre>
              <div className="flex flex-wrap justify-between gap-2 border-t border-white/15 px-6 py-4 text-sm">
                <span className="text-[#bfd4c6]">Resultado del ejemplo</span>
                <strong>Total: S/ 35</strong>
              </div>
              <p className="px-6 pb-5 text-xs leading-relaxed text-[#bfd4c6]">Vista ilustrativa. El editor interactivo llegará en una fase posterior.</p>
            </figure>
          </Container>
        </section>

        <section className="scroll-mt-4 py-16 lg:py-28" id="metodo" aria-labelledby="metodo-title">
          <Container>
            <SectionHeading
              eyebrow="Aprender haciendo"
              title="Entender, intentar y volver a probar"
              description="La experiencia se diseñará para que avances con práctica y comprendas cada corrección."
              id="metodo-title"
            />
            <div className="grid gap-4 md:grid-cols-3">
              {learningSteps.map((step) => (
                <article className={cardBase} key={step.number}>
                  <span className="mb-8 inline-block text-sm font-extrabold text-brand" aria-hidden="true">{step.number}</span>
                  <h3 className="mb-3 text-xl font-bold">{step.title}</h3>
                  <p className="leading-relaxed text-muted">{step.description}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section className="scroll-mt-4 bg-surface-muted py-16 lg:py-28" id="ruta" aria-labelledby="ruta-title">
          <Container className="grid gap-8 md:grid-cols-2 md:gap-16">
            <div>
              <SectionHeading
                eyebrow="Una base compartida"
                title="Una ruta para empezar desde lo esencial"
                description="Los intereses podrán cambiar, pero los fundamentos de Python serán el punto de partida común."
                id="ruta-title"
              />
              <p className="mb-4 leading-relaxed text-muted">Si empiezas desde cero, estudias sistemas, buscas automatizar tareas o quieres crear tecnología, podrás adaptar tu ruta después de aprender lo esencial.</p>
              <p className="leading-relaxed text-muted">El contenido curricular se publicará por etapas y se revisará antes de ofrecerse como lección.</p>
            </div>
            <ol className="list-decimal border-y border-border pl-6">
              <li className="border-b border-border py-4 pl-1 font-bold marker:text-brand">Primeros pasos con Python</li>
              <li className="border-b border-border py-4 pl-1 font-bold marker:text-brand">Variables, tipos y operadores</li>
              <li className="border-b border-border py-4 pl-1 font-bold marker:text-brand">Decisiones y repeticiones</li>
              <li className="border-b border-border py-4 pl-1 font-bold marker:text-brand">Listas y otras estructuras de datos</li>
              <li className="py-4 pl-1 font-bold marker:text-brand">Funciones, errores y archivos</li>
            </ol>
          </Container>
        </section>

        <section className="scroll-mt-4 py-16 lg:py-28" id="proyectos" aria-labelledby="proyectos-title">
          <Container>
            <SectionHeading
              eyebrow="Aplicación real"
              title="Aprender para construir algo útil"
              description="Estos ejemplos orientan los proyectos previstos; todavía no están disponibles para realizarse en la plataforma."
              id="proyectos-title"
            />
            <div className="grid gap-4 md:grid-cols-3">
              {projects.map((project) => (
                <article className={cardBase} key={project.title}>
                  <span className="mb-6 inline-block text-xs font-extrabold uppercase tracking-wide text-brand">{project.label}</span>
                  <h3 className="mb-3 text-xl font-bold">{project.title}</h3>
                  <p className="leading-relaxed text-muted">{project.description}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section className="pb-16 lg:pb-28" aria-labelledby="closing-title">
          <Container>
            <div className="flex flex-col gap-8 rounded-[1.25rem] bg-[#17553e] p-8 text-white lg:flex-row lg:items-end lg:justify-between lg:p-14">
              <div>
                <p className="mb-4 text-sm font-extrabold uppercase tracking-widest text-[#c3eed1]">Construcción abierta y progresiva</p>
                <h2 className="mb-4 max-w-[22ch] text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl" id="closing-title">
                  Una herramienta educativa que funcione de verdad.
                </h2>
                <p className="max-w-2xl leading-relaxed text-[#e1f3e7]">Primero construiremos la base de aprendizaje. Después llegarán las lecciones, la práctica interactiva y el seguimiento del progreso.</p>
              </div>
              <a className={`${buttonBase} shrink-0 bg-white text-[#123e2e] hover:bg-[#e5f2e8]`} href="#inicio">Volver al inicio</a>
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-sm text-muted">
        <Container className="flex flex-wrap justify-between gap-x-8 gap-y-2">
          <p><strong>PyRaíz</strong> · El conocimiento echa raíces cuando lo aplicas.</p>
          <p>Proyecto educativo en desarrollo.</p>
        </Container>
      </footer>
    </>
  );
}
