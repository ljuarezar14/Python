// Contrato de ejecución independiente del motor. La interfaz depende de estos
// tipos; Pyodide es solo una implementación posible.

export const EXECUTION_CONTRACT_VERSION = 1;

export type ExecutionMode = "practice";

export type RunRequest = {
  contractVersion: typeof EXECUTION_CONTRACT_VERSION;
  runId: string;
  mode: ExecutionMode;
  // Reservado para la evaluación de ejercicios (PR-008); la práctica libre no lo usa.
  exerciseId?: string;
  code: string;
};

export type RunStatus = "success" | "error" | "timeout" | "cancelled" | "rejected" | "engine_error";

export type PythonError = {
  type: string;
  message: string;
  // Línea del código del estudiante; null si el error no proviene de él.
  line: number | null;
  traceback: string;
};

export type EngineInfo = {
  name: string;
  version: string;
};

export type RunResult = {
  contractVersion: typeof EXECUTION_CONTRACT_VERSION;
  runId: string;
  status: RunStatus;
  stdout: string;
  stderr: string;
  error: PythonError | null;
  durationMs: number;
  truncated: boolean;
  engine: EngineInfo | null;
  diagnostics: string[];
};

export type OutputStream = "stdout" | "stderr";

export type RunnerState = "idle" | "loading" | "ready" | "running" | "failed";

export type ExecutionLimits = {
  maxCodeChars: number;
  maxOutputChars: number;
  runTimeoutMs: number;
  loadTimeoutMs: number;
};

export const DEFAULT_LIMITS: ExecutionLimits = {
  maxCodeChars: 100_000,
  maxOutputChars: 20_000,
  runTimeoutMs: 10_000,
  loadTimeoutMs: 60_000,
};

export type RunOptions = {
  onOutput?: (stream: OutputStream, text: string) => void;
};

export interface PythonRunner {
  readonly state: RunnerState;
  run(request: RunRequest, options?: RunOptions): Promise<RunResult>;
  cancel(): void;
  restart(): Promise<void>;
  dispose(): void;
}

// Agrupa miles con espacio fino (100 000), como el resto de la interfaz.
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function validateRunRequest(request: RunRequest, limits: ExecutionLimits): string | null {
  if (request.contractVersion !== EXECUTION_CONTRACT_VERSION) {
    return "La versión del contrato de ejecución no es compatible.";
  }
  if (request.mode !== "practice") return "El modo de ejecución no es válido.";
  if (typeof request.code !== "string") return "El código debe ser texto.";
  if (request.code.length > limits.maxCodeChars) {
    return `El código supera el límite de ${formatCount(limits.maxCodeChars)} caracteres y no se ejecutó.`;
  }
  return null;
}

// Mensajes entre el hilo principal y el worker. No forman parte del contrato
// público: otro motor podría comunicarse de otra manera.
export type WorkerRequest =
  | { type: "init" }
  | { type: "run"; runId: string; code: string; maxOutputChars: number };

export type WorkerRunOutcome = {
  status: "success" | "error";
  error: PythonError | null;
  durationMs: number;
  truncated: boolean;
};

export type WorkerResponse =
  | { type: "ready"; engine: EngineInfo }
  | { type: "init-error"; message: string }
  | { type: "output"; runId: string; stream: OutputStream; text: string }
  | { type: "result"; runId: string; outcome: WorkerRunOutcome };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPythonError(value: unknown): value is PythonError {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.message === "string" &&
    (value.line === null || (typeof value.line === "number" && Number.isInteger(value.line))) &&
    typeof value.traceback === "string"
  );
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "ready":
      return isRecord(value.engine) && typeof value.engine.name === "string" && typeof value.engine.version === "string";
    case "init-error":
      return typeof value.message === "string";
    case "output":
      return (
        typeof value.runId === "string" &&
        (value.stream === "stdout" || value.stream === "stderr") &&
        typeof value.text === "string"
      );
    case "result": {
      const outcome = value.outcome;
      return (
        typeof value.runId === "string" &&
        isRecord(outcome) &&
        (outcome.status === "success" || outcome.status === "error") &&
        (outcome.error === null || isPythonError(outcome.error)) &&
        typeof outcome.durationMs === "number" &&
        typeof outcome.truncated === "boolean"
      );
    }
    default:
      return false;
  }
}
