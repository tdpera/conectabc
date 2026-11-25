import { z } from "zod";
import { validCoords } from "./geo";
import { CATEGORIES } from "./categories";
import type { Business, BusinessInput, Partnership, PartnershipStatus, PublicBusiness, Subscription } from "./types";
import { PRICE_CENTS } from "./plan";

export class RuleError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const opt = (max: number) => z.string().trim().max(max).default("");

export const businessSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do negócio.").max(120),
    category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]], { message: "Escolha uma categoria." }),
    description: opt(1500),
    neighborhood: opt(80),
    city: z.string().trim().min(2, "Informe a cidade.").max(80),
    address: opt(200),
    state: opt(2).transform((s) => s.toUpperCase()),
    hours: opt(200),
    phone: opt(30),
    whatsapp: opt(30),
    instagram: opt(80),
    website: opt(200),
    coverUrl: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .default(null)
      .refine((v) => !v || /^https:\/\//.test(v), "A imagem de capa precisa começar com https://")
      .transform((v) => v || null),
    idealPartners: opt(600),
    partnerOffer: opt(600),
    lat: z.number().nullable().default(null),
    lng: z.number().nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === null) !== (v.lng === null) || (v.lat !== null && !validCoords(v.lat, v.lng))) {
      ctx.addIssue({ code: "custom", message: "Coordenadas do pin inválidas.", path: ["lat"] });
    }
  });

export function parseBusiness(input: unknown): BusinessInput {
  const r = businessSchema.safeParse(input);
  if (!r.success) throw new RuleError(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data as BusinessInput;
}

export function toPublic(b: Business): PublicBusiness {
  return {
    id: b.id, name: b.name, category: b.category, description: b.description,
    neighborhood: b.neighborhood, city: b.city, address: b.address, state: b.state,
    hours: b.hours, coverUrl: b.coverUrl, idealPartners: b.idealPartners,
    partnerOffer: b.partnerOffer, lat: b.lat, lng: b.lng, createdAt: b.createdAt,
  };
}

export const messageSchema = z.string().trim().min(1, "Escreva uma mensagem.").max(2000, "Máximo de 2.000 caracteres.");
export const introSchema = z.string().trim().min(10, "Escreva uma apresentação (mín. 10 caracteres).").max(1500, "Máximo de 1.500 caracteres.");

export function parseOrThrow<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new RuleError(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

/** Assinaturas que garantem acesso à rede. */
export function subscriptionEntitles(sub: Pick<Subscription, "status" | "trialEnd" | "amount" | "currency"> | null, now = new Date()): boolean {
  if (!sub) return false;
  if (sub.amount !== PRICE_CENTS || sub.currency.toLowerCase() !== "brl") return false;
  if (sub.status === "active") return true;
  // cartão cadastrado durante o mês grátis: a cobrança vem no fim do teste
  return sub.status === "trialing" && !!sub.trialEnd && new Date(sub.trialEnd) > now;
}

export function samePair(p: Partnership, a: string, b: string) {
  return (
    (p.requesterBusinessId === a && p.recipientBusinessId === b) ||
    (p.requesterBusinessId === b && p.recipientBusinessId === a)
  );
}

export const LIVE: PartnershipStatus[] = ["pending", "accepted"];

export function assertCanPropose(all: Partnership[], from: Business | null, to: Business | null) {
  if (!from) throw new RuleError("Cadastre seu negócio antes de propor parcerias.", 403);
  if (!to || !to.isVisible) throw new RuleError("Negócio não encontrado.", 404);
  if (from.id === to.id) throw new RuleError("Você não pode propor parceria para o seu próprio negócio.");
  if (all.some((p) => samePair(p, from.id, to.id) && LIVE.includes(p.status)))
    throw new RuleError("Já existe uma parceria pendente ou aceita com este negócio.", 409);
}

export function assertCanRespond(p: Partnership | undefined, userId: string) {
  if (!p) throw new RuleError("Proposta não encontrada.", 404);
  if (p.recipientId !== userId) throw new RuleError("Apenas quem recebeu pode responder.", 403);
  if (p.status !== "pending") throw new RuleError("Esta proposta já foi respondida.", 409);
}

export function assertCanCancel(p: Partnership | undefined, userId: string) {
  if (!p) throw new RuleError("Proposta não encontrada.", 404);
  if (p.requesterId !== userId) throw new RuleError("Apenas quem enviou pode cancelar.", 403);
  if (p.status !== "pending") throw new RuleError("Só é possível cancelar propostas pendentes.", 409);
}

export function assertCanMessage(from: Business | null, to: Business | null) {
  if (!from) throw new RuleError("Cadastre seu negócio antes de conversar.", 403);
  if (!to || !to.isVisible) throw new RuleError("Negócio não encontrado.", 404);
  if (from.id === to.id) throw new RuleError("Você não pode enviar mensagens para si mesmo.");
}
