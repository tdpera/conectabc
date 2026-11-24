import { NextResponse } from "next/server";
import { serverCtx } from "@/lib/server/ctx";
import { getStripe, siteUrl } from "@/lib/server/stripe";
import { adminClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Pagamentos ainda não configurados." }, { status: 503 });
  const ctx = await serverCtx();
  if (!ctx.userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminClient() as any).from("subscriptions").select("stripe_customer_id").eq("user_id", ctx.userId).maybeSingle();
  if (!data?.stripe_customer_id) return NextResponse.json({ error: "Nenhuma assinatura encontrada." }, { status: 404 });
  const s = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${siteUrl(req)}/painel/assinatura`, locale: "pt-BR" });
  return NextResponse.json({ url: s.url });
}
