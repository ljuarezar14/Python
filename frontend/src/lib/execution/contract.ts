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

// Pruebas de ejercicio: mismo contrato que la API (ADR-0007).
export type OutputCheck = {
  kind: "output";
  id: string;
  description: string;
  stdin: string[];
  expected_stdout: string;
};

export type FunctionCheck = {
  kind: "function";
  id: string;
  description: string;
  function_name: string;
  args: unknown[];
  expected: unknown;
};

export type ExerciseCheck = OutputCheck | FunctionCheck;

export type EvaluationRequest = {
  contractVersion: typeof EXECUTION_CONTRACT_VERSION;
  runId: string;
  exerciseId: string;
  exerciseVersion: number;
  code: string;
  checks: ExerciseCheck[];
};

export type CheckStatus = "passed" | "failed" | "error" | "not_run";

export type CheckResult = {
  id: string;
  status: CheckStatus;
  // Mensaje breve en español que explica el resultado.
  message: string;
  expected: string | null;
  actual: string | null;
  // Primera línea distinta en pruebas de salida (1 = primera línea).
  firstDifferentLine: number | null;
  stdout: string;
  error: PythonError | null;
  truncated: boolean;
};

export type EvaluationStatus = "passed" | "failed" | "timeout" | "cancelled" | "rejected" | "engine_error";

export type EvaluationResult = {
  contractVersion: typeof EXECUTION_CONTRACT_VERSION;
  runId: string;
  exerciseId: string;
  exerciseVersion: number;
  status: EvaluationStatus;
  checks: CheckResult[];
  passedCount: number;
  totalCount: number;
  durationMs: number;
  engine: EngineInfo | null;
  diagnostics: string[];
};

export type EvaluateOptions = {
  onCheck?: (result: CheckResult) => void;
};

export interface PythonRunner {
  readonly state: RunnerState;
  run(request: RunRequest, options?: RunOptions): Promise<RunResult>;
  evaluate(request: EvaluationRequest, options?: EvaluateOptions): Promise<EvaluationResult>;
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

export function validateEvaluationRequest(request: EvaluationRequest, limits: ExecutionLimits): string | null {
  if (request.contractVersion !== EXECUTION_CONTRACT_VERSION) {
    return "La versión del contrato de ejecución no es compatible.";
  }
  if (typeof request.code !== "string") return "El código debe ser texto.";
  if (request.code.length > limits.maxCodeChars) {
    return `El código supera el límite de ${formatCount(limits.maxCodeChars)} caracteres y no se evaluó.`;
  }
  if (!Array.isArray(request.checks) || request.checks.length === 0) {
    return "El ejercicio no tiene pruebas que evaluar.";
  }
  return null;
}

// Mensajes entre el hilo principal y el worker. No forman parte del contrato
// público: otro motor podría comunicarse de otra manera.
export type WorkerRequest =
  | { type: "init" }
  | { type: "run"; runId: string; code: string; maxOutputChars: number }
  | { type: "evaluate"; runId: string; code: string; checks: ExerciseCheck[]; maxOutputChars: number };

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
  | { type: "result"; runId: string; outcome: WorkerRunOutcome }
  | { type: "check"; runId: string; result: CheckResult }
  | { type: "evaluation-done"; runId: string; durationMs: number };

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

const CHECK_STATUSES: readonly CheckStatus[] = ["passed", "failed", "error", "not_run"];

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCheckResult(value: unknown): value is CheckResult {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    CHECK_STATUSES.includes(value.status as CheckStatus) &&
    typeof value.message === "string" &&
    isNullableString(value.expected) &&
    isNullableString(value.actual) &&
    (value.firstDifferentLine === null || Number.isInteger(value.firstDifferentLine)) &&
    typeof value.stdout === "string" &&
    (value.error === null || isPythonError(value.error)) &&
    typeof value.truncated === "boolean"
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
    case "check":
      return typeof value.runId === "string" && isCheckResult(value.result);
    case "evaluation-done":
      return typeof value.runId === "string" && typeof value.durationMs === "number";
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
