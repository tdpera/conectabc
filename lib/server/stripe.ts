import "server-only";
import Stripe from "stripe";

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
