import assert from "node:assert/strict";
import { test } from "node:test";
import { hardenWorkerScope } from "./worker-hardening.ts";

test("sombrea las APIs de red en el ámbito y en su prototipo", () => {
  class ScopePrototype {
    fetch() {
      return "red";
    }
  }
  const scope = Object.create(ScopePrototype.prototype) as Record<string, unknown>;
  scope.XMLHttpRequest = class {};
  scope.postMessage = () => "permitido";

  const blocked = hardenWorkerScope(scope);

  assert.deepEqual(blocked, ["fetch", "XMLHttpRequest"]);
  assert.equal(scope.fetch, undefined);
  assert.equal((ScopePrototype.prototype as unknown as Record<string, unknown>).fetch, undefined);
  assert.equal(scope.XMLHttpRequest, undefined);
  assert.throws(() => {
    "use strict";
    scope.fetch = () => "otra vez";
  }, TypeError);
  assert.equal(typeof scope.postMessage, "function");
});
