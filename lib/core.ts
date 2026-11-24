/**
 * Regras de negócio do ConectaBC, escritas uma única vez e executadas tanto no
 * servidor (Supabase, service role) quanto no modo demonstração (memória local).
 * Toda ação re-verifica dono, negócio e direito de acesso — nada é confiado ao cliente.
 */
import { isLaunched, PRICE_CENTS } from "./launch";
import {
  assertCanCancel, assertCanMessage, assertCanPropose, assertCanRespond, introSchema,
  messageSchema, parseBusiness, parseOrThrow, RuleError, toPublic,
} from "./rules";
import type {
  AdminStats, Business, BusinessInput, Conversation, Message, Partnership,
  PartnershipStatus, PartnershipType, Profile, PublicBusiness, Subscription,
} from "./types";
import type { DirectoryResult, PartnershipsResult, DirectoryEntry } from "./backend/types";
import { PARTNERSHIP_TYPES } from "./categories";

export const DIRECTORY_LIMIT = 5000;

export interface Repo {
  listBusinesses(limit: number): Promise<Business[]>;
  getBusiness(id: string): Promise<Business | null>;
  getBusinessByOwner(ownerId: string): Promise<Business | null>;
  getBusinessesByIds(ids: string[]): Promise<Business[]>;
  insertBusiness(b: Omit<Business, "id" | "createdAt">): Promise<Business>;
  updateBusiness(id: string, ownerId: string, b: BusinessInput): Promise<Business>;

  listMessagesForUser(userId: string): Promise<Message[]>;
  listThread(userId: string, myBusinessId: string, otherBusinessId: string): Promise<Message[]>;
  insertMessage(m: Omit<Message, "id" | "createdAt" | "readAt">): Promise<Message>;
  markThreadRead(userId: string, otherBusinessId: string, at: string): Promise<void>;

  listPartnershipsForBusiness(businessId: string): Promise<Partnership[]>;
  listPartnershipsBetween(a: string, b: string): Promise<Partnership[]>;
  getPartnership(id: string): Promise<Partnership | null>;
  insertPartnership(p: Omit<Partnership, "id" | "createdAt" | "respondedAt" | "status">): Promise<Partnership>;
  /** Atualiza somente se o status atual for `pending` (resposta única). */
  transitionPartnership(id: string, to: PartnershipStatus, at: string): Promise<Partnership | null>;

  getSubscription(userId: string): Promise<Subscription | null>;
  listSubscriptions(): Promise<Subscription[]>;
  listProfiles(): Promise<Profile[]>;
  activityCounts(): Promise<{ accepted: number; pending: number; messages: number }>;
}

export interface Ctx {
  repo: Repo;
  userId: string | null;
  isAdmin: boolean;
  now: Date;
  /** Verifica (ao vivo, no servidor) se o dono tem acesso à rede. */
  isEntitled(userId: string): Promise<boolean>;
}

async function requireUser(ctx: Ctx): Promise<string> {
  if (!ctx.userId) throw new RuleError("Entre na sua conta para continuar.", 401);
  return ctx.userId;
}

async function requireEntitled(ctx: Ctx): Promise<string> {
  const uid = await requireUser(ctx);
  if (!(await ctx.isEntitled(uid))) throw new RuleError("Sua assinatura não está ativa.", 402);
  return uid;
}

async function filterEntitled(ctx: Ctx, list: Business[]): Promise<Business[]> {
  if (!isLaunched(ctx.now)) return list;
  const owners = [...new Set(list.map((b) => b.ownerId))];
  const ok = new Set<string>();
  await Promise.all(owners.map(async (o) => { if (await ctx.isEntitled(o)) ok.add(o); }));
  return list.filter((b) => ok.has(b.ownerId));
}

export async function directory(ctx: Ctx): Promise<DirectoryResult> {
  const launched = isLaunched(ctx.now);
  if (!ctx.userId) {
    if (launched) return { businesses: [], full: false, locked: true, paywalled: false };
    const all = (await ctx.repo.listBusinesses(DIRECTORY_LIMIT)).filter((b) => b.isVisible);
    return { businesses: all.map(toPublic), full: false, locked: false, paywalled: false };
  }
  if (!(await ctx.isEntitled(ctx.userId))) return { businesses: [], full: false, locked: false, paywalled: true };
  const all = (await ctx.repo.listBusinesses(DIRECTORY_LIMIT)).filter((b) => b.isVisible);
  return { businesses: await filterEntitled(ctx, all), full: true, locked: false, paywalled: false };
}

export async function businessById(ctx: Ctx, id: string): Promise<DirectoryEntry | null> {
  const b = await ctx.repo.getBusiness(id);
  if (!b) return null;
  if (ctx.userId && b.ownerId === ctx.userId) return b; // o dono sempre vê o próprio
  if (!b.isVisible) return null;
  if (!ctx.userId) return isLaunched(ctx.now) ? null : toPublic(b);
  if (!(await ctx.isEntitled(ctx.userId))) return null;
  if (isLaunched(ctx.now) && !(await ctx.isEntitled(b.ownerId))) return null;
  return b;
}

export async function saveMyBusiness(ctx: Ctx, input: unknown): Promise<Business> {
  const uid = await requireUser(ctx); // editar o próprio negócio nunca exige assinatura
  const data = parseBusiness(input);
  const existing = await ctx.repo.getBusinessByOwner(uid);
  if (existing) return ctx.repo.updateBusiness(existing.id, uid, data);
  return ctx.repo.insertBusiness({ ...data, ownerId: uid, isVisible: true });
}

async function counterpart(ctx: Ctx, otherBusinessId: string) {
  const uid = await requireEntitled(ctx);
  const mine = await ctx.repo.getBusinessByOwner(uid);
  const other = await ctx.repo.getBusiness(otherBusinessId);
  assertCanMessage(mine, other);
  if (isLaunched(ctx.now) && !(await ctx.isEntitled(other!.ownerId)))
    throw new RuleError("Este negócio não está disponível na rede no momento.", 403);
  return { uid, mine: mine!, other: other! };
}

export async function conversations(ctx: Ctx): Promise<Conversation[]> {
  const uid = await requireEntitled(ctx);
  const mine = await ctx.repo.getBusinessByOwner(uid);
  if (!mine) return [];
  const msgs = await ctx.repo.listMessagesForUser(uid);
  const byOther = new Map<string, { last: Message; unread: number }>();
  for (const m of msgs) {
    const other = m.senderBusinessId === mine.id ? m.recipientBusinessId : m.senderBusinessId;
    const cur = byOther.get(other) ?? { last: m, unread: 0 };
    if (m.createdAt >= cur.last.createdAt) cur.last = m;
    if (m.recipientId === uid && !m.readAt) cur.unread++;
    byOther.set(other, cur);
  }
  const businesses = await ctx.repo.getBusinessesByIds([...byOther.keys()]);
  return businesses
    .map((b) => ({ business: toPublic(b), lastMessage: byOther.get(b.id)!.last, unread: byOther.get(b.id)!.unread }))
    .sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
}

export async function thread(ctx: Ctx, otherBusinessId: string): Promise<Message[]> {
  const uid = await requireEntitled(ctx);
  const mine = await ctx.repo.getBusinessByOwner(uid);
  if (!mine) throw new RuleError("Cadastre seu negócio antes de conversar.", 403);
  const list = await ctx.repo.listThread(uid, mine.id, otherBusinessId);
  if (list.some((m) => m.recipientId === uid && !m.readAt)) await ctx.repo.markThreadRead(uid, otherBusinessId, ctx.now.toISOString());
  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function sendMessage(ctx: Ctx, otherBusinessId: string, body: unknown): Promise<Message> {
  const text = parseOrThrow(messageSchema, body);
  const { uid, mine, other } = await counterpart(ctx, otherBusinessId);
  return ctx.repo.insertMessage({
    senderId: uid, recipientId: other.ownerId, senderBusinessId: mine.id, recipientBusinessId: other.id, body: text,
  });
}

export async function partnerships(ctx: Ctx): Promise<PartnershipsResult> {
  const uid = await requireEntitled(ctx);
  const mine = await ctx.repo.getBusinessByOwner(uid);
  if (!mine) return { partnerships: [], businesses: {} };
  const list = await ctx.repo.listPartnershipsForBusiness(mine.id);
  const ids = [...new Set(list.flatMap((p) => [p.requesterBusinessId, p.recipientBusinessId]))];
  const bs = await ctx.repo.getBusinessesByIds(ids);
  return {
    partnerships: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    businesses: Object.fromEntries(bs.map((b) => [b.id, toPublic(b)])),
  };
}

export async function livePartnershipWith(ctx: Ctx, otherBusinessId: string): Promise<Partnership | null> {
  if (!ctx.userId) return null;
  const mine = await ctx.repo.getBusinessByOwner(ctx.userId);
  if (!mine) return null;
  const list = await ctx.repo.listPartnershipsBetween(mine.id, otherBusinessId);
  return list.find((p) => p.status === "pending" || p.status === "accepted") ?? null;
}

export async function propose(ctx: Ctx, otherBusinessId: string, type: unknown, intro: unknown): Promise<Partnership> {
  if (!PARTNERSHIP_TYPES.some((t) => t.id === type)) throw new RuleError("Escolha o tipo de parceria.");
  const text = parseOrThrow(introSchema, intro);
  const { uid, mine, other } = await counterpart(ctx, otherBusinessId);
  assertCanPropose(await ctx.repo.listPartnershipsBetween(mine.id, other.id), mine, other);
  return ctx.repo.insertPartnership({
    requesterId: uid, recipientId: other.ownerId, requesterBusinessId: mine.id, recipientBusinessId: other.id,
    type: type as PartnershipType, intro: text,
  });
}

export async function respond(ctx: Ctx, id: string, accept: boolean): Promise<Partnership> {
  const uid = await requireEntitled(ctx);
  const p = await ctx.repo.getPartnership(id);
  assertCanRespond(p ?? undefined, uid);
  const r = await ctx.repo.transitionPartnership(id, accept ? "accepted" : "declined", ctx.now.toISOString());
  if (!r) throw new RuleError("Esta proposta já foi respondida.", 409);
  return r;
}

export async function cancel(ctx: Ctx, id: string): Promise<Partnership> {
  const uid = await requireEntitled(ctx);
  const p = await ctx.repo.getPartnership(id);
  assertCanCancel(p ?? undefined, uid);
  const r = await ctx.repo.transitionPartnership(id, "cancelled", ctx.now.toISOString());
  if (!r) throw new RuleError("Só é possível cancelar propostas pendentes.", 409);
  return r;
}

export async function adminStats(ctx: Ctx, config: AdminStats["config"], mode: AdminStats["mode"]): Promise<AdminStats> {
  if (!ctx.isAdmin) throw new RuleError("Acesso restrito.", 403);
  const [all, subs, profiles, counts] = await Promise.all([
    ctx.repo.listBusinesses(DIRECTORY_LIMIT), ctx.repo.listSubscriptions(), ctx.repo.listProfiles(), ctx.repo.activityCounts(),
  ]);
  const byUser = new Map(subs.map((s) => [s.userId, s]));
  const byOwner = new Map(all.map((b) => [b.ownerId, b]));
  const known = new Set(profiles.map((p) => p.id));
  const row = (id: string, p: Profile | null, b: Business | null): AdminStats["rows"][number] => ({
    userId: id, ownerName: p?.name ?? "", ownerEmail: p?.email ?? "—", joinedAt: p?.createdAt ?? b?.createdAt ?? null,
    business: b, subscription: byUser.get(id)?.status ?? "none",
  });
  // administradores sem negócio não são clientes; negócios sem perfil ainda aparecem
  const members = profiles.filter((p) => !p.isAdmin || byOwner.has(p.id));
  const rows = [
    ...members.map((p) => row(p.id, p, byOwner.get(p.id) ?? null)),
    ...all.filter((b) => !known.has(b.ownerId)).map((b) => row(b.ownerId, null, b)),
  ].sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""));
  const active = subs.filter((s) => s.status === "active").length;
  return {
    totalAccounts: rows.length,
    totalBusinesses: all.length,
    partnershipsAccepted: counts.accepted,
    partnershipsPending: counts.pending,
    messages: counts.messages,
    activeSubscribers: active,
    earlyRegistrations: subs.filter((s) => s.status === "trialing").length,
    projectedMrr: (active + (isLaunched(ctx.now) ? 0 : subs.filter((s) => s.status === "trialing").length)) * PRICE_CENTS,
    config,
    mode,
    rows,
  };
}

export type { PublicBusiness };
