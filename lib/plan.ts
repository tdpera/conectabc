/** Preço, mês grátis dos primeiros negócios e indicação. */
export const PRICE_CENTS = 4999;
export const PRICE_LABEL = "R$ 49,99";
export const FOUNDER_LIMIT = 100;
export const REFERRAL_PERCENT = 10;
export const REFERRAL_MONTHS = 3;
export const REFERRAL_PRICE_LABEL = "R$ 44,99";

const CODE = /^[A-Z0-9]{6}$/;

/** "a3-f9 c2" vira "A3F9C2"; null quando não tem formato de código. */
export function normalizeCode(v: unknown): string | null {
  const c = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE.test(c) ? c : null;
}

export function addMonth(d: Date): Date {
  const out = new Date(d);
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + 1);
  if (out.getUTCDate() !== day) out.setUTCDate(0); // 31/01 + 1 mês = último dia de fevereiro
  return out;
}

export const freeActive = (m: { freeUntil: string | null } | null | undefined, now: Date) => !!m?.freeUntil && new Date(m.freeUntil) > now;

/**
 * Fim do teste no checkout: quem assina durante o mês grátis só paga depois dele.
 * O Stripe exige pelo menos 48 h à frente, então damos no mínimo 49 h.
 */
export function checkoutTrialEnd(m: { freeUntil: string | null } | null, now: Date): Date | null {
  if (!freeActive(m, now)) return null;
  return new Date(Math.max(new Date(m!.freeUntil!).getTime(), now.getTime() + 49 * 3600_000));
}
