"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { EXECUTION_CONTRACT_VERSION } from "@/lib/execution/contract";
import type { OutputStream, RunResult, RunnerState } from "@/lib/execution/contract";
import { WorkerPythonRunner } from "@/lib/execution/worker-runner";

const PythonCodeEditor = dynamic(() => import("@/components/python-code-editor"), {
  ssr: false,
  loading: () => <p className="min-h-80 p-4 text-sm text-muted" role="status">Cargando el editor…</p>,
});

const DRAFT_KEY = "pyraiz.python.scratchpad.v1";
const MAX_DRAFT_LENGTH = 100_000;
const STARTER_CODE = 'gastos = [12, 8, 15]\ntotal = sum(gastos)\nprint(f"Total: S/ {total}")\n';

type OutputChunk = { stream: OutputStream; text: string };

const ENGINE_LABELS: Record<RunnerState, string> = {
  idle: "Python se cargará al ejecutar",
  loading: "Cargando Python…",
  ready: "Python listo",
  running: "Ejecutando…",
  failed: "Python no pudo cargarse",
};

function formatDuration(ms: number) {
  if (ms < 10) return "menos de 0,01 s";
  return `${(ms / 1000).toLocaleString("es", { maximumFractionDigits: 2 })} s`;
}

function summarize(result: RunResult) {
  const notes = result.status === "success" || result.status === "error" ? result.diagnostics.join(" ") : "";
  switch (result.status) {
    case "success":
      return `Ejecución terminada en ${formatDuration(result.durationMs)}. ${notes}`.trim();
    case "error": {
      const where = result.error?.line ? ` en la línea ${result.error.line}` : "";
      return `Error de Python${where}: ${result.error?.type ?? "desconocido"}. ${notes}`.trim();
    }
    default:
      return result.diagnostics[0] ?? "La ejecución no terminó.";
  }
}

function appendChunk(chunks: OutputChunk[], stream: OutputStream, text: string) {
  const last = chunks.at(-1);
  if (last?.stream === stream) return [...chunks.slice(0, -1), { stream, text: last.text + text }];
  return [...chunks, { stream, text }];
}

export function PracticeWorkspace() {
  const [code, setCode] = useState(STARTER_CODE);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Cargando borrador…");
  const [engineState, setEngineState] = useState<RunnerState>("idle");
  const [output, setOutput] = useState<OutputChunk[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runStatus, setRunStatus] = useState("");
  const runnerRef = useRef<WorkerPythonRunner | null>(null);
  const runCounterRef = useRef(0);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const runner = new WorkerPythonRunner({
      // Pyodide exige un worker de módulo; se compila aparte con tsconfig.worker.json.
      createWorker: () => new Worker("/execution/python-worker.js", { type: "module" }),
      onStateChange: setEngineState,
    });
    runnerRef.current = runner;
    return () => {
      runner.dispose();
      runnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (saved !== null && saved.length <= MAX_DRAFT_LENGTH) {
          setCode(saved);
          setSaveStatus("Borrador recuperado de este navegador.");
        } else {
          setSaveStatus("Ejemplo inicial listo para editar.");
        }
      } catch {
        setSaveStatus("El almacenamiento del navegador no está disponible.");
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (code.length > MAX_DRAFT_LENGTH) {
        setSaveStatus("El borrador supera el límite de 100 000 caracteres y no se guardó.");
        return;
      }
      try {
        window.localStorage.setItem(DRAFT_KEY, code);
        setSaveStatus("Borrador guardado en este navegador.");
      } catch {
        setSaveStatus("No se pudo guardar el borrador en este navegador.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [code, ready]);

  const runCode = useCallback(async () => {
    const runner = runnerRef.current;
    if (!runner || runner.state === "running") return;
    setOutput([]);
    setResult(null);
    setRunStatus(
      runner.state === "ready"
        ? "Ejecutando…"
        : "Preparando Python. La primera vez descarga varios megabytes y puede tardar.",
    );
    runCounterRef.current += 1;
    const finished = await runner.run(
      {
        contractVersion: EXECUTION_CONTRACT_VERSION,
        runId: `practica-${runCounterRef.current}`,
        mode: "practice",
        code: codeRef.current,
      },
      { onOutput: (stream, text) => setOutput((chunks) => appendChunk(chunks, stream, text)) },
    );
    if (runnerRef.current !== runner) return;
    setResult(finished);
    setRunStatus(summarize(finished));
  }, []);

  function stopCode() {
    if (engineState !== "running") return;
    runnerRef.current?.cancel();
  }

  async function restartPython() {
    const runner = runnerRef.current;
    if (!runner) return;
    setOutput([]);
    setResult(null);
    setRunStatus("Reiniciando Python…");
    try {
      await runner.restart();
      setRunStatus("Python se reinició. Las variables y módulos anteriores se borraron.");
    } catch (error) {
      setRunStatus((error as Error).message);
    }
  }

  function changeCode(next: string) {
    setCode(next);
    setSaveStatus("Guardando borrador…");
  }

  function resetCode() {
    if (window.confirm("¿Restablecer el ejemplo? Se reemplazará tu borrador actual.")) {
      setCode(STARTER_CODE);
      setSaveStatus("Guardando borrador…");
    }
  }

  const running = engineState === "running";
  const buttonBase = "min-h-11 rounded-xl px-4 text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="editor-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold" id="editor-title">Editor de Python</h2>
            <p className="text-xs text-muted">ejemplo.py · 4 espacios por sangría</p>
          </div>
          <button
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-surface-muted"
            onClick={resetCode}
            type="button"
          >
            Restablecer ejemplo
          </button>
        </div>
        {ready && <PythonCodeEditor onChange={changeCode} onRun={runCode} value={code} />}
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
          <button
            aria-disabled={running}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            className={`${buttonBase} bg-[#17553e] text-white hover:bg-[#0f422f]`}
            onClick={() => void runCode()}
            type="button"
          >
            Ejecutar
          </button>
          <button
            aria-disabled={!running}
            className={`${buttonBase} border border-border hover:bg-surface-muted`}
            onClick={stopCode}
            type="button"
          >
            Detener
          </button>
          <button
            className={`${buttonBase} border border-border hover:bg-surface-muted`}
            onClick={() => void restartPython()}
            type="button"
          >
            Reiniciar Python
          </button>
          <p className="text-xs text-muted">Atajo: Ctrl + Enter (⌘ + Enter en Mac).</p>
        </div>
        <p className="border-t border-border p-4 text-sm text-muted" role="status">{saveStatus}</p>
      </section>

      <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="console-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold" id="console-title">Consola</h2>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{ENGINE_LABELS[engineState]}</span>
        </div>
        <p className="mt-3 min-h-6 text-sm font-semibold" role="status">{runStatus}</p>
        <pre
          aria-label="Salida del programa"
          className="mt-3 max-h-96 min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-code p-5 font-mono text-sm leading-relaxed text-code-text"
          tabIndex={0}
        >
          {output.length === 0 ? (
            <span className="text-code-text/70">{result ? "(El programa no mostró salida.)" : "Pulsa Ejecutar para ver aquí la salida de tu programa."}</span>
          ) : (
            output.map((chunk, index) => (
              <span className={chunk.stream === "stderr" ? "text-code-error" : undefined} key={index}>{chunk.text}</span>
            ))
          )}
        </pre>
        {result?.error && (
          <div className="mt-4 rounded-xl border border-border p-4">
            <h3 className="text-sm font-bold">
              {result.error.type}{result.error.line ? ` · línea ${result.error.line}` : ""}
            </h3>
            <p className="mt-1 break-words text-sm">{result.error.message}</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">Ver traceback completo</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-xs text-code-text">{result.error.traceback}</pre>
            </details>
          </div>
        )}
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Python se ejecuta en tu navegador con Pyodide; tu código no se envía al servidor. Cada ejecución empieza con variables limpias y se detiene a los 10 segundos. <code>input()</code> todavía no está disponible.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          El código se guarda solo en este navegador y puede perderse si borras sus datos. No escribas contraseñas ni otros secretos en un equipo compartido. La consola no evalúa ejercicios ni registra progreso.
        </p>
      </aside>
    </div>
  );
}
