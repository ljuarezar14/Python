// Comprueba el contenido de backend/content con el evaluador real (Pyodide):
// cada solución de referencia debe pasar todas sus pruebas y el código inicial no.
// Uso, desde frontend/: npm run check:content

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import type { ExerciseCheck } from "../src/lib/execution/contract.ts";
import { preparePyodide } from "../src/lib/execution/python-harness.ts";

type ContentExercise = { id: string; starter_code: string; solution: string; checks: ExerciseCheck[] };

const MAX_OUTPUT_CHARS = 20_000;
const backend = fileURLToPath(new URL("../../backend", import.meta.url));
const exported = execFileSync("uv", ["run", "python", "-m", "app.curriculum.content", "--json"], {
  cwd: backend,
  encoding: "utf-8",
});
const exercises = JSON.parse(exported) as ContentExercise[];
const harness = preparePyodide(await loadPyodide());

let problems = 0;
for (const exercise of exercises) {
  const solution = exercise.checks.map((check) => harness.evaluateCheck(exercise.solution, check, MAX_OUTPUT_CHARS));
  const starter = exercise.checks.map((check) => harness.evaluateCheck(exercise.starter_code, check, MAX_OUTPUT_CHARS));
  const failing = solution.filter((result) => result.status !== "passed");
  const starterPasses = starter.every((result) => result.status === "passed");
  if (failing.length > 0) {
    problems += 1;
    for (const result of failing) console.error(`✗ ${exercise.id}: la solución no pasa «${result.id}»: ${result.message}`);
  }
  if (starterPasses) {
    problems += 1;
    console.error(`✗ ${exercise.id}: el código inicial ya pasa todas las pruebas`);
  }
  if (failing.length === 0 && !starterPasses) console.log(`✓ ${exercise.id}`);
}

console.log(`\n${exercises.length} ejercicios comprobados, ${problems} con problemas.`);
process.exit(problems === 0 ? 0 : 1);
