import { Container } from "@/components/container";
import { LearningHeader } from "@/components/learning-header";
import { PracticeWorkspace } from "@/components/practice-workspace";

export default function PracticePage() {
  return (
    <>
      <LearningHeader current="practice" />
      <main className="py-10 sm:py-14" id="contenido" tabIndex={-1}>
        <Container>
          <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-brand">Laboratorio de Python</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Escribe y guarda tu primer borrador</h1>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted">
            Explora la sintaxis de Python con un ejemplo inicial. Este editor todavía no ejecuta código ni evalúa respuestas; el motor llegará en PR-007.
          </p>
          <PracticeWorkspace />
        </Container>
      </main>
    </>
  );
}
