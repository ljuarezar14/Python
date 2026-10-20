import { Container } from "@/components/container";
import { ExerciseWorkspace } from "@/components/exercise-workspace";
import { LearningHeader } from "@/components/learning-header";

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <LearningHeader current="practice" />
      <main className="py-10 sm:py-14" id="contenido" tabIndex={-1}>
        <Container>
          <ExerciseWorkspace exerciseId={id} />
        </Container>
      </main>
    </>
  );
}
