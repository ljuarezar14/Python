// Runner del navegador compartido por la práctica libre y los ejercicios.

import type { RunnerState } from "./contract.ts";
import { WorkerPythonRunner } from "./worker-runner.ts";

export const ENGINE_LABELS: Record<RunnerState, string> = {
  idle: "Python se cargará al ejecutar",
  loading: "Cargando Python…",
  ready: "Python listo",
  running: "Ejecutando…",
  failed: "Python no pudo cargarse",
};

export function formatDuration(ms: number) {
  if (ms < 10) return "menos de 0,01 s";
  return `${(ms / 1000).toLocaleString("es", { maximumFractionDigits: 2 })} s`;
}

export const FIRST_LOAD_MESSAGE = "Preparando Python. La primera vez descarga varios megabytes y puede tardar.";

export function createBrowserRunner(onStateChange: (state: RunnerState) => void) {
  return new WorkerPythonRunner({
    // Pyodide exige un worker de módulo; se compila aparte con tsconfig.worker.json.
    createWorker: () => new Worker("/execution/python-worker.js", { type: "module" }),
    onStateChange,
  });
}
