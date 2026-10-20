import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchExercise, parseExercise } from "./exercises.ts";
import { parsePrompt } from "./prompt-text.ts";

const EXERCISE = {
  id: "dev-greeting-input",
  lesson_id: "dev-practice-lesson",
  position: 2,
  title: "Prueba",
  version: 1,
  prompt_markdown: "Lee un nombre",
  starter_code: "nombre = input()\n",
  checks: [
    { kind: "output", id: "ana", description: "Ana", stdin: ["Ana"], expected_stdout: "Hola, Ana\n" },
    { kind: "function", id: "f", description: "F", function_name: "f", args: [1], expected: null },
  ],
};

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;
}

test("acepta un ejercicio válido y rechaza formas inesperadas", () => {
  assert.deepEqual(parseExercise(EXERCISE), EXERCISE);
  assert.equal(parseExercise({ ...EXERCISE, checks: [] }), null);
  assert.equal(parseExercise({ ...EXERCISE, checks: [{ kind: "regex", id: "x", description: "x" }] }), null);
  assert.equal(parseExercise({ ...EXERCISE, checks: [{ ...EXERCISE.checks[0], stdin: [1] }] }), null);
  assert.equal(parseExercise({ ...EXERCISE, version: "1" }), null);
  assert.equal(parseExercise([EXERCISE]), null);
});

test("traduce las respuestas de la API", async () => {
  const urls: string[] = [];
  const recording = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(EXERCISE), { status: 200 });
  }) as typeof fetch;
  assert.deepEqual(await fetchExercise("http://api", "dev greeting/1", recording), { status: "ok", exercise: EXERCISE });
  assert.deepEqual(urls, ["http://api/api/v1/curriculum/exercises/dev%20greeting%2F1"]);

  assert.deepEqual(await fetchExercise("http://api", "x", respond(404, { detail: "Ejercicio no disponible" })), {
    status: "not_found",
  });
  const serverError = await fetchExercise("http://api", "x", respond(500, {}));
  assert.equal(serverError.status, "error");
  const notJson = await fetchExercise("http://api", "x", respond(200, "<html>"));
  assert.equal(notJson.status, "error");
  const invalid = await fetchExercise("http://api", "x", respond(200, { id: "x" }));
  assert.equal(invalid.status, "error");
  const offline = await fetchExercise("http://api", "x", (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch);
  assert.deepEqual(offline.status, "error");
});

test("interpreta solo párrafos, código y énfasis, sin HTML", () => {
  assert.deepEqual(parsePrompt("Muestra `Hola`.\n\n_Nota_ final"), [
    [
      { kind: "text", text: "Muestra " },
      { kind: "code", text: "Hola" },
      { kind: "text", text: "." },
    ],
    [
      { kind: "emphasis", text: "Nota" },
      { kind: "text", text: " final" },
    ],
  ]);
  assert.deepEqual(parsePrompt('<img src=x onerror="alert(1)"> **negrita**'), [
    [{ kind: "text", text: '<img src=x onerror="alert(1)"> **negrita**' }],
  ]);
  assert.deepEqual(parsePrompt("\r\n\r\n"), []);
});
