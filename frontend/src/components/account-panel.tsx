"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE, type CurrentUser } from "@/lib/api";

export function AccountPanel() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/v1/auth/me`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("API unavailable");
        return (await response.json()) as CurrentUser;
      })
      .then((account) => { setUser(account); setLoading(false); })
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setError("No se pudo consultar tu cuenta. Comprueba que la API esté iniciada.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  async function logout() {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Logout failed");
      router.push("/ingresar");
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
    }
  }

  if (loading) return <p role="status">Cargando tu cuenta…</p>;
  if (!user && !error) {
    return <p>No hay una sesión activa. <Link className="font-bold text-brand underline" href="/ingresar">Ingresa a tu cuenta</Link>.</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      {user && (
        <>
          <p className="mb-2 text-sm font-bold text-muted">Correo registrado</p>
          <p className="mb-8 break-all text-lg font-bold">{user.email}</p>
          <p className="mb-6 text-muted">Define tu objetivo y recibe una recomendación inicial. Las lecciones llegarán en una siguiente etapa.</p>
          <div className="mb-5"><Link className="inline-flex min-h-12 items-center rounded-xl bg-[#17553e] px-5 py-3 font-bold text-white no-underline hover:bg-[#0f422f]" href="/onboarding">Definir mi punto de partida</Link></div>
          <p className="mb-5"><Link className="font-bold text-brand underline underline-offset-4" href="/aprender">Ver el mapa de aprendizaje</Link></p>
          <button className="min-h-12 rounded-xl border border-border px-5 py-3 font-bold hover:bg-surface-muted" onClick={logout} type="button">Cerrar sesión</button>
        </>
      )}
      {error && <p className="mt-4 text-sm" role="alert">{error}</p>}
    </div>
  );
}
