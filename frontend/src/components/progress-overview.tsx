"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/api";
import { describeResult, fetchProgressSummary } from "@/lib/progress";
import type { SummaryLoad } from "@/lib/progress";

const SHOWN_ITEMS = 5;

export function ProgressOverview() {
  const [load, setLoad] = useState<SummaryLoad | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProgressSummary(API_BASE).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => { cancelled = true; };
  }, []);

  let body: ReactNode;
  if (load === null) {
    body = <p className="text-muted" role="status">Cargando tu progreso…</p>;
  } else if (load.status !== "ok") {
    body = <p className="text-muted">No se pudo consultar tu progreso. {load.status === "error" ? load.message : ""}</p>;
  } else if (load.summary.items.length === 0) {
    body = (
      <p className="text-muted">
        Todavía no has comprobado ningún ejercicio. Cuando lo hagas, tu último intento aparecerá aquí para que puedas retomarlo.
      </p>
    );
  } else {
    const { solved_count: solved, items } = load.summary;
    body = (
      <>
        <p className="text-lg font-bold">
          {solved === 1 ? "1 ejercicio resuelto" : `${solved} ejercicios resueltos`}
        </p>
        <h3 className="mt-5 text-sm font-bold text-muted">Continuar donde lo dejaste</h3>
        <ul className="mt-2 space-y-2">
          {items.slice(0, SHOWN_ITEMS).map((item) => (
            <li key={item.exercise_id}>
              <Link
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border px-4 py-2 no-underline hover:bg-surface-muted"
                href={`/practicar/ejercicios/${encodeURIComponent(item.exercise_id)}`}
              >
                <span className="font-semibold text-brand underline underline-offset-4">{item.title}</span>
                <span className="text-sm text-muted">{describeResult(item)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className="mb-8 rounded-xl border border-border p-5" aria-labelledby="overview-title">
      <h2 className="mb-3 text-lg font-bold" id="overview-title">Tu progreso</h2>
      {body}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        El resultado de cada ejercicio lo calcula tu navegador. Sirve para orientarte y retomar tu trabajo; no es una acreditación.
      </p>
    </section>
  );
}
