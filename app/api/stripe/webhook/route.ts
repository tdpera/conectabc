import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { forgetEntitlement, subscriptionFromStripe, upsertSubscription } from "@/lib/server/entitlement";
import { getStripe } from "@/lib/server/stripe";
import { adminClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }
  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true, ignored: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient() as any;
  // Idempotência: o ledger recusa o mesmo evento duas vezes.
  const ins = await db.from("billing_events").insert({ stripe_event_id: event.id, type: event.type });
  if (ins.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (ins.error) return NextResponse.json({ error: "Falha ao registrar evento." }, { status: 500 });

  try {
    const obj = event.data.object as { subscription?: unknown; id?: string; object?: string; parent?: { subscription_details?: { subscription?: string } } };
    let subId: string | null = null;
    if (obj.object === "subscription") subId = obj.id!;
    else if (obj.object === "checkout.session") subId = (obj.subscription as string) ?? null;
    else if (obj.object === "invoice") subId = obj.parent?.subscription_details?.subscription ?? (obj.subscription as string) ?? null;
    if (subId) {
      // Sempre relê a assinatura no Stripe: a fonte da verdade não é o payload.
      const s = await stripe.subscriptions.retrieve(subId);
      let userId = s.metadata?.user_id;
      if (!userId) {
        const { data } = await db.from("subscriptions").select("user_id").eq("stripe_customer_id", String(s.customer)).maybeSingle();
        userId = data?.user_id;
      }
      if (userId) {
        const price = s.items.data[0]?.price;
        await upsertSubscription(subscriptionFromStripe(userId, s), {
          customerId: String(s.customer), subscriptionId: s.id, priceId: price?.id, interval: price?.recurring?.interval,
        });
        forgetEntitlement(userId);
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    // Permite que o Stripe reenvie: remove o registro do ledger.
    await db.from("billing_events").delete().eq("stripe_event_id", event.id);
    console.error("[stripe:webhook]", e);
    return NextResponse.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
