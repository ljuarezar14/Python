// Pruebas del arnés con Pyodide real ejecutándose en Node.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { loadPyodide } from "pyodide";
import type { OutputStream } from "./contract.ts";
import { preparePyodide } from "./python-harness.ts";

type Chunk = { stream: OutputStream; text: string };

let harness: ReturnType<typeof preparePyodide>;

function execute(code: string, maxOutputChars = 20_000) {
  const chunks: Chunk[] = [];
  const outcome = harness.run(code, maxOutputChars, (stream, text) => chunks.push({ stream, text }));
  const read = (stream: OutputStream) =>
    chunks.filter((chunk) => chunk.stream === stream).map((chunk) => chunk.text).join("");
  return { outcome, stdout: read("stdout"), stderr: read("stderr") };
}

describe("arnés de Pyodide", { timeout: 120_000 }, () => {
  before(async () => {
    harness = preparePyodide(await loadPyodide());
  });

  test("captura print, incluido texto sin salto de línea final", () => {
    const { outcome, stdout } = execute('gastos = [12, 8, 15]\nprint(f"Total: S/ {sum(gastos)}")\nprint("fin", end="")');
    assert.equal(outcome.status, "success");
    assert.equal(outcome.error, null);
    assert.equal(stdout, "Total: S/ 35\nfin");
    assert.equal(outcome.truncated, false);
  });

  test("separa stderr de stdout", () => {
    const { stdout, stderr } = execute('import sys\nprint("ok")\nprint("aviso", file=sys.stderr)');
    assert.equal(stdout, "ok\n");
    assert.equal(stderr, "aviso\n");
  });

  test("informa SyntaxError con la línea del estudiante", () => {
    const { outcome } = execute('x = 1\nprint("hola"');
    assert.equal(outcome.status, "error");
    assert.equal(outcome.error?.type, "SyntaxError");
    assert.equal(outcome.error?.line, 2);
    assert.match(outcome.error?.traceback ?? "", /programa\.py/);
  });

  test("informa IndentationError", () => {
    const { outcome } = execute("if True:\nprint(1)");
    assert.equal(outcome.error?.type, "IndentationError");
    assert.equal(outcome.error?.line, 2);
  });

  test("informa errores de ejecución sin marcos internos de PyRaíz", () => {
    const { outcome, stdout } = execute('print("antes")\n\ndef f():\n    return y\n\nf()');
    assert.equal(stdout, "antes\n");
    assert.equal(outcome.error?.type, "NameError");
    assert.equal(outcome.error?.line, 4);
    assert.match(outcome.error?.message ?? "", /'y' is not defined/);
    assert.doesNotMatch(outcome.error?.traceback ?? "", /pyraiz|run_student_code/);
    assert.match(outcome.error?.traceback ?? "", /line 6[\s\S]*line 4/);
  });

  test("cada ejecución empieza con variables limpias", () => {
    execute("contador = 41");
    const { outcome } = execute("print(contador)");
    assert.equal(outcome.error?.type, "NameError");
  });

  test("input() falla con un mensaje en español", () => {
    const { outcome } = execute('nombre = input("Nombre: ")');
    assert.equal(outcome.error?.type, "RuntimeError");
    assert.match(outcome.error?.message ?? "", /input\(\) todavía no está disponible/);
    assert.equal(outcome.error?.line, 1);
  });

  test("sys.exit(0) termina con éxito y sys.exit(1) como error", () => {
    assert.equal(execute('import sys\nprint("a")\nsys.exit(0)').outcome.status, "success");
    const failed = execute("import sys\nsys.exit(1)");
    assert.equal(failed.outcome.error?.type, "SystemExit");
    assert.equal(failed.outcome.error?.line, 2);
  });

  test("recorta la salida al límite y lo indica", () => {
    const { outcome, stdout, stderr } = execute('for i in range(1000):\n    print("x" * 9)', 95);
    assert.equal(outcome.status, "success");
    assert.equal(outcome.truncated, true);
    assert.equal(stdout.length + stderr.length, 95);
  });

  test("retira los módulos js y pyodide_js", () => {
    for (const name of ["js", "pyodide_js"]) {
      const { outcome } = execute(`import ${name}`);
      assert.equal(outcome.error?.type, "ModuleNotFoundError", name);
    }
    const runJs = execute("from pyodide.code import run_js\nrun_js('1 + 1')");
    assert.equal(runJs.outcome.status, "error");
  });

  test("un error del estudiante no impide la siguiente ejecución", () => {
    execute("1 / 0");
    const { outcome, stdout } = execute("print(2 + 2)");
    assert.equal(outcome.status, "success");
    assert.equal(stdout, "4\n");
  });
});
