// Implementación de PythonRunner sobre un Web Worker. La cancelación y el tiempo
// límite terminan el worker: es la única forma fiable de cortar un bucle infinito
// sin aislamiento entre orígenes (SharedArrayBuffer).

import {
  DEFAULT_LIMITS,
  EXECUTION_CONTRACT_VERSION,
  formatCount,
  isWorkerResponse,
  validateRunRequest,
} from "./contract.ts";
import type {
  EngineInfo,
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
  request: RunRequest;
  options: RunOptions;
  stdout: string;
  stderr: string;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (result: RunResult) => void;
};

type Loading = {
  worker: WorkerLike;
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class WorkerPythonRunner implements PythonRunner {
  readonly limits: ExecutionLimits;
  private readonly createWorker: () => WorkerLike;
  private readonly onStateChange?: (state: RunnerState) => void;
  private worker: WorkerLike | null = null;
  private engine: EngineInfo | null = null;
  private loading: Loading | null = null;
  private active: ActiveRun | null = null;
  private currentState: RunnerState = "idle";

  constructor(options: WorkerRunnerOptions) {
    this.createWorker = options.createWorker;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.onStateChange = options.onStateChange;
  }

  get state(): RunnerState {
    return this.currentState;
  }

  async run(request: RunRequest, options: RunOptions = {}): Promise<RunResult> {
    const startedAt = Date.now();
    const invalid = validateRunRequest(request, this.limits);
    if (invalid) return this.result(request.runId, "rejected", startedAt, { diagnostics: [invalid] });
    if (this.active) {
      return this.result(request.runId, "rejected", startedAt, {
        diagnostics: ["Ya hay una ejecución en curso. Espera a que termine o detenla."],
      });
    }

    const run: ActiveRun = {
      request,
      options,
      stdout: "",
      stderr: "",
      startedAt,
      timer: null,
      resolve: () => undefined,
    };
    const finished = new Promise<RunResult>((resolve) => {
      run.resolve = resolve;
    });
    this.active = run;
    this.setState("running");

    try {
      await this.ensureLoaded();
    } catch (error) {
      if (this.active === run) {
        this.finish("engine_error", { diagnostics: [(error as Error).message] });
      }
      return finished;
    }
    if (this.active !== run || !this.worker) return finished;

    run.startedAt = Date.now();
    run.timer = setTimeout(() => {
      if (this.active !== run) return;
      const seconds = Math.round(this.limits.runTimeoutMs / 1000);
      this.finish("timeout", {
        diagnostics: [`La ejecución superó ${seconds} s y se detuvo. Revisa si hay un bucle que no termina.`],
      });
      this.resetWorker();
    }, this.limits.runTimeoutMs);
    this.setState("running");
    this.worker.postMessage({
      type: "run",
      runId: request.runId,
      code: request.code,
      maxOutputChars: this.limits.maxOutputChars,
    });
    return finished;
  }

  // Inicia la carga del motor sin ejecutar código.
  preload(): Promise<void> {
    return this.ensureLoaded();
  }

  cancel(): void {
    if (!this.active) return;
    this.finish("cancelled", { diagnostics: ["Ejecución detenida por la persona usuaria."] });
    this.resetWorker();
  }

  async restart(): Promise<void> {
    if (this.active) {
      this.finish("cancelled", { diagnostics: ["Python se reinició durante la ejecución."] });
    }
    this.resetWorker();
    await this.ensureLoaded();
  }

  dispose(): void {
    if (this.active) this.finish("cancelled", { diagnostics: ["La práctica se cerró."] });
    this.stopWorker();
    this.setState("idle");
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
          this.finish("engine_error", { diagnostics: [data.message] });
          this.resetWorker();
        }
        return;
      case "output":
        this.appendOutput(data.runId, data.stream, data.text);
        return;
      case "result":
        if (this.active?.request.runId !== data.runId) return;
        this.finishFromWorker(data.outcome);
        return;
    }
  }

  private appendOutput(runId: string, stream: "stdout" | "stderr", text: string) {
    const run = this.active;
    if (!run || run.request.runId !== runId) return;
    // El worker ya aplica el límite; se repite aquí por si recibe mensajes inesperados.
    const used = run.stdout.length + run.stderr.length;
    const chunk = text.slice(0, Math.max(0, this.limits.maxOutputChars - used));
    if (!chunk) return;
    if (stream === "stdout") run.stdout += chunk;
    else run.stderr += chunk;
    run.options.onOutput?.(stream, chunk);
  }

  private finishFromWorker(outcome: WorkerRunOutcome) {
    const diagnostics: string[] = [];
    if (outcome.truncated) {
      diagnostics.push(
        `La salida superó ${formatCount(this.limits.maxOutputChars)} caracteres y se recortó.`,
      );
    }
    this.finish(outcome.status, {
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
    if (this.active) {
      this.finish("engine_error", { diagnostics: ["El motor de Python se detuvo inesperadamente."] });
    }
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

  private finish(
    status: RunStatus,
    details: { error?: RunResult["error"]; durationMs?: number; truncated?: boolean; diagnostics: string[] },
  ) {
    const run = this.active;
    if (!run) return;
    if (run.timer) clearTimeout(run.timer);
    this.active = null;
    run.resolve({
      ...this.result(run.request.runId, status, run.startedAt, details),
      stdout: run.stdout,
      stderr: run.stderr,
      truncated: details.truncated ?? false,
    });
  }

  private result(
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
