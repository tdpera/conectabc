"use client";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { REFERRAL_MONTHS, REFERRAL_PERCENT } from "@/lib/plan";
import { useApp } from "./providers";

export function ReferralCard() {
  const { session } = useApp();
  const code = session?.membership?.referralCode;
  if (!code) return null;
  const link = () => `${window.location.origin}/cadastro?indicacao=${code}`;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copiado!")).catch(() => toast.error("Não foi possível copiar", text));
  const share = async () => {
    const data = { title: "ConectaBC", text: `Use meu código ${code} no ConectaBC e ganhe ${REFERRAL_PERCENT}% de desconto por ${REFERRAL_MONTHS} meses.`, url: link() };
    if (!navigator.share) return copy(`${data.text} ${data.url}`);
    await navigator.share(data).catch(() => {}); // a pessoa fechou a janela
  };
  return (
    <section className="card mt-6 rounded-[2rem] p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Seu código de indicação</h2>
      <p className="mt-2 text-ink-soft">
        Negócios que se cadastram com ele ganham {REFERRAL_PERCENT}% de desconto nas {REFERRAL_MONTHS} primeiras mensalidades.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="rounded-2xl bg-surface-2 px-5 py-3 text-2xl font-bold tracking-[0.15em]" aria-label={`Código ${code.split("").join(" ")}`}>{code}</span>
        <Button variant="outline" icon={<Copy className="size-4" />} onClick={() => copy(code)}>Copiar código</Button>
        <Button variant="brand" icon={<Share2 className="size-4" />} onClick={share}>Compartilhar link</Button>
      </div>
      <p className="mt-4 text-sm text-ink-faint">
        {session!.referrals === 0 ? "Nenhum negócio usou seu código ainda." : session!.referrals === 1 ? "1 negócio entrou com seu código." : `${session!.referrals} negócios entraram com seu código.`}
      </p>
    </section>
  );
}
