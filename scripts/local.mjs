// Arranca PyRaíz en local con un solo comando, desde la raíz del repositorio:
//
//   node scripts/local.mjs                 desarrollo (recarga al guardar)
//   node scripts/local.mjs --production    compila la web y la sirve como en producción
//
// Aplica las migraciones, carga las lecciones e inicia la API y la web. Ctrl+C apaga las dos.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const API_PORT = 8000;
export const WEB_PORT = 3000;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const frontend = join(root, "frontend");

export function parseArgs(argv) {
  const unknown = argv.filter((arg) => arg !== "--production");
  if (unknown.length) throw new Error(`Opción desconocida: ${unknown.join(" ")}. Usa --production o nada.`);
  return { production: argv.includes("--production") };
}

// Pasos previos, en orden. Cada uno debe terminar bien antes del siguiente.
export function setupSteps({ production }) {
  const steps = [
    { label: "Aplicando migraciones", cwd: "backend", command: "uv run alembic upgrade head" },
    { label: "Cargando lecciones", cwd: "backend", command: "uv run python -m app.curriculum.content" },
  ];
  if (production) steps.push({ label: "Compilando la web", cwd: "frontend", command: "npm run build" });
  return steps;
}

// Servicios que quedan en marcha hasta Ctrl+C.
export function services({ production }) {
  return [
    {
      name: "api",
      cwd: "backend",
      command: `uv run uvicorn app.main:app --port ${API_PORT}${production ? "" : " --reload"}`,
      url: `http://localhost:${API_PORT}/api/v1/health`,
    },
    {
      name: "web",
      cwd: "frontend",
      command: `npm run ${production ? "start" : "dev"} -- --hostname localhost --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/`,
    },
  ];
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // Todavía arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function stop(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  // En Windows npm y uv lanzan procesos hijos; taskkill /T cierra el árbol completo.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-child.pid, "SIGTERM");
}

function prefixed(name, stream) {
  let pending = "";
  stream.on("data", (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) if (line.trim()) console.log(`[${name}] ${line}`);
  });
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (!existsSync(join(frontend, "node_modules"))) {
    console.error("Falta instalar la web: ejecuta `npm ci` dentro de frontend/ y vuelve a intentarlo.");
    return 1;
  }
  for (const port of [API_PORT, WEB_PORT]) {
    if (await portInUse(port)) {
      console.error(`El puerto ${port} ya está en uso. Cierra la otra terminal que use PyRaíz y vuelve a intentarlo.`);
      return 1;
    }
  }
  for (const step of setupSteps(options)) {
    console.log(`→ ${step.label}…`);
    const result = spawnSync(step.command, { cwd: join(root, step.cwd), shell: true, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`✗ Falló: ${step.label}. Revisa el mensaje de arriba.`);
      return 1;
    }
  }

  const running = services(options).map((service) => {
    const child = spawn(service.command, {
      cwd: join(root, service.cwd),
      shell: true,
      detached: process.platform !== "win32",
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });
    prefixed(service.name, child.stdout);
    prefixed(service.name, child.stderr);
    return { ...service, child };
  });

  let stopping = false;
  const shutdown = (code) => {
    if (stopping) return;
    stopping = true;
    console.log("\nApagando PyRaíz…");
    for (const { child } of running) stop(child);
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  for (const { name, child } of running) {
    child.on("exit", (code) => {
      if (!stopping) {
        console.error(`✗ El servicio «${name}» se cerró (código ${code}). Se apaga el resto.`);
        shutdown(1);
      }
    });
  }

  // La primera compilación de `next dev` puede tardar.
  const ready = await Promise.all(running.map((service) => waitFor(service.url, 120_000)));
  if (ready.every(Boolean)) {
    console.log(`\n✓ PyRaíz listo${options.production ? " (modo producción)" : ""}: http://localhost:${WEB_PORT}`);
    console.log(`  API: http://localhost:${API_PORT}/api/v1/health`);
    console.log("  Pulsa Ctrl+C para apagar.\n");
  } else {
    running.forEach((service, index) => {
      if (!ready[index]) console.error(`✗ «${service.name}» no respondió en ${service.url}.`);
    });
    shutdown(1);
  }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = await main();
  if (code !== null) process.exit(code);
}
