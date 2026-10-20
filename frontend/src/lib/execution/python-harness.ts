// Ejecuta código del estudiante dentro de una instancia de Pyodide. No depende
// de Web Workers, por lo que también se prueba en Node con el motor real.

import type { PyodideAPI } from "pyodide";
import type { OutputStream, WorkerRunOutcome } from "./contract.ts";

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

type OutputSink = (stream: OutputStream, text: string) => void;

type HarnessRun = (code: string, maxOutputChars: number, onOutput: OutputSink) => WorkerRunOutcome;

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

export function preparePyodide(pyodide: PyodideAPI): HarnessRun {
  removeJsModules(pyodide);
  pyodide.setStdin({ error: true });

  const runnerNamespace = pyodide.toPy({});
  pyodide.runPython(RUNNER_SOURCE, { globals: runnerNamespace, filename: "<pyraiz>" });
  const runStudentCode = runnerNamespace.get("run_student_code") as (source: string) => string;

  return (code, maxOutputChars, onOutput) => {
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
}
