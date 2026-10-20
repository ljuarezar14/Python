// Implementación de PythonRunner sobre un Web Worker. La cancelación y el tiempo
// límite terminan el worker: es la única forma fiable de cortar un bucle infinito
// sin aislamiento entre orígenes (SharedArrayBuffer).

import {
  DEFAULT_LIMITS,
  EXECUTION_CONTRACT_VERSION,
  formatCount,
  isWorkerResponse,
  validateEvaluationRequest,
  validateRunRequest,
} from "./contract.ts";
import type {
  CheckResult,
  EngineInfo,
  EvaluateOptions,
  EvaluationRequest,
  EvaluationResult,
  EvaluationStatus,
  ExecutionLimits,
  PythonRunner,
  RunOptions,
  RunRequest,
  RunResult,
  RunStatus,
  RunnerState,
  WorkerRequest,
  WorkerRunOutcome,
} from "./contract.ts";

export type WorkerLike = {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

type WorkerRunnerOptions = {
  createWorker: () => WorkerLike;
  limits?: Partial<ExecutionLimits>;
  onStateChange?: (state: RunnerState) => void;
};

type ActiveRun = {
  kind: "run";
  runId: string;
  request: RunRequest;
  options: RunOptions;
  stdout: string;
  stderr: string;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (result: RunResult) => void;
};

type ActiveEvaluation = {
  kind: "evaluate";
  runId: string;
  request: EvaluationRequest;
  options: EvaluateOptions;
  results: Map<string, CheckResult>;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (result: EvaluationResult) => void;
};

type ActiveJob = ActiveRun | ActiveEvaluation;

// Estados que terminan cualquier tarea desde el hilo principal.
type AbortStatus = "timeout" | "cancelled" | "engine_error";

type Loading = {
  worker: WorkerLike;
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const BUSY_MESSAGE = "Ya hay una ejecución en curso. Espera a que termine o detenla.";

export function notRunResult(id: string): CheckResult {
  return {
    id,
    status: "not_run",
    message: "Esta prueba no llegó a ejecutarse.",
    expected: null,
    actual: null,
    firstDifferentLine: null,
    stdout: "",
    error: null,
    truncated: false,
  };
}

export class WorkerPythonRunner implements PythonRunner {
  readonly limits: ExecutionLimits;
  private readonly createWorker: () => WorkerLike;
  private readonly onStateChange?: (state: RunnerState) => void;
  private worker: WorkerLike | null = null;
  private engine: EngineInfo | null = null;
  private loading: Loading | null = null;
  private active: ActiveJob | null = null;
  private currentState: RunnerState = "idle";

  constructor(options: WorkerRunnerOptions) {
    this.createWorker = options.createWorker;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.onStateChange = options.onStateChange;
  }

  get state(): RunnerState {
    return this.currentState;
  }

  run(request: RunRequest, options: RunOptions = {}): Promise<RunResult> {
    const startedAt = Date.now();
    const invalid = validateRunRequest(request, this.limits);
    if (invalid) return Promise.resolve(this.runResult(request.runId, "rejected", startedAt, { diagnostics: [invalid] }));
    if (this.active) {
      return Promise.resolve(this.runResult(request.runId, "rejected", startedAt, { diagnostics: [BUSY_MESSAGE] }));
    }
    return new Promise<RunResult>((resolve) => {
      const job: ActiveRun = {
        kind: "run",
        runId: request.runId,
        request,
        options,
        stdout: "",
        stderr: "",
        startedAt,
        timer: null,
        resolve,
      };
      void this.start(job, {
        type: "run",
        runId: request.runId,
        code: request.code,
        maxOutputChars: this.limits.maxOutputChars,
      });
    });
  }

  evaluate(request: EvaluationRequest, options: EvaluateOptions = {}): Promise<EvaluationResult> {
    const startedAt = Date.now();
    const invalid = validateEvaluationRequest(request, this.limits);
    const busy = this.active ? BUSY_MESSAGE : null;
    if (invalid || busy) {
      return Promise.resolve(
        this.evaluationResult(request, new Map(), "rejected", startedAt, [invalid ?? busy ?? ""]),
      );
    }
    return new Promise<EvaluationResult>((resolve) => {
      const job: ActiveEvaluation = {
        kind: "evaluate",
        runId: request.runId,
        request,
        options,
        results: new Map(),
        startedAt,
        timer: null,
        resolve,
      };
      void this.start(job, {
        type: "evaluate",
        runId: request.runId,
        code: request.code,
        checks: request.checks,
        maxOutputChars: this.limits.maxOutputChars,
      });
    });
  }

  // Inicia la carga del motor sin ejecutar código.
  preload(): Promise<void> {
    return this.ensureLoaded();
  }

  cancel(): void {
    if (!this.active) return;
    this.abort("cancelled", "Ejecución detenida por la persona usuaria.");
    this.resetWorker();
  }

  async restart(): Promise<void> {
    if (this.active) this.abort("cancelled", "Python se reinició durante la ejecución.");
    this.resetWorker();
    await this.ensureLoaded();
  }

  dispose(): void {
    if (this.active) this.abort("cancelled", "La práctica se cerró.");
    this.stopWorker();
    this.setState("idle");
  }

  private async start(job: ActiveJob, message: WorkerRequest) {
    this.active = job;
    this.setState("running");
    try {
      await this.ensureLoaded();
    } catch (error) {
      if (this.active === job) this.abort("engine_error", (error as Error).message);
      return;
    }
    if (this.active !== job || !this.worker) return;

    job.startedAt = Date.now();
    job.timer = setTimeout(() => {
      if (this.active !== job) return;
      const seconds = Math.round(this.limits.runTimeoutMs / 1000);
      const what = job.kind === "run" ? "La ejecución" : "La evaluación";
      this.abort("timeout", `${what} superó ${seconds} s y se detuvo. Revisa si hay un bucle que no termina.`);
      this.resetWorker();
    }, this.limits.runTimeoutMs);
    this.worker.postMessage(message);
  }

  private ensureLoaded(): Promise<void> {
    if (this.worker && this.engine) return Promise.resolve();
    if (this.loading) return this.loading.promise;

    let worker: WorkerLike;
    try {
      worker = this.createWorker();
    } catch {
      this.setState("failed");
      return Promise.reject(new Error("Este navegador no pudo iniciar el motor de Python."));
    }
    this.worker = worker;
    this.engine = null;
    if (!this.active) this.setState("loading");

    let resolve: () => void = () => undefined;
    let reject: (reason: Error) => void = () => undefined;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const timer = setTimeout(() => {
      this.failLoading("Python tardó demasiado en cargar. Revisa tu conexión y vuelve a intentarlo.");
    }, this.limits.loadTimeoutMs);
    this.loading = { worker, promise, resolve, reject, timer };

    worker.onmessage = (event) => this.handleMessage(worker, event.data);
    worker.onerror = () => this.handleWorkerError(worker);
    worker.postMessage({ type: "init" });
    // Evita un rechazo no observado cuando nadie espera esta carga.
    promise.catch(() => undefined);
    return promise;
  }

  private handleMessage(worker: WorkerLike, data: unknown) {
    if (worker !== this.worker || !isWorkerResponse(data)) return;
    const job = this.active;
    switch (data.type) {
      case "ready":
        if (!this.loading || this.loading.worker !== worker) return;
        this.engine = data.engine;
        clearTimeout(this.loading.timer);
        this.loading.resolve();
        this.loading = null;
        if (!this.active) this.setState("ready");
        return;
      case "init-error":
        if (this.loading?.worker === worker) {
          this.failLoading(data.message);
        } else if (this.active) {
          this.abort("engine_error", data.message);
          this.resetWorker();
        }
        return;
      case "output":
        if (job?.kind === "run" && job.runId === data.runId) this.appendOutput(job, data.stream, data.text);
        return;
      case "result":
        if (job?.kind === "run" && job.runId === data.runId) this.finishRunFromWorker(job, data.outcome);
        return;
      case "check":
        if (job?.kind === "evaluate" && job.runId === data.runId) this.recordCheck(job, data.result);
        return;
      case "evaluation-done":
        if (job?.kind === "evaluate" && job.runId === data.runId) {
          const allPassed = job.request.checks.every((check) => job.results.get(check.id)?.status === "passed");
          this.finishEvaluation(allPassed ? "passed" : "failed", [], data.durationMs);
          this.setState("ready");
        }
        return;
    }
  }

  private appendOutput(job: ActiveRun, stream: "stdout" | "stderr", text: string) {
    // El worker ya aplica el límite; se repite aquí por si recibe mensajes inesperados.
    const used = job.stdout.length + job.stderr.length;
    const chunk = text.slice(0, Math.max(0, this.limits.maxOutputChars - used));
    if (!chunk) return;
    if (stream === "stdout") job.stdout += chunk;
    else job.stderr += chunk;
    job.options.onOutput?.(stream, chunk);
  }

  private recordCheck(job: ActiveEvaluation, result: CheckResult) {
    // Solo se aceptan resultados de pruebas solicitadas y una vez cada una.
    const expected = job.request.checks.some((check) => check.id === result.id);
    if (!expected || job.results.has(result.id) || result.status === "not_run") return;
    job.results.set(result.id, result);
    job.options.onCheck?.(result);
  }

  private finishRunFromWorker(job: ActiveRun, outcome: WorkerRunOutcome) {
    const diagnostics: string[] = [];
    if (outcome.truncated) {
      diagnostics.push(`La salida superó ${formatCount(this.limits.maxOutputChars)} caracteres y se recortó.`);
    }
    this.finishRun(outcome.status, {
      error: outcome.error,
      durationMs: outcome.durationMs,
      truncated: outcome.truncated,
      diagnostics,
    });
    this.setState("ready");
  }

  private handleWorkerError(worker: WorkerLike) {
    if (worker !== this.worker) return;
    if (this.loading?.worker === worker) {
      this.failLoading("No se pudo cargar el motor de Python.");
      return;
    }
    if (this.active) this.abort("engine_error", "El motor de Python se detuvo inesperadamente.");
    this.resetWorker();
  }

  private failLoading(message: string) {
    const loading = this.loading;
    if (!loading) return;
    clearTimeout(loading.timer);
    this.loading = null;
    this.stopWorker();
    this.setState("failed");
    loading.reject(new Error(message));
  }

  private abort(status: AbortStatus, diagnostic: string) {
    if (this.active?.kind === "run") this.finishRun(status, { diagnostics: [diagnostic] });
    else if (this.active?.kind === "evaluate") this.finishEvaluation(status, [diagnostic]);
  }

  private finishRun(
    status: RunStatus,
    details: { error?: RunResult["error"]; durationMs?: number; truncated?: boolean; diagnostics: string[] },
  ) {
    const job = this.active;
    if (job?.kind !== "run") return;
    if (job.timer) clearTimeout(job.timer);
    this.active = null;
    job.resolve({
      ...this.runResult(job.runId, status, job.startedAt, details),
      stdout: job.stdout,
      stderr: job.stderr,
      truncated: details.truncated ?? false,
    });
  }

  private finishEvaluation(status: EvaluationStatus, diagnostics: string[], durationMs?: number) {
    const job = this.active;
    if (job?.kind !== "evaluate") return;
    if (job.timer) clearTimeout(job.timer);
    this.active = null;
    job.resolve(this.evaluationResult(job.request, job.results, status, job.startedAt, diagnostics, durationMs));
  }

  private runResult(
    runId: string,
    status: RunStatus,
    startedAt: number,
    details: { error?: RunResult["error"]; durationMs?: number; diagnostics: string[] },
  ): RunResult {
    return {
      contractVersion: EXECUTION_CONTRACT_VERSION,
      runId,
      status,
      stdout: "",
      stderr: "",
      error: details.error ?? null,
      durationMs: details.durationMs ?? Date.now() - startedAt,
      truncated: false,
      engine: this.engine,
      diagnostics: details.diagnostics,
    };
  }

  private evaluationResult(
    request: EvaluationRequest,
    received: Map<string, CheckResult>,
    status: EvaluationStatus,
    startedAt: number,
    diagnostics: string[],
    durationMs?: number,
  ): EvaluationResult {
    const checks = (Array.isArray(request.checks) ? request.checks : []).map(
      (check) => received.get(check.id) ?? notRunResult(check.id),
    );
    return {
      contractVersion: EXECUTION_CONTRACT_VERSION,
      runId: request.runId,
      exerciseId: request.exerciseId,
      exerciseVersion: request.exerciseVersion,
      status,
      checks,
      passedCount: checks.filter((check) => check.status === "passed").length,
      totalCount: checks.length,
      durationMs: durationMs ?? Date.now() - startedAt,
      engine: this.engine,
      diagnostics,
    };
  }

  // Descarta el worker actual y empieza a cargar uno limpio en segundo plano.
  private resetWorker() {
    this.stopWorker();
    void this.ensureLoaded().catch(() => undefined);
  }

  private stopWorker() {
    if (this.loading) {
      clearTimeout(this.loading.timer);
      this.loading.reject(new Error("La carga de Python se interrumpió."));
      this.loading = null;
    }
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.engine = null;
  }

  private setState(state: RunnerState) {
    if (this.currentState === state) return;
    this.currentState = state;
    this.onStateChange?.(state);
  }
}
