// Lectura de ejercicios publicados desde la API (contrato de ADR-0007).
// Los datos llegan por la red: se valida su forma antes de usarlos.

import type { ExerciseCheck } from "./execution/contract.ts";

export type Exercise = {
  id: string;
  lesson_id: string;
  position: number;
  title: string;
  version: number;
  prompt_markdown: string;
  starter_code: string;
  checks: ExerciseCheck[];
};

export type ExerciseLoad =
  | { status: "ok"; exercise: Exercise }
  | { status: "not_found" }
  | { status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCheck(value: unknown): value is ExerciseCheck {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.description !== "string") return false;
  if (value.kind === "output") {
    return (
      Array.isArray(value.stdin) &&
      value.stdin.every((line) => typeof line === "string") &&
      typeof value.expected_stdout === "string"
    );
  }
  if (value.kind === "function") {
    return typeof value.function_name === "string" && Array.isArray(value.args) && "expected" in value;
  }
  return false;
}

export function parseExercise(value: unknown): Exercise | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.lesson_id !== "string" ||
    !Number.isInteger(value.position) ||
    typeof value.title !== "string" ||
    !Number.isInteger(value.version) ||
    typeof value.prompt_markdown !== "string" ||
    typeof value.starter_code !== "string" ||
    !Array.isArray(value.checks) ||
    value.checks.length === 0 ||
    !value.checks.every(isCheck)
  ) {
    return null;
  }
  return value as Exercise;
}

export async function fetchExercise(
  apiBase: string,
  exerciseId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExerciseLoad> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiBase}/api/v1/curriculum/exercises/${encodeURIComponent(exerciseId)}`, {
      credentials: "omit",
    });
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
  const exercise = parseExercise(body);
  return exercise ? { status: "ok", exercise } : { status: "error", message: "El ejercicio recibido no tiene un formato válido." };
}
