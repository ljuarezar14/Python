// Ejecuta código del estudiante dentro de una instancia de Pyodide. No depende
// de Web Workers, por lo que también se prueba en Node con el motor real.

import type { PyodideAPI } from "pyodide";
import type { CheckResult, ExerciseCheck, OutputStream, WorkerRunOutcome } from "./contract.ts";

export const STUDENT_FILENAME = "programa.py";

const INPUT_UNAVAILABLE =
  'input() todavía no está disponible en PyRaíz. Asigna el valor en el código, por ejemplo: nombre = "Ana".';

// Cada ejecución usa un diccionario de variables nuevo. El traceback conserva
// solo los marcos del archivo del estudiante para que la línea sea la suya.
const RUNNER_SOURCE = `
import builtins, json, sys, traceback

_FILENAME = ${JSON.stringify(STUDENT_FILENAME)}

def _input_unavailable(prompt=""):
    raise RuntimeError(${JSON.stringify(INPUT_UNAVAILABLE)})

builtins.input = _input_unavailable

def _student_tb(tb):
    while tb is not None and tb.tb_frame.f_code.co_filename != _FILENAME:
        tb = tb.tb_next
    return tb

def _error(exc, tb):
    if isinstance(exc, SyntaxError):
        line = exc.lineno if exc.filename == _FILENAME else None
        text = "".join(traceback.format_exception_only(type(exc), exc))
    else:
        frames = [f for f in traceback.extract_tb(tb) if f.filename == _FILENAME]
        line = frames[-1].lineno if frames else None
        text = "".join(traceback.format_exception(type(exc), exc, tb))
    return {"type": type(exc).__name__, "message": str(exc), "line": line, "traceback": text}

def _flush():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.flush()
        except Exception:
            pass

def run_student_code(source):
    try:
        code = compile(source, _FILENAME, "exec")
    except SyntaxError as exc:
        return json.dumps(_error(exc, None))
    namespace = {"__name__": "__main__", "__builtins__": builtins}
    try:
        exec(code, namespace)
    except SystemExit as exc:
        if exc.code not in (None, 0):
            return json.dumps(_error(exc, _student_tb(exc.__traceback__)))
    except BaseException as exc:
        return json.dumps(_error(exc, _student_tb(exc.__traceback__)))
    finally:
        _flush()
    return "null"
`;

// Evaluación de pruebas según ADR-0007. Se define en el mismo espacio que
// RUNNER_SOURCE para reutilizar _error y _student_tb.
const EVALUATOR_SOURCE = `
import contextlib, io

_SHOWN_CHARS = 2000

class _LimitedWriter(io.TextIOBase):
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.size = 0
        self.truncated = False

    def writable(self):
        return True

    def write(self, text):
        room = self.limit - self.size
        if len(text) > room:
            self.truncated = True
            text = text[:max(room, 0)]
        if text:
            self.parts.append(text)
            self.size += len(text)
        return len(text)

    def getvalue(self):
        return "".join(self.parts)

def _feeder(lines):
    pending = iter(lines)
    def _input(prompt=""):
        # El texto de solicitud no forma parte de la salida comparada.
        try:
            return next(pending)
        except StopIteration:
            raise EOFError("input() no tiene más datos en esta prueba") from None
    return _input

def _short(text):
    return text if len(text) <= _SHOWN_CHARS else text[:_SHOWN_CHARS] + "…"

def _lines(text):
    lines = [line.rstrip() for line in text.replace("\\r\\n", "\\n").split("\\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return lines

def _first_difference(actual, expected):
    for index, (got, wanted) in enumerate(zip(actual, expected), start=1):
        if got != wanted:
            return index
    return min(len(actual), len(expected)) + 1

def _same(actual, expected):
    if isinstance(expected, bool) or isinstance(actual, bool):
        return type(actual) is bool and type(expected) is bool and actual == expected
    if isinstance(expected, (int, float)):
        return isinstance(actual, (int, float)) and actual == expected
    if expected is None:
        return actual is None
    if isinstance(expected, str):
        return isinstance(actual, str) and actual == expected
    if isinstance(expected, list):
        return (
            isinstance(actual, (list, tuple))
            and len(actual) == len(expected)
            and all(_same(got, wanted) for got, wanted in zip(actual, expected))
        )
    if isinstance(expected, dict):
        return (
            isinstance(actual, dict)
            and set(actual) == set(expected)
            and all(_same(actual[key], expected[key]) for key in expected)
        )
    return False

def _error_message(error):
    if error["type"] == "EOFError":
        return "El programa pidió más datos con input() de los que tiene esta prueba."
    where = f" en la línea {error['line']}" if error["line"] else ""
    return f"El programa produjo {error['type']}{where}."

def _execute(code, stdin, out):
    namespace = {"__name__": "__main__", "__builtins__": builtins}
    previous_input = builtins.input
    builtins.input = _feeder(stdin)
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            try:
                exec(code, namespace)
            except SystemExit as exc:
                if exc.code not in (None, 0):
                    return namespace, _error(exc, _student_tb(exc.__traceback__))
            except BaseException as exc:
                return namespace, _error(exc, _student_tb(exc.__traceback__))
    finally:
        builtins.input = previous_input
    return namespace, None

def _result(check, status, message, out=None, expected=None, actual=None, line=None, error=None):
    return {
        "id": check["id"],
        "status": status,
        "message": message,
        "expected": expected,
        "actual": actual,
        "firstDifferentLine": line,
        "stdout": _short(out.getvalue()) if out else "",
        "error": error,
        "truncated": bool(out and out.truncated),
    }

def _output_check(code, check, out):
    _, error = _execute(code, check.get("stdin", []), out)
    expected = check["expected_stdout"]
    if error:
        return _result(check, "error", _error_message(error), out, _short(expected), error=error)
    if out.truncated:
        return _result(check, "failed", "La salida superó el límite y se recortó.", out, _short(expected))
    got, wanted = _lines(out.getvalue()), _lines(expected)
    if got == wanted:
        return _result(check, "passed", "La salida coincide con la esperada.", out)
    line = _first_difference(got, wanted)
    return _result(
        check, "failed", f"La salida es distinta a partir de la línea {line}.",
        out, _short(expected), _short(out.getvalue()), line,
    )

def _function_check(code, check, out):
    namespace, error = _execute(code, [], out)
    name = check["function_name"]
    expected = check["expected"]
    shown = _short(repr(expected))
    if error:
        return _result(check, "error", _error_message(error), out, shown, error=error)
    function = namespace.get(name)
    if function is None:
        return _result(
            check, "failed", f"No se encontró la función {name}. Revisa el nombre y que esté definida con def.",
            out, shown,
        )
    if not callable(function):
        return _result(check, "failed", f"{name} existe pero no es una función.", out, shown)
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            value = function(*check.get("args", []))
    except BaseException as exc:
        error = _error(exc, _student_tb(exc.__traceback__))
        return _result(check, "error", _error_message(error), out, shown, error=error)
    # Comparar y mostrar el valor ejecuta código del estudiante (__eq__, __repr__) o
    # puede recursar sin fin; un fallo aquí no debe detener el evaluador.
    try:
        same = _same(value, expected)
    except BaseException:
        same = False
    if same:
        return _result(check, "passed", "La función devolvió el valor esperado.", out)
    return _result(
        check, "failed", "La función devolvió un valor distinto al esperado.",
        out, shown, _short(_safe_repr(value)),
    )

def _safe_repr(value):
    try:
        return repr(value)
    except BaseException:
        return f"<{type(value).__name__} que no se puede mostrar>"

def evaluate_check(source, check_json, limit):
    check = json.loads(check_json)
    out = _LimitedWriter(limit)
    try:
        code = compile(source, _FILENAME, "exec")
    except SyntaxError as exc:
        error = _error(exc, None)
        return json.dumps(_result(check, "error", _error_message(error), error=error))
    try:
        if check["kind"] == "output":
            result = _output_check(code, check, out)
        else:
            result = _function_check(code, check, out)
    finally:
        _flush()
    return json.dumps(result)
`;

type OutputSink = (stream: OutputStream, text: string) => void;

type HarnessRun = (code: string, maxOutputChars: number, onOutput: OutputSink) => WorkerRunOutcome;

type HarnessEvaluateCheck = (code: string, check: ExerciseCheck, maxOutputChars: number) => CheckResult;

export type PythonHarness = {
  run: HarnessRun;
  evaluateCheck: HarnessEvaluateCheck;
};

// Retira los puentes directos de Python hacia JavaScript. Es endurecimiento:
// Pyodide conserva otras vías internas y esto no constituye una sandbox.
function removeJsModules(pyodide: PyodideAPI) {
  for (const name of ["js", "pyodide_js"]) {
    try {
      pyodide.unregisterJsModule(name);
    } catch {
      // El módulo puede no estar registrado en esta versión.
    }
  }
  pyodide.runPython(`
import sys
for _name in ("js", "pyodide_js"):
    sys.modules.pop(_name, None)
del _name
`);
}

export function preparePyodide(pyodide: PyodideAPI): PythonHarness {
  removeJsModules(pyodide);
  pyodide.setStdin({ error: true });

  const runnerNamespace = pyodide.toPy({});
  pyodide.runPython(RUNNER_SOURCE, { globals: runnerNamespace, filename: "<pyraiz>" });
  pyodide.runPython(EVALUATOR_SOURCE, { globals: runnerNamespace, filename: "<pyraiz>" });
  const runStudentCode = runnerNamespace.get("run_student_code") as (source: string) => string;
  const evaluateCheckJson = runnerNamespace.get("evaluate_check") as (
    source: string,
    checkJson: string,
    limit: number,
  ) => string;

  const evaluateCheck: HarnessEvaluateCheck = (code, check, maxOutputChars) =>
    JSON.parse(evaluateCheckJson(code, JSON.stringify(check), maxOutputChars)) as CheckResult;

  const run: HarnessRun = (code, maxOutputChars, onOutput) => {
    let emitted = 0;
    let truncated = false;

    function writer(stream: OutputStream) {
      const decoder = new TextDecoder();
      return {
        write(buffer: Uint8Array) {
          const text = decoder.decode(buffer, { stream: true });
          if (truncated || text.length === 0) return buffer.length;
          const available = maxOutputChars - emitted;
          const chunk = text.length > available ? text.slice(0, available) : text;
          if (chunk.length < text.length) truncated = true;
          if (chunk.length > 0) {
            emitted += chunk.length;
            onOutput(stream, chunk);
          }
          return buffer.length;
        },
      };
    }

    pyodide.setStdout(writer("stdout"));
    pyodide.setStderr(writer("stderr"));
    const started = performance.now();
    const serialized = runStudentCode(code);
    const durationMs = Math.round(performance.now() - started);
    const error = JSON.parse(serialized) as WorkerRunOutcome["error"];
    return { status: error ? "error" : "success", error, durationMs, truncated };
  };

  return { run, evaluateCheck };
}
