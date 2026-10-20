// Pruebas del controlador del hilo principal con un worker simulado.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EXECUTION_CONTRACT_VERSION } from "./contract.ts";
import type { RunRequest, RunnerState, WorkerRequest, WorkerResponse } from "./contract.ts";
import { WorkerPythonRunner } from "./worker-runner.ts";
import type { WorkerLike } from "./worker-runner.ts";

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  received: WorkerRequest[] = [];
  terminated = false;

  postMessage(message: WorkerRequest) {
    this.received.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: WorkerResponse | Record<string, unknown>) {
    this.onmessage?.({ data } as MessageEvent);
  }

  ready() {
    this.emit({ type: "ready", engine: { name: "fake", version: "1.0" } });
  }

  lastRunId() {
    const run = this.received.findLast((message) => message.type === "run");
    assert.ok(run && run.type === "run", "el worker no recibió una ejecución");
    return run.runId;
  }
}

function setup(limits = {}, autoReady = true) {
  const workers: FakeWorker[] = [];
  const states: RunnerState[] = [];
  const runner = new WorkerPythonRunner({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      if (autoReady) queueMicrotask(() => worker.ready());
      return worker;
    },
    limits: { runTimeoutMs: 1_000, loadTimeoutMs: 1_000, ...limits },
    onStateChange: (state) => states.push(state),
  });
  return { runner, workers, states };
}

function request(code = 'print("hola")', runId = "run-1"): RunRequest {
  return { contractVersion: EXECUTION_CONTRACT_VERSION, runId, mode: "practice", code };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("WorkerPythonRunner", () => {
  test("carga el motor bajo demanda y devuelve salida y resultado", async () => {
    const { runner, workers, states } = setup();
    const streamed: string[] = [];
    const pending = runner.run(request(), { onOutput: (_stream, text) => streamed.push(text) });
    await tick();
    const worker = workers[0];
    assert.deepEqual(worker.received[0], { type: "init" });
    const runId = worker.lastRunId();
    worker.emit({ type: "output", runId, stream: "stdout", text: "hola\n" });
    worker.emit({ type: "result", runId, outcome: { status: "success", error: null, durationMs: 4, truncated: false } });
    const result = await pending;
    assert.equal(result.status, "success");
    assert.equal(result.stdout, "hola\n");
    assert.equal(result.durationMs, 4);
    assert.deepEqual(result.engine, { name: "fake", version: "1.0" });
    assert.deepEqual(streamed, ["hola\n"]);
    assert.deepEqual(states, ["running", "ready"]);
  });

  test("transmite el error estructurado de Python", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request("print(y)"));
    await tick();
    const error = { type: "NameError", message: "name 'y' is not defined", line: 1, traceback: "Traceback..." };
    workers[0].emit({
      type: "result",
      runId: workers[0].lastRunId(),
      outcome: { status: "error", error, durationMs: 2, truncated: false },
    });
    const result = await pending;
    assert.equal(result.status, "error");
    assert.deepEqual(result.error, error);
  });

  test("rechaza código demasiado largo sin crear el worker", async () => {
    const { runner, workers } = setup({ maxCodeChars: 10 });
    const result = await runner.run(request("x" .repeat(11)));
    assert.equal(result.status, "rejected");
    assert.match(result.diagnostics[0], /límite/);
    assert.equal(workers.length, 0);
  });

  test("rechaza una segunda ejecución simultánea", async () => {
    const { runner } = setup();
    void runner.run(request());
    const second = await runner.run(request("print(2)", "run-2"));
    assert.equal(second.status, "rejected");
    runner.dispose();
  });

  test("termina el worker al superar el tiempo límite y conserva la salida parcial", async () => {
    const { runner, workers } = setup({ runTimeoutMs: 30 });
    const pending = runner.run(request("while True: print(1)"));
    await tick();
    const first = workers[0];
    first.emit({ type: "output", runId: first.lastRunId(), stream: "stdout", text: "1\n" });
    const result = await pending;
    assert.equal(result.status, "timeout");
    assert.equal(result.stdout, "1\n");
    assert.equal(first.terminated, true);
    assert.equal(workers.length, 2, "debe preparar un worker limpio");
    await tick();
    assert.equal(runner.state, "ready");
  });

  test("cancel detiene la ejecución e ignora mensajes tardíos del worker anterior", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request());
    await tick();
    const first = workers[0];
    const runId = first.lastRunId();
    runner.cancel();
    const result = await pending;
    assert.equal(result.status, "cancelled");
    assert.equal(first.terminated, true);
    first.emit({ type: "result", runId, outcome: { status: "success", error: null, durationMs: 1, truncated: false } });
    await tick();
    assert.equal(runner.state, "ready");
  });

  test("restart cancela la ejecución en curso y carga un motor nuevo", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request());
    await tick();
    await runner.restart();
    assert.equal((await pending).status, "cancelled");
    assert.equal(workers.length, 2);
    assert.equal(workers[0].terminated, true);
    assert.equal(runner.state, "ready");
  });

  test("ignora mensajes con forma inválida o de otra ejecución", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request());
    await tick();
    const worker = workers[0];
    const runId = worker.lastRunId();
    worker.emit({ type: "output", runId: "otra", stream: "stdout", text: "ajeno" });
    worker.emit({ type: "output", runId, stream: "pantalla", text: "inválido" });
    worker.emit({ type: "result", runId, outcome: { status: "success" } });
    worker.emit({ type: "result", runId, outcome: { status: "success", error: null, durationMs: 1, truncated: false } });
    const result = await pending;
    assert.equal(result.stdout, "");
    assert.equal(result.status, "success");
  });

  test("aplica también el límite de salida en el hilo principal", async () => {
    const { runner, workers } = setup({ maxOutputChars: 5 });
    const pending = runner.run(request());
    await tick();
    const worker = workers[0];
    const runId = worker.lastRunId();
    worker.emit({ type: "output", runId, stream: "stdout", text: "abcdefgh" });
    worker.emit({ type: "result", runId, outcome: { status: "success", error: null, durationMs: 1, truncated: true } });
    const result = await pending;
    assert.equal(result.stdout, "abcde");
    assert.equal(result.truncated, true);
    assert.match(result.diagnostics[0], /se recortó/);
  });

  test("informa engine_error si el motor no carga a tiempo y permite reintentar", async () => {
    const { runner, workers } = setup({ loadTimeoutMs: 20 }, false);
    const result = await runner.run(request());
    assert.equal(result.status, "engine_error");
    assert.match(result.diagnostics[0], /tardó demasiado/);
    assert.equal(runner.state, "failed");
    assert.equal(workers[0].terminated, true);

    const retry = runner.run(request("print(1)", "run-2"));
    await tick();
    workers[1].ready();
    await tick();
    workers[1].emit({
      type: "result",
      runId: "run-2",
      outcome: { status: "success", error: null, durationMs: 1, truncated: false },
    });
    assert.equal((await retry).status, "success");
  });

  test("informa engine_error si el worker falla durante la carga", async () => {
    const { runner, workers } = setup({}, false);
    const pending = runner.run(request());
    await tick();
    workers[0].emit({ type: "init-error", message: "No se pudo cargar el motor de Python." });
    const result = await pending;
    assert.equal(result.status, "engine_error");
    assert.equal(result.stdout, "");
  });

  test("informa engine_error si el worker se cae durante una ejecución", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request());
    await tick();
    workers[0].onerror?.(new Event("error") as ErrorEvent);
    const result = await pending;
    assert.equal(result.status, "engine_error");
    assert.equal(workers.length, 2);
  });

  test("informa engine_error si el navegador no puede crear el worker", async () => {
    const runner = new WorkerPythonRunner({
      createWorker: () => {
        throw new Error("sin workers");
      },
    });
    const result = await runner.run(request());
    assert.equal(result.status, "engine_error");
    assert.equal(runner.state, "failed");
  });
});
