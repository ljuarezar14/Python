"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { API_BASE } from "@/lib/api";
import {
  CONTEXTS,
  EXPERIENCES,
  GOALS,
  INTERESTS,
  TOPICS,
  type ExampleContext,
  type Experience,
  type Goal,
  type Interest,
  type KnownTopic,
  type OnboardingAnswers,
  type OnboardingResult,
  type Recommendation,
  type WeeklyMinutes,
} from "@/lib/onboarding";

const emptyAnswers: OnboardingAnswers = {
  goal: "",
  experience: "",
  weekly_minutes: 0,
  interests: [],
  example_context: "",
  known_topics: [],
};
const fieldsetClass = "mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6";
const optionClass = "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-surface-muted";

export function OnboardingForm() {
  const [answers, setAnswers] = useState<OnboardingAnswers>(emptyAnswers);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/v1/onboarding`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { setLoginRequired(true); return null; }
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("API unavailable");
        return (await response.json()) as OnboardingResult;
      })
      .then((profile) => {
        if (profile) {
          setAnswers({
            goal: profile.goal,
            experience: profile.experience,
            weekly_minutes: profile.weekly_minutes,
            interests: profile.interests,
            example_context: profile.example_context,
            known_topics: profile.known_topics,
          });
          setRecommendation(profile.recommendation);
        }
        setLoading(false);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setError("No se pudo consultar tus preferencias. Comprueba que la API esté iniciada.");
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  function updateAnswers(next: OnboardingAnswers) {
    setAnswers(next);
    setRecommendation(null);
    setMessage("");
    setError("");
    setDirty(true);
  }

  function toggleInterest(value: Interest) {
    if (answers.interests.includes(value)) {
      updateAnswers({ ...answers, interests: answers.interests.filter((item) => item !== value) });
    } else if (answers.interests.length >= 3) {
      setError("Elige hasta tres intereses.");
    } else {
      updateAnswers({ ...answers, interests: [...answers.interests, value] });
    }
  }

  function toggleTopic(value: KnownTopic) {
    updateAnswers({
      ...answers,
      known_topics: answers.known_topics.includes(value)
        ? answers.known_topics.filter((item) => item !== value)
        : [...answers.known_topics, value],
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!answers.goal || !answers.experience || !answers.weekly_minutes || !answers.example_context || answers.interests.length === 0) {
      setError("Completa todas las preguntas obligatorias y elige al menos un interés.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/onboarding`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (response.status === 401) { setLoginRequired(true); return; }
      if (!response.ok) {
        setError("No se pudieron guardar tus respuestas. Revísalas e inténtalo otra vez.");
        return;
      }
      const saved = (await response.json()) as OnboardingResult;
      setAnswers({
        goal: saved.goal,
        experience: saved.experience,
        weekly_minutes: saved.weekly_minutes,
        interests: saved.interests,
        example_context: saved.example_context,
        known_topics: saved.known_topics,
      });
      setRecommendation(saved.recommendation);
      setMessage("Guardamos tus preferencias. Puedes cambiarlas más adelante.");
      setDirty(false);
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba que la API esté iniciada.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Cargando tus preferencias…</p>;
  if (loginRequired) {
    return <p>Ingresa para guardar tus preferencias. <Link className="font-bold text-brand underline" href="/ingresar">Ir al inicio de sesión</Link>.</p>;
  }
  if (loadFailed) {
    return <p role="alert">{error}</p>;
  }

  return (
    <>
      <form onSubmit={submit}>
        <fieldset className={fieldsetClass}>
          <legend className="px-2 text-lg font-bold">1. ¿Qué quieres lograr?</legend>
          {GOALS.map((option) => (
            <label className={optionClass} key={option.value}>
              <input className="mt-1 accent-brand" type="radio" name="goal" value={option.value} checked={answers.goal === option.value} onChange={() => updateAnswers({ ...answers, goal: option.value as Goal })} required />
              <span><strong className="block">{option.label}</strong><span className="text-sm text-muted">{option.description}</span></span>
            </label>
          ))}
        </fieldset>

        <fieldset className={fieldsetClass}>
          <legend className="px-2 text-lg font-bold">2. ¿Qué experiencia tienes?</legend>
          {EXPERIENCES.map((option) => (
            <label className={optionClass} key={option.value}>
              <input className="mt-1 accent-brand" type="radio" name="experience" value={option.value} checked={answers.experience === option.value} onChange={() => updateAnswers({ ...answers, experience: option.value as Experience })} required />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={fieldsetClass}>
          <legend className="px-2 text-lg font-bold">3. ¿Cuánto tiempo puedes dedicar por semana?</legend>
          <label className="mt-3 block text-sm font-bold" htmlFor="weekly-minutes">Tiempo semanal</label>
          <select className="mt-2 min-h-12 w-full rounded-xl border border-border bg-page px-4 text-ink" id="weekly-minutes" value={answers.weekly_minutes} onChange={(event) => updateAnswers({ ...answers, weekly_minutes: Number(event.target.value) as WeeklyMinutes | 0 })} required>
            <option value={0}>Elige una opción</option>
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
            <option value={180}>3 horas o más</option>
          </select>
        </fieldset>

        <fieldset className={fieldsetClass}>
          <legend className="px-2 text-lg font-bold">4. ¿Qué temas te interesan?</legend>
          <p className="mb-3 text-sm text-muted">Elige de uno a tres. El primero que elijas orientará el tema sugerido.</p>
          {INTERESTS.map((option) => (
            <label className={optionClass} key={option.value}>
              <input className="mt-1 accent-brand" type="checkbox" checked={answers.interests.includes(option.value)} onChange={() => toggleInterest(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
          {answers.interests.length > 0 && <p className="mt-2 text-sm text-muted">Interés principal: {INTERESTS.find((item) => item.value === answers.interests[0])?.label}</p>}
        </fieldset>

        <fieldset className={fieldsetClass}>
          <legend className="px-2 text-lg font-bold">5. ¿Qué ejemplos prefieres?</legend>
          {CONTEXTS.map((option) => (
            <label className={optionClass} key={option.value}>
              <input className="mt-1 accent-brand" type="radio" name="example_context" value={option.value} checked={answers.example_context === option.value} onChange={() => updateAnswers({ ...answers, example_context: option.value as ExampleContext })} required />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={fieldsetClass}>
          <legend className="px-2 text-lg font-bold">6. ¿Con cuáles conceptos ya has trabajado?</legend>
          <p className="mb-3 text-sm text-muted">Puedes dejarlo en blanco. Esta respuesta no salta lecciones: el diagnóstico de competencias llegará después.</p>
          {TOPICS.map((option) => (
            <label className={optionClass} key={option.value}>
              <input className="mt-1 accent-brand" type="checkbox" checked={answers.known_topics.includes(option.value)} onChange={() => toggleTopic(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        {error && <p className="mb-4 rounded-xl border border-[#b7562b] p-3 text-sm" role="alert">{error}</p>}
        <p className="mb-4 text-sm text-muted">Tus respuestas se guardan en tu cuenta y puedes editarlas cuando cambien tus intereses.</p>
        {dirty && <p className="mb-4 text-sm font-bold text-brand" role="status">Hay cambios sin guardar.</p>}
        <button className="min-h-12 w-full rounded-xl bg-[#17553e] px-5 py-3 font-bold text-white hover:bg-[#0f422f] disabled:opacity-60" type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar y ver recomendación"}
        </button>
        {message && <p className="mt-4 text-sm text-brand" role="status">{message}</p>}
      </form>

      {recommendation && (
        <section className="mt-10 rounded-2xl border border-border bg-brand-soft p-6 sm:p-8" aria-labelledby="recommendation-title">
          <p className="mb-2 text-sm font-extrabold uppercase tracking-widest text-brand">Recomendación inicial</p>
          <h2 className="mb-5 text-2xl font-bold" id="recommendation-title">{recommendation.starting_point}</h2>
          <p className="mb-6 leading-relaxed">{recommendation.reason}</p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="font-bold">Enfoque</dt><dd className="text-muted">{recommendation.focus}</dd></div>
            <div><dt className="font-bold">Tema sugerido</dt><dd className="text-muted">{recommendation.suggested_theme}</dd></div>
            <div><dt className="font-bold">Ritmo posible</dt><dd className="text-muted">{recommendation.weekly_plan}</dd></div>
            <div><dt className="font-bold">Ejemplo de proyecto futuro</dt><dd className="text-muted">{recommendation.example_project}</dd></div>
          </dl>
          <p className="mt-6 text-sm text-muted">La ruta y las lecciones aún están en preparación. Esta sugerencia usa reglas transparentes, versión {recommendation.rule_version}, y no acredita conocimientos.</p>
        </section>
      )}
    </>
  );
}
