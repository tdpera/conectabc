"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { backend, IS_DEMO } from "@/lib/backend";
import { DEMO_EVENT } from "@/lib/backend/demo";
import { initClock, now } from "@/lib/clock";
import { isLaunched } from "@/lib/launch";
import type { Session } from "@/lib/types";
import { Toaster } from "@/components/ui/toast";

interface AppState {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<Session>;
  demo: boolean;
  launched: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [launched, setLaunched] = useState(false);

  const refresh = useCallback(async () => {
    const s = await backend.getSession().catch(() => ({ user: null, business: null, subscription: null, entitled: false }) as Session);
    setSession(s);
    setLoading(false);
    setLaunched(isLaunched(now()));
    return s;
  }, []);

  useEffect(() => {
    initClock(IS_DEMO);
    refresh();
    const t = setInterval(() => setLaunched(isLaunched(now())), 30_000);
    if (!IS_DEMO) return () => clearInterval(t);
    // Mantém abas da demo sincronizadas.
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("conectabc:demo")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const value = useMemo(() => ({ session, loading, refresh, demo: IS_DEMO, launched }), [session, loading, refresh, launched]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Toaster />
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppProvider");
  return v;
}

/** Re-executa `fn` quando o banco da demo muda (respostas automáticas etc.). */
export function useDemoChanges(fn: () => void) {
  useEffect(() => {
    if (!IS_DEMO) return;
    window.addEventListener(DEMO_EVENT, fn);
    return () => window.removeEventListener(DEMO_EVENT, fn);
  }, [fn]);
}
