import { LessonView } from "@/components/catalog-views";
import { Container } from "@/components/container";
import { LearningHeader } from "@/components/learning-header";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <LearningHeader current="map" />
      <main className="py-10 sm:py-14" id="contenido" tabIndex={-1}>
        <Container>
          <LessonView lessonId={id} />
        </Container>
      </main>
    </>
  );
}
