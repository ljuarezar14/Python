import assert from "node:assert/strict";
import { test } from "node:test";
import { WORKER_POLICY, commonHeaders, newNonce, pagePolicy } from "./security-headers.ts";

function directives(policy: string) {
  return new Map(
    policy.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name, sources] as const;
    }),
  );
}

test("page policy only runs scripts carrying the nonce", () => {
  const policy = directives(pagePolicy({ nonce: "abc", apiOrigin: "https://api.pyraiz.example/", development: false }));
  assert.deepEqual(policy.get("script-src"), ["'self'", "'nonce-abc'", "'strict-dynamic'"]);
  assert.deepEqual(policy.get("connect-src"), ["'self'", "https://api.pyraiz.example"]);
  assert.deepEqual(policy.get("worker-src"), ["'self'"]);
  assert.deepEqual(policy.get("object-src"), ["'none'"]);
  assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(policy.get("base-uri"), ["'none'"]);
  assert.deepEqual(policy.get("style-src"), ["'self'", "'unsafe-inline'"]);
});

test("development adds unsafe-eval for React's debugging only", () => {
  const dev = directives(pagePolicy({ nonce: "abc", apiOrigin: "http://localhost:8000", development: true }));
  assert.ok(dev.get("script-src")?.includes("'unsafe-eval'"));
  assert.deepEqual(dev.get("connect-src"), ["'self'", "http://localhost:8000"]);
  const prod = pagePolicy({ nonce: "abc", apiOrigin: "http://localhost:8000", development: false });
  assert.ok(!prod.includes("unsafe-eval"));
});

test("the worker may compile WebAssembly but not eval or reach other origins", () => {
  const policy = directives(WORKER_POLICY);
  assert.deepEqual(policy.get("default-src"), ["'none'"]);
  assert.deepEqual(policy.get("script-src"), ["'self'", "'wasm-unsafe-eval'"]);
  assert.deepEqual(policy.get("connect-src"), ["'self'"]);
});

test("HSTS only in production builds", () => {
  const names = (production: boolean) => commonHeaders(production).map((header) => header.key);
  assert.ok(names(true).includes("Strict-Transport-Security"));
  assert.ok(!names(false).includes("Strict-Transport-Security"));
  assert.ok(names(false).includes("X-Content-Type-Options"));
});

test("nonces are fresh base64 values", () => {
  const first = newNonce();
  assert.match(first, /^[A-Za-z0-9+/]{22}==$/);
  assert.notEqual(first, newNonce());
});
