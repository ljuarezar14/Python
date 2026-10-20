// Pruebas del evaluador de ejercicios con Pyodide real (reglas de ADR-0007).

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { loadPyodide } from "pyodide";
import type { ExerciseCheck, FunctionCheck, OutputCheck } from "./contract.ts";
import { preparePyodide } from "./python-harness.ts";

let harness: ReturnType<typeof preparePyodide>;

function output(expected: string, stdin: string[] = []): OutputCheck {
  return { kind: "output", id: "salida", description: "Salida", stdin, expected_stdout: expected };
}

function fn(name: string, args: unknown[], expected: unknown): FunctionCheck {
  return { kind: "function", id: "funcion", description: "Función", function_name: name, args, expected };
}

const check = (code: string, definition: ExerciseCheck, limit = 20_000) => harness.evaluateCheck(code, definition, limit);

describe("evaluador de ejercicios", { timeout: 120_000 }, () => {
  before(async () => {
    harness = preparePyodide(await loadPyodide());
  });

  test("aprueba una salida idéntica", () => {
    const result = check('print("Hola, PyRaíz")', output("Hola, PyRaíz\n"));
    assert.equal(result.status, "passed");
    assert.equal(result.stdout, "Hola, PyRaíz\n");
    assert.equal(result.expected, null);
  });

  test("ignora espacios finales y líneas vacías al final, pero no mayúsculas ni tildes", () => {
    assert.equal(check('print("a  ")\nprint()\nprint()', output("a\n")).status, "passed");
    assert.equal(check('print("Hola, pyraíz")', output("Hola, PyRaíz\n")).status, "failed");
    assert.equal(check('print("Hola, PyRaiz")', output("Hola, PyRaíz\n")).status, "failed");
  });

  test("indica la primera línea distinta, también si falta salida", () => {
    const changed = check('print("uno")\nprint("DOS")', output("uno\ndos\n"));
    assert.equal(changed.status, "failed");
    assert.equal(changed.firstDifferentLine, 2);
    assert.equal(changed.expected, "uno\ndos\n");
    assert.equal(changed.actual, "uno\nDOS\n");
    assert.match(changed.message, /línea 2/);

    const missing = check('print("uno")', output("uno\ndos\n"));
    assert.equal(missing.firstDifferentLine, 2);
  });

  test("input() recibe stdin en orden y su texto de solicitud no se compara", () => {
    const code = 'nombre = input("¿Cómo te llamas? ")\nprint(f"Hola, {nombre}")';
    assert.equal(check(code, output("Hola, Ana\n", ["Ana"])).status, "passed");
    const two = check("a = input()\nb = input()\nprint(int(a) + int(b))", output("5\n", ["2", "3"]));
    assert.equal(two.status, "passed");
  });

  test("informa EOFError cuando el programa pide más datos de los disponibles", () => {
    const result = check("a = input()\nb = input()", output("", ["solo uno"]));
    assert.equal(result.status, "error");
    assert.equal(result.error?.type, "EOFError");
    assert.equal(result.error?.line, 2);
    assert.match(result.message, /más datos con input\(\)/);
  });

  test("informa errores con la línea del estudiante", () => {
    const runtime = check("print(1)\nprint(1 / 0)", output("1\n"));
    assert.equal(runtime.status, "error");
    assert.equal(runtime.error?.type, "ZeroDivisionError");
    assert.match(runtime.message, /ZeroDivisionError en la línea 2/);
    assert.equal(runtime.stdout, "1\n");

    const syntax = check("print(", output(""));
    assert.equal(syntax.error?.type, "SyntaxError");
    assert.equal(syntax.error?.line, 1);
  });

  test("recorta la salida excesiva y no la aprueba", () => {
    const result = check('for _ in range(100):\n    print("x" * 10)', output("x\n"), 50);
    assert.equal(result.status, "failed");
    assert.equal(result.truncated, true);
    assert.match(result.message, /límite/);
  });

  test("evalúa funciones con argumentos JSON", () => {
    const code = "def area_rectangulo(base, altura):\n    return base * altura";
    assert.equal(check(code, fn("area_rectangulo", [3, 4], 12)).status, "passed");
    const wrong = check("def area_rectangulo(base, altura):\n    return base + altura", fn("area_rectangulo", [3, 4], 12));
    assert.equal(wrong.status, "failed");
    assert.equal(wrong.expected, "12");
    assert.equal(wrong.actual, "7");
  });

  test("compara tuplas como listas, enteros con decimales y distingue booleanos", () => {
    assert.equal(check("def f():\n    return (1, [2, 3])", fn("f", [], [1, [2, 3]])).status, "passed");
    assert.equal(check("def f():\n    return 5.0", fn("f", [], 5)).status, "passed");
    assert.equal(check("def f():\n    return 1", fn("f", [], true)).status, "failed");
    assert.equal(check("def f():\n    return True", fn("f", [], 1)).status, "failed");
    assert.equal(check("def f():\n    return None", fn("f", [], null)).status, "passed");
    assert.equal(check('def f():\n    return {"a": [1]}', fn("f", [], { a: [1] })).status, "passed");
    const shown = check("def f():\n    return 0", fn("f", [], true));
    assert.equal(shown.expected, "True");
  });

  test("explica cuando la función no existe, no es invocable o falla", () => {
    const missing = check("def area(b, h):\n    return b * h", fn("area_rectangulo", [1, 1], 1));
    assert.equal(missing.status, "failed");
    assert.match(missing.message, /No se encontró la función area_rectangulo/);

    const notCallable = check("area_rectangulo = 4", fn("area_rectangulo", [], 4));
    assert.match(notCallable.message, /no es una función/);

    const raises = check("def f(x):\n    return 10 / x", fn("f", [0], 1));
    assert.equal(raises.status, "error");
    assert.equal(raises.error?.type, "ZeroDivisionError");
    assert.equal(raises.error?.line, 2);
  });

  test("un valor devuelto problemático no detiene el evaluador", () => {
    const cyclic = check("def f():\n    lista = []\n    lista.append(lista)\n    return lista", fn("f", [], [[]]));
    assert.equal(cyclic.status, "failed");
    assert.equal(cyclic.actual, "[[...]]");

    const badRepr = check(
      "class Raro:\n    def __repr__(self):\n        raise ValueError('no')\n    def __eq__(self, other):\n        raise ValueError('no')\n\ndef f():\n    return [Raro()]",
      fn("f", [], [1]),
    );
    assert.equal(badRepr.status, "failed");
    assert.equal(badRepr.actual, "<list que no se puede mostrar>");

    assert.equal(check('print("sigo vivo")', output("sigo vivo\n")).status, "passed");
  });

  test("cada prueba usa variables limpias y restaura input()", () => {
    check("contador = 1", output(""));
    assert.equal(check("print(contador)", output("1\n")).error?.type, "NameError");
    const free = harness.run("input()", 1_000, () => undefined);
    assert.equal(free.error?.type, "RuntimeError");
  });

  test("sys.exit(0) cuenta como fin normal", () => {
    assert.equal(check('import sys\nprint("ok")\nsys.exit(0)', output("ok\n")).status, "passed");
  });
});
