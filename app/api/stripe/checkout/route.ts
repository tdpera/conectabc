import { NextResponse } from "next/server";
import { earlySignupOpen, isLaunched, LAUNCH_AT } from "@/lib/launch";
import { serverCtx } from "@/lib/server/ctx";
import { getStripe, siteUrl } from "@/lib/server/stripe";
import { adminClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const price = process.env.STRIPE_PRICE_ID;
  if (!stripe || !price) return NextResponse.json({ error: "Pagamentos ainda não configurados." }, { status: 503 });
  const ctx = await serverCtx();
  if (!ctx.userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });

  const now = new Date();
  const launched = isLaunched(now);
  if (!launched && !earlySignupOpen(now))
    return NextResponse.json({ error: "O cadastro antecipado está pausado nas 48h finais. Volte no dia do lançamento." }, { status: 409 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient() as any;
  const { data: row } = await db.from("subscriptions").select("*").eq("user_id", ctx.userId).maybeSingle();
  if (row && ["active", "trialing", "past_due"].includes(row.status))
    return NextResponse.json({ error: "Você já tem uma assinatura. Use o botão de gerenciar pagamento." }, { status: 409 });

  let customer = row?.stripe_customer_id as string | undefined;
  if (!customer) {
    const c = await stripe.customers.create({ email: ctx.email ?? undefined, metadata: { user_id: ctx.userId } });
    customer = c.id;
    await db.from("subscriptions").upsert({ user_id: ctx.userId, stripe_customer_id: customer, status: "incomplete" }, { onConflict: "user_id" });
  }

  const base = siteUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: ctx.userId,
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: "always",
    locale: "pt-BR",
    subscription_data: {
      metadata: { user_id: ctx.userId },
      ...(launched ? {} : { trial_end: Math.floor(LAUNCH_AT.getTime() / 1000) }),
    },
    success_url: `${base}/painel/assinatura?status=sucesso`,
    cancel_url: `${base}/painel/assinatura?status=cancelado`,
  });
  return NextResponse.json({ url: session.url });
}
