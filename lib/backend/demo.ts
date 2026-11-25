"use client";
/**
 * Backend do modo demonstração: as mesmas regras de `lib/core.ts`, rodando
 * sobre um banco fictício guardado no navegador (localStorage).
 */
import * as core from "../core";
import type { Repo } from "../core";
import { buildSeed, DEMO_ADMIN, DEMO_DB_VERSION, DEMO_USER, type DemoDb } from "../seed";
import { now } from "../clock";
import { addMonth, checkoutTrialEnd, FOUNDER_LIMIT, freeActive, normalizeCode, PRICE_CENTS } from "../plan";
import { RuleError, subscriptionEntitles } from "../rules";
import type { Backend } from "./types";
import { BackendError } from "./types";
import type { Business, Membership, Message, Partnership, Session, Subscription } from "../types";

const DB_KEY = "conectabc:demo-db";
const SESSION_KEY = "conectabc:demo-session";
const PW_KEY = "conectabc:demo-pw";
export const DEMO_EVENT = "conectabc:demo-change";
export const DEMO_CODE = "123456";

let memory: DemoDb | null = null;

function load(): DemoDb {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb;
      if (parsed.version === DEMO_DB_VERSION && Date.now() - parsed.seededAt < 15 * 86400000) return (memory = parsed);
    }
  } catch {}
  memory = buildSeed();
  save();
  return memory;
}

function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(memory));
  } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_EVENT));
}

function sessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function setSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const repo: Repo = {
  async listBusinesses(limit) {
    return clone(load().businesses.slice(0, limit));
  },
  async getBusiness(id) {
    return clone(load().businesses.find((b) => b.id === id) ?? null);
  },
  async getBusinessByOwner(ownerId) {
    return clone(load().businesses.find((b) => b.ownerId === ownerId) ?? null);
  },
  async getBusinessesByIds(ids) {
    const set = new Set(ids);
    return clone(load().businesses.filter((b) => set.has(b.id)));
  },
  async insertBusiness(b) {
    const db = load();
    if (db.businesses.some((x) => x.ownerId === b.ownerId)) throw new RuleError("Cada conta pode cadastrar apenas um negócio.", 409);
    const row: Business = { ...b, id: "b-" + uid(), createdAt: now().toISOString() };
    db.businesses.push(row);
    save();
    return clone(row);
  },
  async updateBusiness(id, ownerId, data) {
    const db = load();
    const b = db.businesses.find((x) => x.id === id && x.ownerId === ownerId);
    if (!b) throw new RuleError("Negócio não encontrado.", 404);
    Object.assign(b, data);
    save();
    return clone(b);
  },
  async listMessagesForUser(userId) {
    return clone(load().messages.filter((m) => m.senderId === userId || m.recipientId === userId));
  },
  async listThread(userId, mine, other) {
    return clone(
      load().messages.filter(
        (m) =>
          (m.senderId === userId || m.recipientId === userId) &&
          ((m.senderBusinessId === mine && m.recipientBusinessId === other) ||
            (m.senderBusinessId === other && m.recipientBusinessId === mine)),
      ),
    );
  },
  async insertMessage(m) {
    const row: Message = { ...m, id: "m-" + uid(), createdAt: now().toISOString(), readAt: null };
    load().messages.push(row);
    save();
    return clone(row);
  },
  async markThreadRead(userId, other, at) {
    let changed = false;
    for (const m of load().messages)
      if (m.recipientId === userId && m.senderBusinessId === other && !m.readAt) {
        m.readAt = at;
        changed = true;
      }
    if (changed) save();
  },
  async listPartnershipsForBusiness(id) {
    return clone(load().partnerships.filter((p) => p.requesterBusinessId === id || p.recipientBusinessId === id));
  },
  async listPartnershipsBetween(a, b) {
    return clone(
      load().partnerships.filter(
        (p) =>
          (p.requesterBusinessId === a && p.recipientBusinessId === b) ||
          (p.requesterBusinessId === b && p.recipientBusinessId === a),
      ),
    );
  },
  async getPartnership(id) {
    return clone(load().partnerships.find((p) => p.id === id) ?? null);
  },
  async insertPartnership(p) {
    const row: Partnership = { ...p, id: "p-" + uid(), status: "pending", createdAt: now().toISOString(), respondedAt: null };
    load().partnerships.push(row);
    save();
    return clone(row);
  },
  async transitionPartnership(id, to, at) {
    const p = load().partnerships.find((x) => x.id === id);
    if (!p || p.status !== "pending") return null;
    p.status = to;
    p.respondedAt = at;
    save();
    return clone(p);
  },
  async getSubscription(userId) {
    return clone(load().subscriptions.find((s) => s.userId === userId) ?? null);
  },
  async listSubscriptions() {
    return clone(load().subscriptions);
  },
  async getMembership(userId) {
    return clone(load().memberships.find((m) => m.userId === userId) ?? null);
  },
  async getMembershipByCode(code) {
    return clone(load().memberships.find((m) => m.referralCode === code) ?? null);
  },
  async listMemberships() {
    return clone(load().memberships);
  },
  async claimMembership(userId, code, founder) {
    const db = load();
    const have = db.memberships.find((m) => m.userId === userId);
    if (have) return clone(have);
    const free = founder && db.foundersUsed < FOUNDER_LIMIT;
    if (free) db.foundersUsed++;
    const row: Membership = {
      userId,
      founderNumber: free ? db.foundersUsed : null,
      freeUntil: free ? addMonth(now()).toISOString() : null,
      referralCode: uid().toUpperCase().padEnd(6, "0").slice(0, 6),
      referredCode: code,
    };
    db.memberships.push(row);
    save();
    return clone(row);
  },
  async countReferrals(code) {
    return load().memberships.filter((m) => m.referredCode === code).length;
  },
  async foundersUsed() {
    return load().foundersUsed;
  },
  async listAdminIds() {
    return load().users.filter((u) => u.isAdmin).map((u) => u.id);
  },
  async listProfiles() {
    return clone(load().users.map((u) => ({ ...u, createdAt: null })));
  },
  async activityCounts() {
    const d = load();
    const n = (s: string) => d.partnerships.filter((p) => p.status === s).length;
    return { accepted: n("accepted"), pending: n("pending"), messages: d.messages.length };
  },
};

function ctx(): core.Ctx {
  const id = sessionUserId();
  const user = id ? load().users.find((u) => u.id === id) : undefined;
  return {
    repo,
    userId: user?.id ?? null,
    isAdmin: !!user?.isAdmin,
    now: now(),
    async isEntitled(userId) {
      const u = load().users.find((x) => x.id === userId);
      if (u?.isAdmin) return true;
      if (freeActive(load().memberships.find((m) => m.userId === userId), now())) return true;
      return subscriptionEntitles(load().subscriptions.find((s) => s.userId === userId) ?? null, now());
    },
  };
}

const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms + Math.random() * 120));

async function run<T>(fn: () => Promise<T>, delay?: number): Promise<T> {
  await wait(delay);
  try {
    return await fn();
  } catch (e) {
    if (e instanceof RuleError) throw new BackendError(e.message, e.status);
    throw e;
  }
}

/* ---------- Respostas automáticas da demo, para a conversa parecer viva ---------- */
const REPLIES = [
  "Oi! Que bom receber sua mensagem 😊 Vamos conversar sim.",
  "Adorei a ideia! Consegue passar aqui essa semana para a gente alinhar?",
  "Combinado! Vou falar com a equipe e te retorno ainda hoje.",
  "Perfeito. Pode me mandar os detalhes por aqui mesmo.",
  "Show! Nossos clientes vão gostar muito disso.",
];
function scheduleReply(m: Message) {
  const delay = 3500 + Math.random() * 2500;
  setTimeout(() => {
    const db = load();
    if (!db.users.some((u) => u.id === m.recipientId)) return;
    const n = db.messages.filter((x) => x.senderBusinessId === m.recipientBusinessId).length;
    db.messages.push({
      id: "m-" + uid(),
      senderId: m.recipientId,
      recipientId: m.senderId,
      senderBusinessId: m.recipientBusinessId,
      recipientBusinessId: m.senderBusinessId,
      body: REPLIES[n % REPLIES.length],
      createdAt: now().toISOString(),
      readAt: null,
    });
    save();
  }, delay);
}

function users() {
  return load().users as (DemoDb["users"][number] & { password?: string; verified?: boolean })[];
}
function passwords(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PW_KEY) || "{}");
  } catch {
    return {};
  }
}
function setPassword(email: string, pw: string) {
  const all = passwords();
  all[email.toLowerCase()] = pw;
  try {
    localStorage.setItem(PW_KEY, JSON.stringify(all));
  } catch {}
}
const pending = new Map<string, { password: string; name: string; code?: string | null }>();

export const demoBackend: Backend = {
  mode: "demo",

  async getSession(): Promise<Session> {
    const c = ctx();
    const user = c.userId ? users().find((u) => u.id === c.userId)! : null;
    const offer = await core.offer(c);
    if (!user) return { user: null, business: null, subscription: null, entitled: false, membership: null, referrals: 0, pendingCode: null, offer };
    const membership = await repo.getMembership(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
      business: await repo.getBusinessByOwner(user.id),
      subscription: await repo.getSubscription(user.id),
      entitled: await c.isEntitled(user.id),
      membership,
      referrals: membership ? await repo.countReferrals(membership.referralCode) : 0,
      pendingCode: load().pendingCodes[user.id] ?? null,
      offer,
    };
  },

  async signIn(email, password) {
    await wait(500);
    const e = email.trim().toLowerCase();
    const u = users().find((x) => x.email === e);
    const pw = passwords()[e] ?? (u && (u.id === DEMO_USER.id || u.id === DEMO_ADMIN.id) ? "demo1234" : undefined);
    if (!u || pw !== password) throw new BackendError("E-mail ou senha incorretos. Na demo, use voce@demo.conectabc / demo1234.", 401);
    setSession(u.id);
  },
  async signUp(email, password, name, referralCode) {
    await wait(500);
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new BackendError("Informe um e-mail válido.");
    if (password.length < 8) throw new BackendError("A senha precisa de pelo menos 8 caracteres.");
    if (users().some((u) => u.email === e)) throw new BackendError("Já existe uma conta com este e-mail.", 409);
    pending.set(e, { password, name: name.trim() || e.split("@")[0], code: normalizeCode(referralCode) });
    return { needsVerification: true };
  },
  async verifyCode(email, code) {
    await wait(500);
    const e = email.trim().toLowerCase();
    if (code !== DEMO_CODE) throw new BackendError(`Código incorreto. Na demo, o código é ${DEMO_CODE}.`);
    const p: { password: string; name: string; code?: string | null } = pending.get(e) ?? { password: "demo1234", name: e.split("@")[0] };
    const id = "u-" + uid();
    load().users.push({ id, email: e, name: p.name, isAdmin: false });
    if (p.code) load().pendingCodes[id] = p.code;
    save();
    setPassword(e, p.password);
    pending.delete(e);
    setSession(id);
  },
  async resendCode() {
    await wait(400);
  },
  async signInWithGoogle() {
    await wait(600);
    setSession(DEMO_USER.id);
  },
  async requestPasswordReset() {
    await wait(500);
  },
  async updatePassword(password) {
    await wait(400);
    const u = users().find((x) => x.id === sessionUserId());
    if (u) setPassword(u.email, password);
  },
  async signOut() {
    setSession(null);
    save();
  },
  async demoLogin(as) {
    await wait(350);
    if (as === "admin") return setSession(DEMO_ADMIN.id);
    if (as === "member") return setSession(DEMO_USER.id);
    const id = "u-novo-" + uid();
    load().users.push({ id, email: `novo-${id.slice(-4)}@demo.conectabc`, name: "Novo membro (demo)", isAdmin: false });
    save();
    setSession(id);
  },
  async demoReset() {
    memory = buildSeed();
    save();
  },

  listDirectory: () => run(() => core.directory(ctx())),
  getBusiness: (id) => run(() => core.businessById(ctx(), id), 120),
  saveMyBusiness: (input, code) => run(() => core.saveMyBusiness(ctx(), input, code), 600),
  checkReferral: (code) => run(() => core.checkReferral(ctx(), code), 200),
  listConversations: () => run(() => core.conversations(ctx()), 150),
  getThread: (id) => run(() => core.thread(ctx(), id), 80),
  sendMessage: (id, body) =>
    run(async () => {
      const m = await core.sendMessage(ctx(), id, body);
      scheduleReply(m);
      return m;
    }, 120),
  listPartnerships: () => run(() => core.partnerships(ctx())),
  partnershipWith: (id) => run(() => core.livePartnershipWith(ctx(), id), 60),
  propose: (id, type, intro) => run(() => core.propose(ctx(), id, type, intro), 500),
  respond: (id, accept) => run(() => core.respond(ctx(), id, accept), 400),
  cancel: (id) => run(() => core.cancel(ctx(), id), 400),

  async startCheckout() {
    await wait(300);
    if (!sessionUserId()) throw new BackendError("Entre na sua conta.", 401);
    return { url: "/painel/assinatura/checkout-demo" };
  },
  async openPortal() {
    await wait(300);
    return { url: "/painel/assinatura/portal-demo" };
  },
  adminStats: () =>
    run(() =>
      core.adminStats(
        ctx(),
        [
          { key: "STRIPE_SECRET_KEY", label: "Chave secreta do Stripe", ok: false, detail: "Modo demonstração: sem chaves configuradas." },
          { key: "STRIPE_WEBHOOK_SECRET", label: "Segredo do webhook", ok: false },
          { key: "STRIPE_PRICE_ID", label: "Preço R$ 49,99/mês (BRL)", ok: false },
          { key: "NEXT_PUBLIC_SITE_URL", label: "URL pública do site", ok: typeof window !== "undefined", detail: typeof window !== "undefined" ? window.location.origin : undefined },
          { key: "SUPABASE", label: "Banco de dados Supabase", ok: false, detail: "Usando dados fictícios no navegador." },
        ],
        "unset",
      ),
    ),
};

/** Ações exclusivas do checkout/portal simulados da demo. */
export const demoBilling = {
  async completeCheckout() {
    await wait(1200);
    const id = sessionUserId();
    if (!id) throw new BackendError("Entre na sua conta.", 401);
    const n = now();
    const db = load();
    const member = db.memberships.find((m) => m.userId === id) ?? null;
    if (!member) throw new BackendError("Cadastre seu negócio antes de assinar.", 409);
    const trialEnd = checkoutTrialEnd(member, n);
    const sub: Subscription = {
      userId: id,
      status: trialEnd ? "trialing" : "active",
      trialEnd: trialEnd?.toISOString() ?? null,
      currentPeriodEnd: trialEnd ? null : new Date(n.getTime() + 30 * 86400000).toISOString(),
      amount: PRICE_CENTS,
      currency: "brl",
    };
    db.subscriptions = db.subscriptions.filter((s) => s.userId !== id).concat(sub);
    db.billingEvents.push("evt_demo_" + uid());
    save();
  },
  async cancelSubscription() {
    await wait(800);
    const id = sessionUserId();
    const s = load().subscriptions.find((x) => x.userId === id);
    if (s) {
      s.status = "canceled";
      save();
    }
  },
};
