import { category } from "./categories";
import { STATUS_INFO } from "./subscription-status";
import type { AdminRow } from "./types";

const WEEK = 7 * 86400000;

/** Contagem em janelas de 7 dias terminando agora; a última é a semana atual. */
export function weekly(dates: (string | null)[], now: Date, n = 12) {
  const out = Array.from({ length: n }, (_, i) => ({ start: new Date(now.getTime() - (n - i) * WEEK), end: new Date(now.getTime() - (n - 1 - i) * WEEK), count: 0 }));
  for (const d of dates) {
    if (!d) continue;
    const ago = Math.floor((now.getTime() - new Date(d).getTime()) / WEEK);
    const i = n - 1 - Math.max(0, ago);
    if (i >= 0) out[i].count++;
  }
  return out;
}

/** Célula segura: planilhas não devem executar texto digitado por usuários. */
export function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
}

export function toCsv(rows: AdminRow[]): string {
  const head = ["Negócio", "Categoria", "Descrição", "Dono", "E-mail", "Telefone", "WhatsApp", "Instagram", "Site", "Endereço", "Bairro", "Cidade", "Entrou em", "Assinatura", "Vaga gratuita", "Grátis até", "Código", "Indicado por", "Indicações"];
  const body = rows.map((r) => {
    const b = r.business;
    return [
      b?.name ?? "(sem negócio cadastrado)", b ? category(b.category).label : "", b?.description, r.ownerName, r.ownerEmail, b?.phone, b?.whatsapp, b?.instagram,
      b?.website, b?.address, b?.neighborhood, b?.city, r.joinedAt?.slice(0, 10), STATUS_INFO[r.subscription].label,
      r.membership?.founderNumber?.toString(), r.membership?.freeUntil?.slice(0, 10), r.membership?.referralCode, r.membership?.referredCode, String(r.referrals),
    ];
  });
  return "\ufeff" + [head, ...body].map((l) => l.map(csvCell).join(";")).join("\r\n");
}

export function tally(keys: string[]) {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
