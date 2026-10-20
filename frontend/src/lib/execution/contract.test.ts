import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LIMITS, EXECUTION_CONTRACT_VERSION, formatCount, isWorkerResponse, validateRunRequest } from "./contract.ts";
import type { RunRequest } from "./contract.ts";

const base: RunRequest = { contractVersion: EXECUTION_CONTRACT_VERSION, runId: "r", mode: "practice", code: "print(1)" };

test("valida versión, modo y tamaño del código", () => {
  assert.equal(validateRunRequest(base, DEFAULT_LIMITS), null);
  assert.match(validateRunRequest({ ...base, contractVersion: 2 as 1 }, DEFAULT_LIMITS) ?? "", /versión/);
  assert.match(validateRunRequest({ ...base, mode: "exam" as "practice" }, DEFAULT_LIMITS) ?? "", /modo/);
  const tooLong = validateRunRequest({ ...base, code: "x".repeat(100_001) }, DEFAULT_LIMITS);
  assert.equal(tooLong, "El código supera el límite de 100 000 caracteres y no se ejecutó.");
});

test("agrupa miles con espacio fino", () => {
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(20_000), "20 000");
  assert.equal(formatCount(1_234_567), "1 234 567");
});

test("reconoce solo mensajes del worker con forma válida", () => {
  assert.equal(isWorkerResponse({ type: "ready", engine: { name: "pyodide", version: "314.0.7" } }), true);
  assert.equal(isWorkerResponse({ type: "ready" }), false);
  assert.equal(isWorkerResponse({ type: "output", runId: "r", stream: "stdout", text: 1 }), false);
  assert.equal(
    isWorkerResponse({
      type: "result",
      runId: "r",
      outcome: { status: "error", error: { type: "E", message: "m", line: 1.5, traceback: "" }, durationMs: 1, truncated: false },
    }),
    false,
  );
  assert.equal(isWorkerResponse({ type: "desconocido" }), false);
  assert.equal(isWorkerResponse(null), false);
});
