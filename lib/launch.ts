/** Abertura do paywall: 15/01/2027 00:00 em Brasília (UTC-3). */
export const LAUNCH_AT = new Date("2027-01-15T03:00:00Z");
export const PRICE_CENTS = 4999;
export const PRICE_LABEL = "R$ 49,99";
const EARLY_SIGNUP_CUTOFF_MS = 48 * 60 * 60 * 1000;

export function isLaunched(now: Date = new Date()): boolean {
  return now.getTime() >= LAUNCH_AT.getTime();
}

/** O cadastro antecipado pausa nas 48h finais (mínimo do Stripe para trial_end). */
export function earlySignupOpen(now: Date = new Date()): boolean {
  return LAUNCH_AT.getTime() - now.getTime() > EARLY_SIGNUP_CUTOFF_MS;
}

export function timeUntilLaunch(now: Date = new Date()) {
  const ms = Math.max(0, LAUNCH_AT.getTime() - now.getTime());
  const s = Math.floor(ms / 1000);
  return {
    total: ms,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}
