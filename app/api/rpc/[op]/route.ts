import { NextResponse } from "next/server";
import * as core from "@/lib/core";
import { RuleError } from "@/lib/rules";
import { serverConfigured } from "@/lib/server/supabase";
import { serverCtx } from "@/lib/server/ctx";
import { getStripe, stripeMode, siteUrl } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

const OPS: Record<string, (ctx: Awaited<ReturnType<typeof serverCtx>>, b: Body, req: Request) => Promise<unknown>> = {
  async session(ctx) {
    // a oferta é só informativa: se falhar, a sessão continua
    const offer = await core.offer(ctx).catch(() => null);
    if (!ctx.userId) return { user: null, business: null, subscription: null, entitled: false, membership: null, referrals: 0, pendingCode: null, offer };
    const [business, subscription, entitled, membership] = await Promise.all([
      ctx.repo.getBusinessByOwner(ctx.userId),
      ctx.repo.getSubscription(ctx.userId),
      ctx.isEntitled(ctx.userId),
      ctx.repo.getMembership(ctx.userId),
    ]);
    return {
      user: { id: ctx.userId, email: ctx.email ?? "", name: ctx.name ?? ctx.email?.split("@")[0] ?? "", isAdmin: ctx.isAdmin },
      business, subscription, entitled, membership,
      referrals: membership ? await ctx.repo.countReferrals(membership.referralCode) : 0,
      pendingCode: ctx.pendingCode, offer,
    };
  },
  directory: (ctx) => core.directory(ctx),
  business: (ctx, b) => core.businessById(ctx, String(b.id)),
  saveBusiness: (ctx, b) => core.saveMyBusiness(ctx, b, b.referralCode),
  checkReferral: (ctx, b) => core.checkReferral(ctx, b.code),
  conversations: (ctx) => core.conversations(ctx),
  thread: (ctx, b) => core.thread(ctx, String(b.id)),
  send: (ctx, b) => core.sendMessage(ctx, String(b.id), b.body),
  partnerships: (ctx) => core.partnerships(ctx),
  partnershipWith: (ctx, b) => core.livePartnershipWith(ctx, String(b.id)),
  propose: (ctx, b) => core.propose(ctx, String(b.id), b.type, b.intro),
  respond: (ctx, b) => core.respond(ctx, String(b.id), b.accept === true),
  cancel: (ctx, b) => core.cancel(ctx, String(b.id)),
  async admin(ctx, _b, req) {
    const stripe = getStripe();
    let priceOk = false;
    if (stripe && process.env.STRIPE_PRICE_ID) {
      try {
        const p = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
        priceOk = p.unit_amount === 4999 && p.currency === "brl" && p.recurring?.interval === "month";
      } catch {}
    }
    return core.adminStats(ctx, [
      { key: "STRIPE_SECRET_KEY", label: "Chave secreta do Stripe", ok: !!stripe },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Segredo do webhook", ok: !!process.env.STRIPE_WEBHOOK_SECRET },
      { key: "STRIPE_PRICE_ID", label: "Preço R$ 49,99/mês (BRL)", ok: priceOk },
      { key: "NEXT_PUBLIC_SITE_URL", label: "URL pública do site", ok: !!process.env.NEXT_PUBLIC_SITE_URL, detail: siteUrl(req) },
      { key: "SUPABASE", label: "Banco de dados Supabase", ok: true },
    ], stripeMode());
  },
};

export async function POST(req: Request, { params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  const fn = OPS[op];
  if (!fn) return NextResponse.json({ error: "Operação desconhecida." }, { status: 404 });
  if (!serverConfigured()) return NextResponse.json({ error: "Servidor sem Supabase configurado." }, { status: 503 });
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const ctx = await serverCtx();
    return NextResponse.json((await fn(ctx, body, req)) ?? null);
  } catch (e) {
    if (e instanceof RuleError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(`[rpc:${op}]`, e);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
