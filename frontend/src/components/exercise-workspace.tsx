"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { createBrowserRunner, ENGINE_LABELS, FIRST_LOAD_MESSAGE, formatDuration } from "@/lib/execution/browser-runner";
import { EXECUTION_CONTRACT_VERSION } from "@/lib/execution/contract";
import type { CheckResult, CheckStatus, EvaluationResult, ExerciseCheck, RunnerState } from "@/lib/execution/contract";
import type { WorkerPythonRunner } from "@/lib/execution/worker-runner";
import { fetchExercise } from "@/lib/exercises";
import type { Exercise, ExerciseLoad } from "@/lib/exercises";
import { parsePrompt } from "@/lib/prompt-text";
import { useLocalDraft } from "@/lib/use-local-draft";

const PythonCodeEditor = dynamic(() => import("@/components/python-code-editor"), {
  ssr: false,
  loading: () => <p className="min-h-80 p-4 text-sm text-muted" role="status">Cargando el editor…</p>,
});

const STATUS_LABELS: Record<CheckStatus, string> = {
  passed: "✓ Correcta",
  failed: "✗ Incorrecta",
  error: "⚠ Error",
  not_run: "– Sin ejecutar",
};

const STATUS_STYLES: Record<CheckStatus, string> = {
  passed: "border-brand bg-brand-soft",
  failed: "border-focus",
  error: "border-focus",
  not_run: "border-border",
};

function summarize(result: EvaluationResult) {
  const count = `${result.passedCount} de ${result.totalCount} pruebas correctas`;
  switch (result.status) {
    case "passed":
      return `Todas las pruebas son correctas (${count}) en ${formatDuration(result.durationMs)}.`;
    case "failed":
      return `${count}. Revisa los detalles de cada prueba.`;
    default:
      return `${result.diagnostics[0] ?? "La evaluación no terminó."} ${count}.`;
  }
}

function PromptText({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {parsePrompt(markdown).map((paragraph, index) => (
        <p key={index}>
          {paragraph.map((segment, part) => {
            if (segment.kind === "code") {
              return <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm" key={part}>{segment.text}</code>;
            }
            if (segment.kind === "emphasis") return <em key={part}>{segment.text}</em>;
            return <Fragment key={part}>{segment.text}</Fragment>;
          })}
        </p>
      ))}
    </div>
  );
}

function CheckDetails({ check, result }: { check: ExerciseCheck; result: CheckResult }) {
  return (
    <li className={`rounded-xl border-2 p-4 ${STATUS_STYLES[result.status]}`}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-extrabold">{STATUS_LABELS[result.status]}</span>
        <span className="font-semibold">{check.description}</span>
      </p>
      {check.kind === "output" && check.stdin.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Entrada para <code>input()</code>: {check.stdin.map((line) => `«${line}»`).join(", ")}
        </p>
      )}
      {check.kind === "function" && (
        <p className="mt-2 text-sm text-muted">
          Llamada: <code>{check.function_name}({check.args.map((arg) => JSON.stringify(arg)).join(", ")})</code>
        </p>
      )}
      {result.status !== "passed" && <p className="mt-2 text-sm">{result.message}</p>}
      {result.expected !== null && result.actual !== null && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Esperado</p>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-xs text-code-text">{result.expected}</pre>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Obtenido</p>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-xs text-code-text">
              {result.actual === "" ? <span className="text-code-text/70">(sin salida)</span> : result.actual}
            </pre>
          </div>
        </div>
      )}
      {result.error && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">Ver traceback</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-xs text-code-text">{result.error.traceback}</pre>
        </details>
      )}
      {result.stdout && result.status !== "passed" && result.actual === null && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">Ver salida del programa</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-xs text-code-text">{result.stdout}</pre>
        </details>
      )}
    </li>
  );
}

function ExerciseEditor({ exercise }: { exercise: Exercise }) {
  const draftKey = `pyraiz.exercise.${exercise.id}.v${exercise.version}`;
  const { code, ready, saveStatus, changeCode } = useLocalDraft(draftKey, exercise.starter_code, "Código inicial del ejercicio listo para editar.");
  const [engineState, setEngineState] = useState<RunnerState>("idle");
  const [results, setResults] = useState<Map<string, CheckResult>>(new Map());
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [status, setStatus] = useState("");
  const runnerRef = useRef<WorkerPythonRunner | null>(null);
  const counterRef = useRef(0);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const runner = createBrowserRunner(setEngineState);
    runnerRef.current = runner;
    return () => {
      runner.dispose();
      runnerRef.current = null;
    };
  }, []);

  const checkCode = useCallback(async () => {
    const runner = runnerRef.current;
    if (!runner || runner.state === "running") return;
    setResults(new Map());
    setEvaluation(null);
    setStatus(runner.state === "ready" ? "Comprobando…" : FIRST_LOAD_MESSAGE);
    counterRef.current += 1;
    const finished = await runner.evaluate(
      {
        contractVersion: EXECUTION_CONTRACT_VERSION,
        runId: `ejercicio-${counterRef.current}`,
        exerciseId: exercise.id,
        exerciseVersion: exercise.version,
        code: codeRef.current,
        checks: exercise.checks,
      },
      { onCheck: (result) => setResults((current) => new Map(current).set(result.id, result)) },
    );
    if (runnerRef.current !== runner) return;
    setEvaluation(finished);
    setResults(new Map(finished.checks.map((result) => [result.id, result])));
    setStatus(summarize(finished));
  }, [exercise]);

  function resetCode() {
    if (window.confirm("¿Volver al código inicial? Se reemplazará tu borrador de este ejercicio.")) {
      changeCode(exercise.starter_code);
    }
  }

  const running = engineState === "running";
  const buttonBase = "min-h-11 rounded-xl px-4 text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="editor-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold" id="editor-title">Tu solución</h2>
            <p className="text-xs text-muted">programa.py · 4 espacios por sangría</p>
          </div>
          <button className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-surface-muted" onClick={resetCode} type="button">
            Volver al código inicial
          </button>
        </div>
        {ready && <PythonCodeEditor onChange={changeCode} onRun={checkCode} value={code} />}
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
          <button
            aria-disabled={running}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            className={`${buttonBase} bg-[#17553e] text-white hover:bg-[#0f422f]`}
            onClick={() => void checkCode()}
            type="button"
          >
            Comprobar
          </button>
          <button
            aria-disabled={!running}
            className={`${buttonBase} border border-border hover:bg-surface-muted`}
            onClick={() => running && runnerRef.current?.cancel()}
            type="button"
          >
            Detener
          </button>
          <p className="text-xs text-muted">Atajo: Ctrl + Enter (⌘ + Enter en Mac).</p>
        </div>
        <p className="border-t border-border p-4 text-sm text-muted" role="status">{saveStatus}</p>
      </section>

      <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="results-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold" id="results-title">Pruebas</h2>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{ENGINE_LABELS[engineState]}</span>
        </div>
        <p className="mt-3 min-h-6 text-sm font-semibold" role="status">{status}</p>
        <ol className="mt-3 space-y-3" aria-label="Resultado de cada prueba">
          {exercise.checks.map((check) => {
            const result = results.get(check.id);
            return result ? (
              <CheckDetails check={check} key={check.id} result={result} />
            ) : (
              <li className="rounded-xl border-2 border-dashed border-border p-4" key={check.id}>
                <p className="font-semibold">{check.description}</p>
                <p className="mt-1 text-sm text-muted">{running ? "Pendiente…" : "Pulsa Comprobar para evaluar esta prueba."}</p>
              </li>
            );
          })}
        </ol>
        {evaluation?.status === "passed" && (
          <p className="mt-4 rounded-xl bg-brand-soft p-4 text-sm font-semibold">
            ¡Bien hecho! Tu programa supera todas las pruebas de este ejercicio.
          </p>
        )}
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Las pruebas se ejecutan en tu navegador y puedes ver qué esperan. Sirven para orientarte: el resultado todavía no se guarda ni cuenta como progreso.
        </p>
      </aside>
    </div>
  );
}

export function ExerciseWorkspace({ exerciseId }: { exerciseId: string }) {
  const [load, setLoad] = useState<ExerciseLoad | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchExercise(API_BASE, exerciseId).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => { cancelled = true; };
  }, [exerciseId]);

  if (load === null) {
    return <p className="mt-6 text-muted" role="status">Cargando el ejercicio…</p>;
  }
  if (load.status !== "ok") {
    return (
      <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-surface p-6" role="alert">
        <h1 className="text-2xl font-bold">Ejercicio no disponible</h1>
        <p className="mt-3 leading-relaxed text-muted">
          {load.status === "not_found" ? "Este ejercicio no existe o todavía no está publicado." : load.message}
        </p>
        <Link className="mt-5 inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4" href="/practicar">
          Ir a la práctica libre
        </Link>
      </div>
    );
  }

  const { exercise } = load;
  return (
    <>
      <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-brand">Ejercicio</p>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{exercise.title}</h1>
      <div className="mt-5 max-w-3xl text-lg">
        <PromptText markdown={exercise.prompt_markdown} />
      </div>
      <ExerciseEditor exercise={exercise} key={`${exercise.id}-${exercise.version}`} />
    </>
  );
}
