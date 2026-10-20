// Copia los archivos de Pyodide necesarios en el navegador a public/pyodide.
// Se sirven desde el mismo origen: sin CDN externo y con la versión fijada en package-lock.json.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pyodide/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pyodide");
const { version } = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
const files = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

mkdirSync(target, { recursive: true });
for (const file of files) copyFileSync(join(source, file), join(target, file));
writeFileSync(join(target, "VERSION"), `${version}\n`);
console.log(`Pyodide ${version} copiado a public/pyodide (${files.length} archivos).`);
