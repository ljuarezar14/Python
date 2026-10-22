import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchLesson,
  fetchModule,
  fetchPath,
  fetchPaths,
  parseLessonDetail,
  parseModuleDetail,
  parsePathDetail,
  parsePaths,
} from "./curriculum.ts";

const PATH = { id: "python-basico", title: "Python básico", description: "Primeros pasos", version: 1 };
const MODULE = {
  id: "primeros-pasos",
  path_id: "python-basico",
  position: 1,
  level: "basic",
  title: "Primeros pasos",
  description: "Escribe tus primeros programas",
  objectives: ["Mostrar texto"],
  version: 1,
};
const LESSON = {
  id: "print",
  module_id: "primeros-pasos",
  position: 1,
  title: "Mostrar texto",
  summary: "Usa print()",
  objectives: ["Usar print()"],
  prerequisite_ids: [],
  version: 2,
};
const LESSON_DETAIL = {
  ...LESSON,
  content_markdown: "# Hola",
  exercises: [{ id: "saludo", position: 1, title: "Saludo", version: 1 }],
};

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;
}

test("valida la forma de rutas, módulos y lecciones", () => {
  assert.deepEqual(parsePaths({ items: [PATH], total: 1, limit: 100, offset: 0 }), [PATH]);
  assert.equal(parsePaths({ items: [{ ...PATH, version: 0 }] }), null);
  assert.equal(parsePaths([PATH]), null);

  assert.deepEqual(parsePathDetail({ ...PATH, modules: [MODULE] }), { ...PATH, modules: [MODULE] });
  assert.equal(parsePathDetail({ ...PATH, modules: [{ ...MODULE, level: "expert" }] }), null);
  assert.equal(parsePathDetail({ ...PATH, modules: [{ ...MODULE, level: "toString" }] }), null);

  assert.deepEqual(parseModuleDetail({ ...MODULE, lessons: [LESSON] }), { ...MODULE, lessons: [LESSON] });
  assert.equal(parseModuleDetail({ ...MODULE, lessons: [{ ...LESSON, prerequisite_ids: [1] }] }), null);

  assert.deepEqual(parseLessonDetail(LESSON_DETAIL), LESSON_DETAIL);
  assert.equal(parseLessonDetail({ ...LESSON_DETAIL, content_markdown: null }), null);
  assert.equal(parseLessonDetail({ ...LESSON_DETAIL, exercises: [{ id: "x", position: 0, title: "x", version: 1 }] }), null);
});

test("pide cada recurso sin cookie y con el identificador codificado", async () => {
  const calls: [string, RequestInit | undefined][] = [];
  const recording = (body: unknown) =>
    (async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

  assert.deepEqual(await fetchPaths("http://api", recording({ items: [PATH] })), { status: "ok", data: [PATH] });
  await fetchPath("http://api", "a b", recording({ ...PATH, modules: [] }));
  await fetchModule("http://api", "a/b", recording({ ...MODULE, lessons: [] }));
  assert.deepEqual(await fetchLesson("http://api", "print", recording(LESSON_DETAIL)), { status: "ok", data: LESSON_DETAIL });
  assert.deepEqual(
    calls.map(([url]) => url),
    [
      "http://api/api/v1/curriculum/paths?limit=100",
      "http://api/api/v1/curriculum/paths/a%20b",
      "http://api/api/v1/curriculum/modules/a%2Fb",
      "http://api/api/v1/curriculum/lessons/print",
    ],
  );
  assert.ok(calls.every(([, init]) => init?.credentials === "omit"));
});

test("traduce los errores de la API", async () => {
  assert.deepEqual(await fetchLesson("http://api", "x", respond(404, { detail: "Lección no disponible" })), {
    status: "not_found",
  });
  assert.equal((await fetchLesson("http://api", "x", respond(500, {}))).status, "error");
  assert.equal((await fetchLesson("http://api", "x", respond(200, "<html>"))).status, "error");
  assert.equal((await fetchLesson("http://api", "x", respond(200, { id: "x" }))).status, "error");
  const offline = await fetchPaths("http://api", (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch);
  assert.equal(offline.status, "error");
});
