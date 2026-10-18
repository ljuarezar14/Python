"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { API_BASE } from "@/lib/api";

type AuthFormProps = { mode: "register" | "login" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const register = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      if (!response.ok) {
        if (response.status === 429) {
          setError("Demasiados intentos. Espera un minuto y vuelve a probar.");
        } else if (response.status === 409) {
          setError("No se pudo crear la cuenta con ese correo.");
        } else if (response.status === 401) {
          setError("Correo o contraseña incorrectos.");
        } else {
          setError("No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.");
        }
        return;
      }
      router.push("/cuenta");
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba que la API esté iniciada.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="rounded-2xl border border-border bg-surface p-6 sm:p-8" onSubmit={submit}>
      <div className="mb-5">
        <label className="mb-2 block font-bold" htmlFor="email">Correo electrónico</label>
        <input className="min-h-12 w-full rounded-xl border border-border bg-page px-4 text-ink" id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div className="mb-6">
        <label className="mb-2 block font-bold" htmlFor="password">Contraseña</label>
        <input className="min-h-12 w-full rounded-xl border border-border bg-page px-4 text-ink" id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} required />
        {register && <p className="mt-2 text-sm text-muted">Usa al menos 12 caracteres.</p>}
      </div>
      {error && <p className="mb-5 rounded-xl border border-[#b7562b] p-3 text-sm" role="alert">{error}</p>}
      <button className="min-h-12 w-full rounded-xl bg-[#17553e] px-5 py-3 font-bold text-white hover:bg-[#0f422f] disabled:opacity-60" type="submit" disabled={pending}>
        {pending ? "Espera un momento…" : register ? "Crear cuenta" : "Ingresar"}
      </button>
      <p className="mt-6 text-center text-sm text-muted">
        {register ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}
        <Link className="font-bold text-brand underline" href={register ? "/ingresar" : "/registro"}>{register ? "Ingresa" : "Regístrate"}</Link>
      </p>
    </form>
  );
}
