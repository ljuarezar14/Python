"use client";

// Borrador de código guardado solo en este navegador (ADR-0005).

import { useEffect, useState } from "react";

export const MAX_DRAFT_LENGTH = 100_000;

export function useLocalDraft(key: string | null, initialCode: string, initialMessage: string) {
  const [code, setCode] = useState(initialCode);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Cargando borrador…");

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = window.localStorage.getItem(key);
        if (saved !== null && saved.length <= MAX_DRAFT_LENGTH) {
          setCode(saved);
          setSaveStatus("Borrador recuperado de este navegador.");
        } else {
          setCode(initialCode);
          setSaveStatus(initialMessage);
        }
      } catch {
        setCode(initialCode);
        setSaveStatus("El almacenamiento del navegador no está disponible.");
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [key, initialCode, initialMessage]);

  useEffect(() => {
    if (!ready || key === null) return;
    const timer = window.setTimeout(() => {
      if (code.length > MAX_DRAFT_LENGTH) {
        setSaveStatus("El borrador supera el límite de 100 000 caracteres y no se guardó.");
        return;
      }
      try {
        window.localStorage.setItem(key, code);
        setSaveStatus("Borrador guardado en este navegador.");
      } catch {
        setSaveStatus("No se pudo guardar el borrador en este navegador.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [code, key, ready]);

  function changeCode(next: string) {
    setCode(next);
    setSaveStatus("Guardando borrador…");
  }

  return { code, ready, saveStatus, changeCode };
}
