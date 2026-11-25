import "server-only";
import Stripe from "stripe";
import { REFERRAL_MONTHS, REFERRAL_PERCENT } from "../plan";

let stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

export function stripeMode(): "test" | "live" | "unset" {
  const k = process.env.STRIPE_SECRET_KEY ?? "";
  if (k.startsWith("sk_live") || k.startsWith("rk_live")) return "live";
  if (k.startsWith("sk_test") || k.startsWith("rk_test")) return "test";
  return "unset";
}

export function siteUrl(req?: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || (req ? new URL(req.url).origin : "http://localhost:3000");
}

/**
 * Cupom de indicação (criado sozinho no Stripe). Os 3 meses contam do início da assinatura;
 * como o mês grátis restante é sempre menor que um mês, cobrem exatamente 3 cobranças.
 */
export async function referralCoupon(s: Stripe): Promise<string> {
  const id = `conectabc-indicacao-${REFERRAL_PERCENT}-${REFERRAL_MONTHS}m`;
  try {
    return (await s.coupons.retrieve(id)).id;
  } catch (e) {
    if ((e as { code?: string }).code !== "resource_missing") throw e;
  }
  try {
    return (await s.coupons.create({ id, percent_off: REFERRAL_PERCENT, duration: "repeating", duration_in_months: REFERRAL_MONTHS, name: "Indicação ConectaBC" })).id;
  } catch (e) {
    if ((e as { code?: string }).code === "resource_already_exists") return id; // criado ao mesmo tempo
    throw e;
  }
}
