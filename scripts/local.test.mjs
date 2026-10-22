import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArgs, services, setupSteps } from "./local.mjs";

test("development migrates and loads content without building", () => {
  const labels = setupSteps(parseArgs([])).map((step) => step.command);
  assert.deepEqual(labels, ["uv run alembic upgrade head", "uv run python -m app.curriculum.content"]);
});

test("production also builds the web and serves it with next start", () => {
  const options = parseArgs(["--production"]);
  assert.equal(setupSteps(options).at(-1).command, "npm run build");
  const [api, web] = services(options);
  assert.ok(!api.command.includes("--reload"));
  assert.equal(web.command, "npm run start -- --hostname localhost --port 3000");
});

test("development reloads the API and runs next dev", () => {
  const [api, web] = services(parseArgs([]));
  assert.match(api.command, /--port 8000 --reload$/);
  assert.equal(web.command, "npm run dev -- --hostname localhost --port 3000");
  assert.equal(api.url, "http://localhost:8000/api/v1/health");
});

test("unknown options are rejected", () => {
  assert.throws(() => parseArgs(["--prod"]), /Opción desconocida/);
});
