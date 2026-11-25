"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { useApp } from "./providers";

const spots = (n: number) => (n === 1 ? "Resta 1 vaga" : `Restam ${n} vagas`);

/** Faixa do topo: some quando as vagas acabam. */
export function OfferBar({ dark }: { dark?: boolean }) {
  const { offer } = useApp();
  if (!offer?.left) return null;
  return (
    <Link
      href="/cadastro"
      className={clsx("flex h-8 items-center justify-center gap-2 overflow-hidden px-3 text-[12px] font-medium text-white sm:text-[13px]", dark ? "bg-abyss/70" : "bg-abyss")}
    >
      <span className="truncate">
        <strong className="font-semibold">Primeiro mês grátis</strong> para os {offer.limit} primeiros negócios
      </span>
      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 tabular-nums">{spots(offer.left)}</span>
    </Link>
  );
}

export function OfferMeter() {
  const { offer } = useApp();
  if (!offer) return null;
  const used = offer.limit - offer.left;
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${used} de ${offer.limit} vagas gratuitas preenchidas`}>
        <div className="h-full rounded-full bg-aqua" style={{ width: `${(used / offer.limit) * 100}%` }} />
      </div>
      <p className="mt-3 flex justify-between text-sm text-white/65 tabular-nums">
        <span>{used} de {offer.limit} preenchidas</span>
        <span>{offer.left ? spots(offer.left) : "Vagas encerradas"}</span>
      </p>
    </div>
  );
}
