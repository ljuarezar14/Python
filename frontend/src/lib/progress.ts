// Progreso autodeclarado por ejercicio (ADR-0008). La API identifica a la
// persona por la cookie de sesión; los datos recibidos se validan antes de usarse.

import type { EvaluationResult } from "./execution/contract.ts";

export type AttemptStatus = "passed" | "failed" | "timeout";

export type Attempt = {
  exercise_version: number;
  code: string;
  status: AttemptStatus;
  passed_count: number;
  total_count: number;
};

export type ExerciseProgress = {
  exercise_id: string;
  exercise_version: number;
  current_version: number;
  outdated: boolean;
  code: string;
  status: AttemptStatus;
  passed_count: number;
  total_count: number;
  attempts: number;
  solved: boolean;
  solved_at: string | null;
  updated_at: string;
};

export type ProgressItem = {
  exercise_id: string;
  lesson_id: string;
  title: string;
  outdated: boolean;
  status: AttemptStatus;
  passed_count: number;
  total_count: number;
  solved: boolean;
  updated_at: string;
};

export type ProgressSummary = { solved_count: number; items: ProgressItem[] };

export type ProgressLoad =
  | { status: "ok"; progress: ExerciseProgress }
  | { status: "none" }
  | { status: "signed_out" }
  | { status: "error"; message: string };

export type ProgressSave =
  | { status: "saved"; progress: ExerciseProgress }
  | { status: "signed_out" }
  | { status: "outdated" }
  | { status: "error"; message: string };

export type SummaryLoad =
  | { status: "ok"; summary: ProgressSummary }
  | { status: "signed_out" }
  | { status: "error"; message: string };

const MAX_CODE_CHARS = 100_000;
const STATUSES: readonly string[] = ["passed", "failed", "timeout"];
const OFFLINE = "No se pudo conectar con la API. Revisa que el backend esté en marcha.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function hasResult(value: Record<string, unknown>): boolean {
  return (
    typeof value.exercise_id === "string" &&
    typeof value.outdated === "boolean" &&
    typeof value.status === "string" &&
    STATUSES.includes(value.status) &&
    isCount(value.passed_count) &&
    isCount(value.total_count) &&
    (value.passed_count as number) <= (value.total_count as number) &&
    typeof value.solved === "boolean" &&
    typeof value.updated_at === "string"
  );
}

export function parseExerciseProgress(value: unknown): ExerciseProgress | null {
  if (
    !isRecord(value) ||
    !hasResult(value) ||
    !isCount(value.exercise_version) ||
    !isCount(value.current_version) ||
    typeof value.code !== "string" ||
    value.code.length > MAX_CODE_CHARS ||
    !isCount(value.attempts) ||
    !(value.solved_at === null || typeof value.solved_at === "string")
  ) {
    return null;
  }
  return value as ExerciseProgress;
}

export function parseProgressSummary(value: unknown): ProgressSummary | null {
  if (
    !isRecord(value) ||
    !isCount(value.solved_count) ||
    !Array.isArray(value.items) ||
    !value.items.every(
      (item) => isRecord(item) && hasResult(item) && typeof item.lesson_id === "string" && typeof item.title === "string",
    )
  ) {
    return null;
  }
  return value as ProgressSummary;
}

// Solo los resultados que describen el programa se guardan; cancelar o un fallo
// del motor no dicen nada del código del estudiante.
export function attemptFromEvaluation(result: EvaluationResult, code: string): Attempt | null {
  if (result.status !== "passed" && result.status !== "failed" && result.status !== "timeout") return null;
  if ((result.status === "passed") !== (result.passedCount === result.totalCount)) return null;
  if (result.totalCount < 1 || code.length > MAX_CODE_CHARS) return null;
  return {
    exercise_version: result.exerciseVersion,
    code,
    status: result.status,
    passed_count: result.passedCount,
    total_count: result.totalCount,
  };
}

function progressUrl(apiBase: string, exerciseId: string) {
  return `${apiBase}/api/v1/progress/exercises/${encodeURIComponent(exerciseId)}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function errorMessage(response: Response): Promise<string> {
  const body = await readJson(response);
  if (response.status === 429 && isRecord(body) && typeof body.detail === "string") return body.detail;
  return `La API respondió con el estado ${response.status}.`;
}

export async function fetchExerciseProgress(
  apiBase: string,
  exerciseId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProgressLoad> {
  let response: Response;
  try {
    response = await fetchImpl(progressUrl(apiBase, exerciseId), { credentials: "include" });
  } catch {
    return { status: "error", message: OFFLINE };
  }
  if (response.status === 401) return { status: "signed_out" };
  if (response.status === 404) return { status: "none" };
  if (!response.ok) return { status: "error", message: await errorMessage(response) };
  const progress = parseExerciseProgress(await readJson(response));
  return progress ? { status: "ok", progress } : { status: "error", message: "El progreso recibido no tiene un formato válido." };
}

export async function saveExerciseProgress(
  apiBase: string,
  exerciseId: string,
  attempt: Attempt,
  fetchImpl: typeof fetch = fetch,
): Promise<ProgressSave> {
  let response: Response;
  try {
    response = await fetchImpl(progressUrl(apiBase, exerciseId), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
    });
  } catch {
    return { status: "error", message: OFFLINE };
  }
  if (response.status === 401) return { status: "signed_out" };
  if (response.status === 409) return { status: "outdated" };
  if (!response.ok) return { status: "error", message: await errorMessage(response) };
  const progress = parseExerciseProgress(await readJson(response));
  return progress ? { status: "saved", progress } : { status: "error", message: "El progreso guardado no tiene un formato válido." };
}

export async function fetchProgressSummary(apiBase: string, fetchImpl: typeof fetch = fetch): Promise<SummaryLoad> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiBase}/api/v1/progress`, { credentials: "include" });
  } catch {
    return { status: "error", message: OFFLINE };
  }
  if (response.status === 401) return { status: "signed_out" };
  if (!response.ok) return { status: "error", message: await errorMessage(response) };
  const summary = parseProgressSummary(await readJson(response));
  return summary ? { status: "ok", summary } : { status: "error", message: "El resumen recibido no tiene un formato válido." };
}

export function describeResult(item: Pick<ProgressItem, "solved" | "outdated" | "passed_count" | "total_count">): string {
  if (item.solved) return "✓ Resuelto";
  if (item.outdated) return "Versión anterior del ejercicio";
  return `${item.passed_count} de ${item.total_count} pruebas correctas`;
}
