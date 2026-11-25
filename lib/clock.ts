"use client";
/**
 * Relógio do app. No modo demonstração, `?agora=2027-02-01` simula outra data
 * (útil para ver o fim do mês grátis). Fora da demo, sempre o horário real.
 */
const KEY = "conectabc:agora";

export function initClock(demo: boolean) {
  if (typeof window === "undefined" || !demo) return;
  const p = new URLSearchParams(window.location.search).get("agora");
  try {
    if (p === "real" || p === "") sessionStorage.removeItem(KEY);
    if (p === "real" || p === "") sessionStorage.removeItem(KEY + ":t");
    else if (p && !Number.isNaN(Date.parse(p))) {
      sessionStorage.setItem(KEY, new Date(p).toISOString());
      sessionStorage.setItem(KEY + ":t", String(Date.now()));
    }
  } catch {}
}

export function now(): Date {
  if (typeof window !== "undefined") {
    try {
      const v = sessionStorage.getItem(KEY);
      if (v) {
        const base = new Date(v).getTime();
        const started = Number(sessionStorage.getItem(KEY + ":t")) || Date.now();
        return new Date(base + (Date.now() - started));
      }
    } catch {}
  }
  return new Date();
}

export function timeTravelActive(): boolean {
  try {
    return typeof window !== "undefined" && !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}
