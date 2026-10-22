// Lectura del catálogo publicado (ADR-0004): rutas, módulos y lecciones.
// La API es pública y no necesita la cookie; los datos se validan antes de usarse.

export type PathSummary = { id: string; title: string; description: string; version: number };

export type ModuleLevel = "basic" | "intermediate" | "advanced";

export type ModuleSummary = {
  id: string;
  path_id: string;
  position: number;
  level: ModuleLevel;
  title: string;
  description: string;
  objectives: string[];
  version: number;
};

export type LessonSummary = {
  id: string;
  module_id: string;
  position: number;
  title: string;
  summary: string;
  objectives: string[];
  prerequisite_ids: string[];
  version: number;
};

export type ExerciseSummary = { id: string; position: number; title: string; version: number };

export type PathDetail = PathSummary & { modules: ModuleSummary[] };
export type ModuleDetail = ModuleSummary & { lessons: LessonSummary[] };
export type LessonDetail = LessonSummary & { content_markdown: string; exercises: ExerciseSummary[] };

export type CatalogLoad<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "error"; message: string };

export const LEVEL_LABELS: Record<ModuleLevel, string> = {
  basic: "Básico",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

// Suficiente para el catálogo previsto del MVP; la API admite como máximo 100.
const PATHS_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositive(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPath(value: unknown): value is PathSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    isPositive(value.version)
  );
}

function isModule(value: unknown): value is ModuleSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.path_id === "string" &&
    isPositive(value.position) &&
    typeof value.level === "string" &&
    Object.hasOwn(LEVEL_LABELS, value.level) &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    isTextList(value.objectives) &&
    isPositive(value.version)
  );
}

function isLesson(value: unknown): value is LessonSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.module_id === "string" &&
    isPositive(value.position) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isTextList(value.objectives) &&
    isTextList(value.prerequisite_ids) &&
    isPositive(value.version)
  );
}

function isExercise(value: unknown): value is ExerciseSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isPositive(value.position) &&
    typeof value.title === "string" &&
    isPositive(value.version)
  );
}

export function parsePaths(value: unknown): PathSummary[] | null {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isPath) ? value.items : null;
}

// Los detalles amplían el resumen: primero se comprueba el resumen y luego sus listas.
export function parsePathDetail(value: unknown): PathDetail | null {
  if (!isPath(value)) return null;
  const { modules } = value as Record<string, unknown>;
  return Array.isArray(modules) && modules.every(isModule) ? (value as PathDetail) : null;
}

export function parseModuleDetail(value: unknown): ModuleDetail | null {
  if (!isModule(value)) return null;
  const { lessons } = value as Record<string, unknown>;
  return Array.isArray(lessons) && lessons.every(isLesson) ? (value as ModuleDetail) : null;
}

export function parseLessonDetail(value: unknown): LessonDetail | null {
  if (!isLesson(value)) return null;
  const { content_markdown: content, exercises } = value as Record<string, unknown>;
  return typeof content === "string" && Array.isArray(exercises) && exercises.every(isExercise)
    ? (value as LessonDetail)
    : null;
}

async function load<T>(url: string, parse: (value: unknown) => T | null, fetchImpl: typeof fetch): Promise<CatalogLoad<T>> {
  let response: Response;
  try {
    response = await fetchImpl(url, { credentials: "omit" });
  } catch {
    return { status: "error", message: "No se pudo conectar con la API. Revisa que el backend esté en marcha." };
  }
  if (response.status === 404) return { status: "not_found" };
  if (!response.ok) return { status: "error", message: `La API respondió con el estado ${response.status}.` };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", message: "La API devolvió una respuesta que no es JSON." };
  }
  const data = parse(body);
  return data === null ? { status: "error", message: "El contenido recibido no tiene un formato válido." } : { status: "ok", data };
}

function curriculumUrl(apiBase: string, kind: "paths" | "modules" | "lessons", id: string) {
  return `${apiBase}/api/v1/curriculum/${kind}/${encodeURIComponent(id)}`;
}

export function fetchPaths(apiBase: string, fetchImpl: typeof fetch = fetch) {
  return load(`${apiBase}/api/v1/curriculum/paths?limit=${PATHS_LIMIT}`, parsePaths, fetchImpl);
}

export function fetchPath(apiBase: string, pathId: string, fetchImpl: typeof fetch = fetch) {
  return load(curriculumUrl(apiBase, "paths", pathId), parsePathDetail, fetchImpl);
}

export function fetchModule(apiBase: string, moduleId: string, fetchImpl: typeof fetch = fetch) {
  return load(curriculumUrl(apiBase, "modules", moduleId), parseModuleDetail, fetchImpl);
}

export function fetchLesson(apiBase: string, lessonId: string, fetchImpl: typeof fetch = fetch) {
  return load(curriculumUrl(apiBase, "lessons", lessonId), parseLessonDetail, fetchImpl);
}
