"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "../supabase-env";
import type { Backend } from "./types";
import { BackendError } from "./types";

let client: ReturnType<typeof createBrowserClient> | null = null;
function sb() {
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return client;
}

const rpc = <T,>(op: string, body?: unknown) => post<T>(`/api/rpc/${op}`, body);

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(json.error ?? "Algo deu errado. Tente novamente.", res.status);
  return json as T;
}

function authError(e: { message?: string } | null) {
  if (!e) return;
  const m = e.message ?? "";
  if (/invalid login/i.test(m)) throw new BackendError("E-mail ou senha incorretos.", 401);
  if (/not confirmed/i.test(m)) throw new BackendError("Confirme seu e-mail com o código de 6 dígitos.", 401);
  if (/expired|invalid.*otp|token/i.test(m)) throw new BackendError("Código inválido ou expirado.", 400);
  if (/already registered/i.test(m)) throw new BackendError("Já existe uma conta com este e-mail.", 409);
  throw new BackendError(m || "Não foi possível concluir. Tente novamente.");
}

const origin = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

export const liveBackend: Backend = {
  mode: "live",
  getSession: () => rpc("session"),

  async signIn(email, password) {
    authError((await sb().auth.signInWithPassword({ email, password })).error);
  },
  async signUp(email, password, name, referralCode) {
    const { data, error } = await sb().auth.signUp({ email, password, options: { data: { name, ...(referralCode ? { referral_code: referralCode } : {}) } } });
    authError(error);
    return { needsVerification: !data.session };
  },
  async verifyCode(email, code) {
    authError((await sb().auth.verifyOtp({ email, token: code, type: "signup" })).error);
  },
  async resendCode(email) {
    authError((await sb().auth.resend({ email, type: "signup" })).error);
  },
  async signInWithGoogle() {
    authError((await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback?next=/painel` } })).error);
  },
  async requestPasswordReset(email) {
    authError((await sb().auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth/callback?next=/nova-senha` })).error);
  },
  async updatePassword(password) {
    authError((await sb().auth.updateUser({ password })).error);
  },
  async signOut() {
    await sb().auth.signOut();
  },

  listDirectory: () => rpc("directory"),
  getBusiness: (id) => rpc("business", { id }),
  saveMyBusiness: (input, referralCode) => rpc("saveBusiness", { ...input, referralCode }),
  checkReferral: (code) => rpc("checkReferral", { code }),
  listConversations: () => rpc("conversations"),
  getThread: (id) => rpc("thread", { id }),
  sendMessage: (id, body) => rpc("send", { id, body }),
  listPartnerships: () => rpc("partnerships"),
  partnershipWith: (id) => rpc("partnershipWith", { id }),
  propose: (id, type, intro) => rpc("propose", { id, type, intro }),
  respond: (id, accept) => rpc("respond", { id, accept }),
  cancel: (id) => rpc("cancel", { id }),
  startCheckout: () => post("/api/stripe/checkout"),
  openPortal: () => post("/api/stripe/portal"),
  adminStats: () => rpc("admin"),
};
