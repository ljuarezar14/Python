// Web Worker que aloja Pyodide. Mantiene el hilo de la interfaz libre mientras
// Python se ejecuta; el hilo principal lo termina ante cancelación o tiempo límite.

import type { loadPyodide as LoadPyodide } from "pyodide";
import type { ExerciseCheck, WorkerRequest, WorkerResponse } from "./contract.ts";
import { preparePyodide } from "./python-harness.ts";
import { hardenWorkerScope } from "./worker-hardening.ts";

type WorkerScope = {
  location: { origin: string };
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const scope = globalThis as unknown as WorkerScope;
// Los archivos de Pyodide se copian a public/pyodide desde node_modules (scripts/copy-pyodide.mjs).
// Este archivo se compila a public/execution con tsconfig.worker.json: Pyodide no admite
// workers clásicos y el empaquetador de Next.js los crea sin type: "module".
const indexURL = new URL("/pyodide/", scope.location.origin).href;

let harness: ReturnType<typeof preparePyodide> | null = null;
let initializing = false;

async function initialize() {
  if (harness || initializing) return;
  initializing = true;
  try {
    const moduleURL = `${indexURL}pyodide.mjs`;
    const { loadPyodide } = (await import(moduleURL)) as {
      loadPyodide: typeof LoadPyodide;
    };
    const pyodide = await loadPyodide({ indexURL, fullStdLib: false });
    harness = preparePyodide(pyodide);
    hardenWorkerScope(globalThis);
    scope.postMessage({ type: "ready", engine: { name: "pyodide", version: pyodide.version } });
  } catch {
    scope.postMessage({ type: "init-error", message: "No se pudo cargar el motor de Python." });
  } finally {
    initializing = false;
  }
}

function notReady() {
  scope.postMessage({ type: "init-error", message: "El motor de Python no está listo." });
}

function run(runId: string, code: string, maxOutputChars: number) {
  if (!harness) return notReady();
  const outcome = harness.run(code, maxOutputChars, (stream, text) => {
    scope.postMessage({ type: "output", runId, stream, text });
  });
  scope.postMessage({ type: "result", runId, outcome });
}

// Cada resultado se envía al terminar su prueba: si un bucle infinito agota el
// tiempo, el hilo principal conserva las pruebas ya evaluadas.
function evaluate(runId: string, code: string, checks: ExerciseCheck[], maxOutputChars: number) {
  if (!harness) return notReady();
  const started = performance.now();
  for (const check of checks) {
    scope.postMessage({ type: "check", runId, result: harness.evaluateCheck(code, check, maxOutputChars) });
  }
  scope.postMessage({ type: "evaluation-done", runId, durationMs: Math.round(performance.now() - started) });
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === "init") {
    void initialize();
  } else if (message.type === "run") {
    run(message.runId, message.code, message.maxOutputChars);
  } else if (message.type === "evaluate") {
    evaluate(message.runId, message.code, message.checks, message.maxOutputChars);
  }
};
