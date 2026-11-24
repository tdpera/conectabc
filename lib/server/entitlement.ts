import "server-only";
import type Stripe from "stripe";
import { isLaunched, PRICE_CENTS } from "../launch";
import { subscriptionEntitles } from "../rules";
import type { Subscription, SubscriptionStatus } from "../types";
import { getStripe } from "./stripe";
import { adminClient } from "./supabase";

const TTL = 2 * 60 * 1000;
const cache = new Map<string, { at: number; ok: boolean }>();

export function subscriptionFromStripe(userId: string, s: Stripe.Subscription): Subscription {
  const item = s.items.data[0];
  const price = item?.price;
  return {
    userId,
    status: s.status as SubscriptionStatus,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    trialEnd: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
    amount: price?.unit_amount ?? 0,
    currency: price?.currency ?? "brl",
  };
}

export async function upsertSubscription(sub: Subscription, extra: { customerId?: string; subscriptionId?: string; priceId?: string; interval?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient() as any).from("subscriptions").upsert(
    {
      user_id: sub.userId,
      stripe_customer_id: extra.customerId,
      stripe_subscription_id: extra.subscriptionId,
      stripe_price_id: extra.priceId,
      interval: extra.interval,
      status: sub.status,
      current_period_end: sub.currentPeriodEnd,
      trial_end: sub.trialEnd,
      amount: sub.amount,
      currency: sub.currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/**
 * Direito de acesso verificado AO VIVO no Stripe (com cache de 2 minutos).
 * Antes do lançamento, todo membro logado tem acesso.
 */
export async function isEntitled(userId: string, now = new Date()): Promise<boolean> {
  if (!isLaunched(now)) return true;
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.ok;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient() as any;
  const { data: profile } = await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (profile?.is_admin) return remember(userId, true);

  const { data: row } = await db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const stripe = getStripe();
  if (!row?.stripe_subscription_id || !stripe) return remember(userId, false);

  try {
    const s = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    const sub = subscriptionFromStripe(userId, s);
    const price = s.items.data[0]?.price;
    const priceOk =
      (!process.env.STRIPE_PRICE_ID || price?.id === process.env.STRIPE_PRICE_ID) &&
      price?.unit_amount === PRICE_CENTS && price?.currency === "brl" && price?.recurring?.interval === "month";
    await upsertSubscription(sub, { customerId: String(s.customer), subscriptionId: s.id, priceId: price?.id, interval: price?.recurring?.interval });
    return remember(userId, priceOk && subscriptionEntitles(sub, now));
  } catch {
    return remember(userId, false);
  }
}

function remember(userId: string, ok: boolean) {
  cache.set(userId, { at: Date.now(), ok });
  return ok;
}

export function forgetEntitlement(userId: string) {
  cache.delete(userId);
}
