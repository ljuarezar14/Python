"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/api";
import { createBrowserRunner, ENGINE_LABELS, FIRST_LOAD_MESSAGE, formatDuration } from "@/lib/execution/browser-runner";
import { EXECUTION_CONTRACT_VERSION } from "@/lib/execution/contract";
import type { CheckResult, CheckStatus, EvaluationResult, ExerciseCheck, RunnerState } from "@/lib/execution/contract";
import type { WorkerPythonRunner } from "@/lib/execution/worker-runner";
import { fetchExercise } from "@/lib/exercises";
import type { Exercise, ExerciseLoad } from "@/lib/exercises";
import { attemptFromEvaluation, describeResult, fetchExerciseProgress, saveExerciseProgress } from "@/lib/progress";
import type { ExerciseProgress } from "@/lib/progress";
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

type AccountProgress =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "error"; message: string }
  | { status: "ready"; progress: ExerciseProgress | null };

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
}

function ProgressPanel({
  account,
  code,
  saveMessage,
  onLoad,
}: {
  account: AccountProgress;
  code: string;
  saveMessage: string;
  onLoad: (progress: ExerciseProgress) => void;
}) {
  let body: ReactNode;
  if (account.status === "loading") {
    body = <p className="text-muted">Consultando tu progreso…</p>;
  } else if (account.status === "signed_out") {
    body = (
      <p className="text-muted">
        <Link className="font-bold text-brand underline underline-offset-4" href="/ingresar">Ingresa</Link> para guardar tu progreso y retomarlo desde otro dispositivo.
      </p>
    );
  } else if (account.status === "error") {
    body = <p className="text-muted">No se pudo consultar tu progreso. {account.message}</p>;
  } else if (account.progress === null) {
    body = <p className="text-muted">Cuando pulses Comprobar, tu intento se guardará en tu cuenta.</p>;
  } else {
    const { progress } = account;
    body = (
      <>
        <p className="font-semibold">{describeResult(progress)}</p>
        <p className="mt-1 text-muted">
          {progress.attempts === 1 ? "1 intento" : `${progress.attempts} intentos`} · último el {formatDate(progress.updated_at)}
        </p>
        {progress.outdated && (
          <p className="mt-2 text-muted">Tu último intento es de una versión anterior de este ejercicio; vuelve a comprobarlo.</p>
        )}
        {progress.code !== code && (
          <button
            className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-surface-muted"
            onClick={() => onLoad(progress)}
            type="button"
          >
            Cargar mi último intento guardado
          </button>
        )}
      </>
    );
  }
  return (
    <section className="mt-4 rounded-xl border border-border p-4 text-sm" aria-labelledby="progress-title">
      <h3 className="font-bold" id="progress-title">Tu progreso</h3>
      <div className="mt-2">{body}</div>
      <p className="mt-2 min-h-5 text-muted" role="status">{saveMessage}</p>
    </section>
  );
}

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
  const [account, setAccount] = useState<AccountProgress>({ status: "loading" });
  const [saveMessage, setSaveMessage] = useState("");
  const runnerRef = useRef<WorkerPythonRunner | null>(null);
  const counterRef = useRef(0);
  const codeRef = useRef(code);
  const signedOutRef = useRef(false);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    signedOutRef.current = account.status === "signed_out";
  }, [account]);

  useEffect(() => {
    let cancelled = false;
    void fetchExerciseProgress(API_BASE, exercise.id).then((load) => {
      if (cancelled) return;
      if (load.status === "ok") setAccount({ status: "ready", progress: load.progress });
      else if (load.status === "none") setAccount({ status: "ready", progress: null });
      else setAccount(load);
    });
    return () => { cancelled = true; };
  }, [exercise.id]);

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
    setSaveMessage("");
    counterRef.current += 1;
    const submitted = codeRef.current;
    const finished = await runner.evaluate(
      {
        contractVersion: EXECUTION_CONTRACT_VERSION,
        runId: `ejercicio-${counterRef.current}`,
        exerciseId: exercise.id,
        exerciseVersion: exercise.version,
        code: submitted,
        checks: exercise.checks,
      },
      { onCheck: (result) => setResults((current) => new Map(current).set(result.id, result)) },
    );
    if (runnerRef.current !== runner) return;
    setEvaluation(finished);
    setResults(new Map(finished.checks.map((result) => [result.id, result])));
    setStatus(summarize(finished));

    // Sin sesión no se intenta guardar; la cookie decide en los demás casos.
    const attempt = attemptFromEvaluation(finished, submitted);
    if (!attempt || signedOutRef.current) return;
    setSaveMessage("Guardando tu intento…");
    const saved = await saveExerciseProgress(API_BASE, exercise.id, attempt);
    if (runnerRef.current !== runner) return;
    if (saved.status === "saved") {
      setAccount({ status: "ready", progress: saved.progress });
      setSaveMessage(saved.progress.solved ? "Intento guardado. Ejercicio resuelto en tu cuenta." : "Intento guardado en tu cuenta.");
    } else if (saved.status === "signed_out") {
      setAccount({ status: "signed_out" });
      setSaveMessage("Tu sesión terminó; el intento no se guardó.");
    } else if (saved.status === "outdated") {
      setSaveMessage("Este ejercicio cambió desde que abriste la página. Recárgala para ver la versión nueva; el intento no se guardó.");
    } else {
      setSaveMessage(`El intento no se guardó. ${saved.message}`);
    }
  }, [exercise]);

  function loadSaved(progress: ExerciseProgress) {
    const current = codeRef.current;
    if (
      current !== exercise.starter_code &&
      !window.confirm("¿Cargar tu último intento guardado? Se reemplazará tu borrador de este navegador.")
    ) {
      return;
    }
    changeCode(progress.code);
    setSaveMessage("Último intento cargado en el editor.");
  }

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
        <ProgressPanel account={account} code={code} onLoad={loadSaved} saveMessage={saveMessage} />
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
          Las pruebas se ejecutan en tu navegador y puedes ver qué esperan. Sirven para orientarte: si ingresas, tu último intento se guarda como progreso, pero lo calcula tu navegador y no acredita lo que sabes.
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
