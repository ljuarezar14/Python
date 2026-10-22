import assert from "node:assert/strict";
import { test } from "node:test";
import { EXECUTION_CONTRACT_VERSION } from "./execution/contract.ts";
import type { EvaluationResult } from "./execution/contract.ts";
import {
  attemptFromEvaluation,
  describeResult,
  fetchExerciseProgress,
  fetchProgressSummary,
  parseExerciseProgress,
  parseProgressSummary,
  saveExerciseProgress,
} from "./progress.ts";

const PROGRESS = {
  exercise_id: "dev-greeting",
  exercise_version: 1,
  current_version: 1,
  outdated: false,
  code: 'print("Hola")\n',
  status: "passed",
  passed_count: 1,
  total_count: 1,
  attempts: 2,
  solved: true,
  solved_at: "2026-10-21T10:00:00Z",
  updated_at: "2026-10-21T10:05:00Z",
};

const SUMMARY = {
  solved_count: 1,
  items: [
    {
      exercise_id: "dev-greeting",
      lesson_id: "dev-practice-lesson",
      title: "Saludo",
      outdated: false,
      status: "passed",
      passed_count: 1,
      total_count: 1,
      solved: true,
      updated_at: "2026-10-21T10:05:00Z",
    },
  ],
};

function evaluation(changes: Partial<EvaluationResult>): EvaluationResult {
  return {
    contractVersion: EXECUTION_CONTRACT_VERSION,
    runId: "r1",
    exerciseId: "dev-greeting",
    exerciseVersion: 3,
    status: "failed",
    checks: [],
    passedCount: 1,
    totalCount: 2,
    durationMs: 10,
    engine: null,
    diagnostics: [],
    ...changes,
  };
}

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;
}

const offline = (async () => {
  throw new TypeError("Failed to fetch");
}) as typeof fetch;

test("valida la forma del progreso y del resumen", () => {
  assert.deepEqual(parseExerciseProgress(PROGRESS), PROGRESS);
  assert.equal(parseExerciseProgress({ ...PROGRESS, status: "cancelled" }), null);
  assert.equal(parseExerciseProgress({ ...PROGRESS, passed_count: 2 }), null);
  assert.equal(parseExerciseProgress({ ...PROGRESS, code: 5 }), null);
  assert.equal(parseExerciseProgress({ ...PROGRESS, code: "x".repeat(100_001) }), null);
  assert.equal(parseExerciseProgress({ ...PROGRESS, solved_at: 0 }), null);
  assert.deepEqual(parseProgressSummary(SUMMARY), SUMMARY);
  assert.equal(parseProgressSummary({ ...SUMMARY, items: [{ ...SUMMARY.items[0], title: null }] }), null);
  assert.equal(parseProgressSummary({ solved_count: -1, items: [] }), null);
});

test("convierte solo evaluaciones que describen el programa", () => {
  assert.deepEqual(attemptFromEvaluation(evaluation({}), "x = 1"), {
    exercise_version: 3,
    code: "x = 1",
    status: "failed",
    passed_count: 1,
    total_count: 2,
  });
  assert.equal(attemptFromEvaluation(evaluation({ status: "passed", passedCount: 2 }), "")?.status, "passed");
  assert.equal(attemptFromEvaluation(evaluation({ status: "timeout", passedCount: 0 }), "")?.status, "timeout");
  for (const status of ["cancelled", "rejected", "engine_error"] as const) {
    assert.equal(attemptFromEvaluation(evaluation({ status }), ""), null);
  }
  assert.equal(attemptFromEvaluation(evaluation({ status: "passed" }), ""), null);
  assert.equal(attemptFromEvaluation(evaluation({ passedCount: 2 }), ""), null);
  assert.equal(attemptFromEvaluation(evaluation({}), "x".repeat(100_001)), null);
});

test("lee el progreso de un ejercicio con la cookie de sesión", async () => {
  const calls: [string, RequestInit | undefined][] = [];
  const recording = (async (url: string, init?: RequestInit) => {
    calls.push([url, init]);
    return new Response(JSON.stringify(PROGRESS), { status: 200 });
  }) as typeof fetch;
  assert.deepEqual(await fetchExerciseProgress("http://api", "dev greeting", recording), { status: "ok", progress: PROGRESS });
  assert.equal(calls[0][0], "http://api/api/v1/progress/exercises/dev%20greeting");
  assert.equal(calls[0][1]?.credentials, "include");

  assert.deepEqual(await fetchExerciseProgress("http://api", "x", respond(401, {})), { status: "signed_out" });
  assert.deepEqual(await fetchExerciseProgress("http://api", "x", respond(404, {})), { status: "none" });
  assert.equal((await fetchExerciseProgress("http://api", "x", respond(500, {}))).status, "error");
  assert.equal((await fetchExerciseProgress("http://api", "x", respond(200, { code: 1 }))).status, "error");
  assert.equal((await fetchExerciseProgress("http://api", "x", offline)).status, "error");
});

test("guarda un intento y traduce los rechazos", async () => {
  const calls: RequestInit[] = [];
  const recording = (async (_url: string, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response(JSON.stringify(PROGRESS), { status: 200 });
  }) as typeof fetch;
  const attempt = { exercise_version: 1, code: "x", status: "passed", passed_count: 1, total_count: 1 } as const;
  assert.deepEqual(await saveExerciseProgress("http://api", "dev-greeting", attempt, recording), {
    status: "saved",
    progress: PROGRESS,
  });
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].credentials, "include");
  assert.deepEqual(JSON.parse(String(calls[0].body)), attempt);

  assert.deepEqual(await saveExerciseProgress("http://api", "x", attempt, respond(401, {})), { status: "signed_out" });
  assert.deepEqual(await saveExerciseProgress("http://api", "x", attempt, respond(409, {})), { status: "outdated" });
  const limited = await saveExerciseProgress(
    "http://api",
    "x",
    attempt,
    respond(429, { detail: "Demasiados intentos guardados. Espera un minuto." }),
  );
  assert.deepEqual(limited, { status: "error", message: "Demasiados intentos guardados. Espera un minuto." });
  const rejected = await saveExerciseProgress("http://api", "x", attempt, respond(422, { detail: [{ msg: "<b>x</b>" }] }));
  assert.deepEqual(rejected, { status: "error", message: "La API respondió con el estado 422." });
  assert.equal((await saveExerciseProgress("http://api", "x", attempt, offline)).status, "error");
});

test("lee el resumen y describe cada resultado", async () => {
  assert.deepEqual(await fetchProgressSummary("http://api", respond(200, SUMMARY)), { status: "ok", summary: SUMMARY });
  assert.deepEqual(await fetchProgressSummary("http://api", respond(401, {})), { status: "signed_out" });
  assert.equal((await fetchProgressSummary("http://api", respond(200, "<html>"))).status, "error");

  assert.equal(describeResult({ solved: true, outdated: false, passed_count: 1, total_count: 1 }), "✓ Resuelto");
  assert.equal(describeResult({ solved: false, outdated: true, passed_count: 2, total_count: 2 }), "Versión anterior del ejercicio");
  assert.equal(describeResult({ solved: false, outdated: false, passed_count: 1, total_count: 3 }), "1 de 3 pruebas correctas");
});
