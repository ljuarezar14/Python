import Link from "next/link";
import { Container } from "@/components/container";
import { LearningHeader } from "@/components/learning-header";

const stages = [
  {
    number: "01",
    title: "Rutas",
    description: "Elegirás un objetivo y verás un camino ordenado para aprender Python.",
    status: "Contenido en preparación",
  },
  {
    number: "02",
    title: "Módulos",
    description: "Cada ruta se dividirá en temas con objetivos y conocimientos previos claros.",
    status: "Contenido en preparación",
  },
  {
    number: "03",
    title: "Lecciones",
    description: "Estudiarás una idea, revisarás un ejemplo y resolverás una actividad.",
    status: "Contenido en preparación",
  },
  {
    number: "04",
    title: "Práctica",
    description: "Ya puedes escribir Python, ejecutarlo en tu navegador y conservar un borrador. Los ejercicios con pruebas automáticas aparecerán cuando se publiquen las lecciones.",
    status: "Editor y ejecución disponibles",
    href: "/practicar",
    action: "Abrir editor",
  },
  {
    number: "05",
    title: "Progreso",
    description: "Con tu cuenta, cada ejercicio que compruebes guarda tu último intento y marca los que resuelves, para que retomes tu trabajo desde cualquier dispositivo. Los proyectos llegarán más adelante.",
    status: "Disponible con tu cuenta",
    href: "/cuenta",
    action: "Ver mi progreso",
  },
] as const;

export default function LearningMapPage() {
  return (
    <>
      <LearningHeader current="map" />
      <main className="py-12 sm:py-16" id="contenido" tabIndex={-1}>
        <Container>
          <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-brand">Mapa de aprendizaje</p>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">De tu objetivo a un proyecto que puedas demostrar</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">
            Este es el camino previsto en PyRaíz. Las lecciones todavía no están publicadas; cada etapa indica con claridad qué puedes usar hoy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center rounded-xl bg-[#17553e] px-5 py-3 font-bold text-white no-underline hover:bg-[#0f422f]" href="/onboarding">Definir mi objetivo</Link>
            <Link className="inline-flex min-h-12 items-center rounded-xl border border-border bg-surface px-5 py-3 font-bold no-underline hover:bg-surface-muted" href="/practicar">Practicar con Python</Link>
          </div>

          <ol className="mt-12 grid gap-4 md:grid-cols-2" aria-label="Etapas de aprendizaje">
            {stages.map((stage) => (
              <li className="rounded-2xl border border-border bg-surface p-6 sm:p-7" key={stage.number}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-brand" aria-hidden="true">{stage.number}</span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{stage.status}</span>
                </div>
                <h2 className="text-2xl font-bold">{stage.title}</h2>
                <p className="mt-3 leading-relaxed text-muted">{stage.description}</p>
                {"href" in stage && (
                  <Link className="mt-5 inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4" href={stage.href}>
                    {stage.action}
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
            Tu recomendación inicial se basa en tus respuestas. Avanzar de etapa requerirá actividades y evidencias de aprendizaje cuando estén disponibles.
          </p>
        </Container>
      </main>
    </>
  );
}
