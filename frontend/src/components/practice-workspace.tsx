"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PythonCodeEditor = dynamic(() => import("@/components/python-code-editor"), {
  ssr: false,
  loading: () => <p className="min-h-80 p-4 text-sm text-muted" role="status">Cargando el editor…</p>,
});

const DRAFT_KEY = "pyraiz.python.scratchpad.v1";
const MAX_DRAFT_LENGTH = 100_000;
const STARTER_CODE = 'gastos = [12, 8, 15]\ntotal = sum(gastos)\nprint(f"Total: S/ {total}")\n';

export function PracticeWorkspace() {
  const [code, setCode] = useState(STARTER_CODE);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Cargando borrador…");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (saved !== null && saved.length <= MAX_DRAFT_LENGTH) {
          setCode(saved);
          setSaveStatus("Borrador recuperado de este navegador.");
        } else {
          setSaveStatus("Ejemplo inicial listo para editar.");
        }
      } catch {
        setSaveStatus("El almacenamiento del navegador no está disponible.");
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (code.length > MAX_DRAFT_LENGTH) {
        setSaveStatus("El borrador supera el límite de 100 000 caracteres y no se guardó.");
        return;
      }
      try {
        window.localStorage.setItem(DRAFT_KEY, code);
        setSaveStatus("Borrador guardado en este navegador.");
      } catch {
        setSaveStatus("No se pudo guardar el borrador en este navegador.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [code, ready]);

  function changeCode(next: string) {
    setCode(next);
    setSaveStatus("Guardando borrador…");
  }

  function resetCode() {
    if (window.confirm("¿Restablecer el ejemplo? Se reemplazará tu borrador actual.")) {
      setCode(STARTER_CODE);
      setSaveStatus("Guardando borrador…");
    }
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="editor-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold" id="editor-title">Editor de Python</h2>
            <p className="text-xs text-muted">ejemplo.py · 4 espacios por sangría</p>
          </div>
          <button
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-surface-muted"
            onClick={resetCode}
            type="button"
          >
            Restablecer ejemplo
          </button>
        </div>
        {ready && <PythonCodeEditor onChange={changeCode} value={code} />}
        <p className="border-t border-border p-4 text-sm text-muted" role="status">{saveStatus}</p>
      </section>

      <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="console-title">
        <h2 className="text-lg font-bold" id="console-title">Consola</h2>
        <div className="mt-4 min-h-40 rounded-xl bg-code p-5 font-mono text-sm leading-relaxed text-code-text">
          La salida de Python aparecerá aquí cuando esté disponible el motor de ejecución.
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          El código se guarda solo en este navegador y puede perderse si borras sus datos. No escribas contraseñas ni otros secretos en un equipo compartido.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Por ahora puedes cambiar valores, añadir líneas y practicar la sangría. Todavía no hay un botón de ejecución.
        </p>
      </aside>
    </div>
  );
}
