"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { API_BASE } from "@/lib/api";
import { fetchLesson, fetchModule, fetchPath, fetchPaths, LEVEL_LABELS } from "@/lib/curriculum";
import type { CatalogLoad, ExerciseSummary, LessonDetail, ModuleDetail, PathDetail, PathSummary } from "@/lib/curriculum";
import { describeResult, fetchExerciseProgress } from "@/lib/progress";

const linkClass = "font-bold text-brand underline underline-offset-4";
const cardLinkClass =
  "block rounded-2xl border border-border bg-surface p-5 no-underline hover:bg-surface-muted sm:p-6";

const lessonHref = (id: string) => `/aprender/lecciones/${encodeURIComponent(id)}`;
const moduleHref = (id: string) => `/aprender/modulos/${encodeURIComponent(id)}`;
const pathHref = (id: string) => `/aprender/rutas/${encodeURIComponent(id)}`;
const exerciseHref = (id: string) => `/practicar/ejercicios/${encodeURIComponent(id)}`;

function useCatalog<T>(loader: () => Promise<CatalogLoad<T>>, key: string): CatalogLoad<T> | null {
  const [state, setState] = useState<{ key: string; load: CatalogLoad<T> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loader().then((load) => {
      if (!cancelled) setState({ key, load });
    });
    return () => { cancelled = true; };
    // `key` identifica lo que se pide; el cargador cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.load : null;
}

function Loading({ what }: { what: string }) {
  return <p className="mt-6 text-muted" role="status">Cargando {what}…</p>;
}

function Unavailable({ title, load, back }: { title: string; load: CatalogLoad<unknown>; back: ReactNode }) {
  return (
    <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-surface p-6" role="alert">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-3 leading-relaxed text-muted">
        {load.status === "error" ? load.message : "No existe o todavía no está publicado."}
      </p>
      <p className="mt-5">{back}</p>
    </div>
  );
}

function Objectives({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6 max-w-3xl rounded-2xl border border-border bg-surface p-5" aria-labelledby="objectives-title">
      <h2 className="font-bold" id="objectives-title">Al terminar podrás</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-brand">{children}</p>;
}

export function PathCatalog() {
  const load = useCatalog(() => fetchPaths(API_BASE), "paths");
  let body: ReactNode;
  if (load === null) {
    body = <p className="text-muted" role="status">Buscando rutas publicadas…</p>;
  } else if (load.status !== "ok") {
    body = <p className="text-muted">No se pudo consultar el catálogo. {load.status === "error" ? load.message : ""}</p>;
  } else if (load.data.length === 0) {
    body = <p className="text-muted">Todavía no hay rutas publicadas. Las primeras lecciones llegarán en las próximas entregas.</p>;
  } else {
    body = (
      <ul className="grid gap-4 md:grid-cols-2">
        {load.data.map((path: PathSummary) => (
          <li key={path.id}>
            <Link className={cardLinkClass} href={pathHref(path.id)}>
              <span className="text-xl font-bold text-brand underline underline-offset-4">{path.title}</span>
              <span className="mt-2 block leading-relaxed text-muted">{path.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="mt-12" aria-labelledby="catalog-title">
      <h2 className="mb-4 text-2xl font-bold" id="catalog-title">Rutas publicadas</h2>
      {body}
    </section>
  );
}

export function PathView({ pathId }: { pathId: string }) {
  const load = useCatalog(() => fetchPath(API_BASE, pathId), pathId);
  if (load === null) return <Loading what="la ruta" />;
  if (load.status !== "ok") {
    return <Unavailable back={<Link className={linkClass} href="/aprender">Volver al mapa</Link>} load={load} title="Ruta no disponible" />;
  }
  const path: PathDetail = load.data;
  return (
    <>
      <Link className={`${linkClass} text-sm`} href="/aprender">← Mapa de aprendizaje</Link>
      <div className="mt-5"><Eyebrow>Ruta</Eyebrow></div>
      <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">{path.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{path.description}</p>
      <h2 className="mt-10 text-2xl font-bold">Módulos</h2>
      {path.modules.length === 0 ? (
        <p className="mt-3 text-muted">Esta ruta todavía no tiene módulos publicados.</p>
      ) : (
        <ol className="mt-4 grid gap-4" aria-label="Módulos de la ruta">
          {path.modules.map((item) => (
            <li key={item.id}>
              <Link className={cardLinkClass} href={moduleHref(item.id)}>
                <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
                  <span>Módulo {item.position}</span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs">{LEVEL_LABELS[item.level]}</span>
                </span>
                <span className="mt-2 block text-xl font-bold text-brand underline underline-offset-4">{item.title}</span>
                <span className="mt-2 block leading-relaxed text-muted">{item.description}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function ModuleView({ moduleId }: { moduleId: string }) {
  const load = useCatalog(() => fetchModule(API_BASE, moduleId), moduleId);
  if (load === null) return <Loading what="el módulo" />;
  if (load.status !== "ok") {
    return <Unavailable back={<Link className={linkClass} href="/aprender">Volver al mapa</Link>} load={load} title="Módulo no disponible" />;
  }
  const detail: ModuleDetail = load.data;
  const titles = new Map(detail.lessons.map((lesson) => [lesson.id, lesson.title]));
  return (
    <>
      <Link className={`${linkClass} text-sm`} href={pathHref(detail.path_id)}>← Volver a la ruta</Link>
      <div className="mt-5"><Eyebrow>Módulo {detail.position} · {LEVEL_LABELS[detail.level]}</Eyebrow></div>
      <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">{detail.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{detail.description}</p>
      <Objectives items={detail.objectives} />
      <h2 className="mt-10 text-2xl font-bold">Lecciones</h2>
      {detail.lessons.length === 0 ? (
        <p className="mt-3 text-muted">Este módulo todavía no tiene lecciones publicadas.</p>
      ) : (
        <ol className="mt-4 grid gap-4" aria-label="Lecciones del módulo">
          {detail.lessons.map((lesson) => (
            <li className="rounded-2xl border border-border bg-surface p-5 sm:p-6" key={lesson.id}>
              <p className="text-sm font-bold text-muted">Lección {lesson.position}</p>
              <h3 className="mt-1 text-xl font-bold">
                <Link className={linkClass} href={lessonHref(lesson.id)}>{lesson.title}</Link>
              </h3>
              <p className="mt-2 leading-relaxed text-muted">{lesson.summary}</p>
              {lesson.prerequisite_ids.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="font-bold">Antes conviene estudiar: </span>
                  {lesson.prerequisite_ids.map((id, index) => (
                    <span key={id}>
                      {index > 0 && ", "}
                      <Link className={linkClass} href={lessonHref(id)}>{titles.get(id) ?? "una lección de un módulo anterior"}</Link>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

type ExerciseStatuses = { status: "loading" } | { status: "signed_out" } | { status: "ready"; labels: Map<string, string> };

// Con sesión, consulta el último intento de cada ejercicio de la lección.
function useExerciseStatuses(exercises: ExerciseSummary[]): ExerciseStatuses {
  const [statuses, setStatuses] = useState<ExerciseStatuses>({ status: "loading" });
  const ids = exercises.map((exercise) => exercise.id).join("\n");
  useEffect(() => {
    let cancelled = false;
    const [first, ...rest] = ids === "" ? [] : ids.split("\n");
    async function run() {
      if (first === undefined) return;
      // La primera consulta indica si hay sesión; sin ella no se piden las demás.
      const firstLoad = await fetchExerciseProgress(API_BASE, first);
      if (cancelled) return;
      if (firstLoad.status === "signed_out") {
        setStatuses({ status: "signed_out" });
        return;
      }
      const loads = [firstLoad, ...(await Promise.all(rest.map((id) => fetchExerciseProgress(API_BASE, id))))];
      if (cancelled) return;
      const labels = new Map<string, string>();
      loads.forEach((load, index) => {
        const id = index === 0 ? first : rest[index - 1];
        if (load.status === "ok") labels.set(id, describeResult(load.progress));
        else if (load.status === "none") labels.set(id, "Sin intentos");
      });
      setStatuses({ status: "ready", labels });
    }
    void run();
    return () => { cancelled = true; };
  }, [ids]);
  return statuses;
}

function LessonExercises({ exercises }: { exercises: ExerciseSummary[] }) {
  const statuses = useExerciseStatuses(exercises);
  return (
    <section className="mt-12 max-w-3xl" aria-labelledby="exercises-title">
      <h2 className="text-2xl font-bold" id="exercises-title">Practica</h2>
      {exercises.length === 0 ? (
        <p className="mt-3 text-muted">Esta lección todavía no tiene ejercicios publicados.</p>
      ) : (
        <>
          <ol className="mt-4 space-y-3" aria-label="Ejercicios de la lección">
            {exercises.map((exercise) => {
              const label = statuses.status === "ready" ? statuses.labels.get(exercise.id) : undefined;
              return (
                <li key={exercise.id}>
                  <Link
                    className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 no-underline hover:bg-surface-muted"
                    href={exerciseHref(exercise.id)}
                  >
                    <span className="font-semibold text-brand underline underline-offset-4">
                      Ejercicio {exercise.position}: {exercise.title}
                    </span>
                    {label && <span className="text-sm text-muted">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
          {statuses.status === "signed_out" && (
            <p className="mt-3 text-sm text-muted">
              <Link className={linkClass} href="/ingresar">Ingresa</Link> para guardar tus intentos y ver aquí cuáles resolviste.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function LessonView({ lessonId }: { lessonId: string }) {
  const load = useCatalog(() => fetchLesson(API_BASE, lessonId), lessonId);
  if (load === null) return <Loading what="la lección" />;
  if (load.status !== "ok") {
    return <Unavailable back={<Link className={linkClass} href="/aprender">Volver al mapa</Link>} load={load} title="Lección no disponible" />;
  }
  const lesson: LessonDetail = load.data;
  return (
    <>
      <Link className={`${linkClass} text-sm`} href={moduleHref(lesson.module_id)}>← Volver al módulo</Link>
      <div className="mt-5"><Eyebrow>Lección {lesson.position}</Eyebrow></div>
      <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">{lesson.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{lesson.summary}</p>
      <Objectives items={lesson.objectives} />
      <article className="mt-10 max-w-3xl text-lg" aria-label="Contenido de la lección">
        <MarkdownContent markdown={lesson.content_markdown} />
      </article>
      <LessonExercises exercises={lesson.exercises} />
    </>
  );
}
