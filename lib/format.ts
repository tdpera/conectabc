export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function timeLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function relativeDate(iso: string, now = new Date()): string {
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 30) return `há ${diff} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function whatsappLink(n: string): string {
  const digits = n.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`;
}

export function instagramLink(h: string): string {
  return `https://instagram.com/${h.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`;
}

export function websiteLink(u: string): string {
  return /^https?:\/\//.test(u) ? u : `https://${u}`;
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
