// Tras cargar Pyodide, el worker ya no necesita red ni almacenamiento. Se
// sombrean estas APIs en todo el prototipo del ámbito global para dificultar
// que el código del estudiante las alcance. No es una frontera de seguridad.

export const BLOCKED_WORKER_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebTransport",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
] as const;

export function hardenWorkerScope(scope: object): string[] {
  const blocked: string[] = [];
  for (const name of BLOCKED_WORKER_GLOBALS) {
    let target: object | null = scope;
    let found = false;
    while (target !== null) {
      if (Object.prototype.hasOwnProperty.call(target, name)) {
        found = true;
        try {
          Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false });
        } catch {
          // Una propiedad no configurable queda tal como está; se sombrea en el ámbito.
        }
      }
      target = Object.getPrototypeOf(target);
    }
    if (found) {
      try {
        Object.defineProperty(scope, name, { value: undefined, writable: false, configurable: false });
      } catch {
        // Ya quedó definida como no configurable en el propio ámbito.
      }
      blocked.push(name);
    }
  }
  return blocked;
}
