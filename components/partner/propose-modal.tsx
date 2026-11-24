"use client";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { useState } from "react";
import confetti from "canvas-confetti";
import { Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TextArea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PARTNERSHIP_TYPES } from "@/lib/categories";
import { backend } from "@/lib/backend";
import { toast } from "@/components/ui/toast";
import type { PartnershipType } from "@/lib/types";

export function celebrate(origin?: { x: number; y: number }) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#3fd0c9", "#0f8b8d", "#ff7a59", "#f4e3c3", "#ffffff"];
  confetti({ particleCount: 110, spread: 80, startVelocity: 42, origin: origin ?? { x: 0.5, y: 0.6 }, colors, scalar: 0.95 });
  setTimeout(() => confetti({ particleCount: 60, spread: 120, startVelocity: 30, origin: origin ?? { x: 0.5, y: 0.6 }, colors, scalar: 0.8 }), 180);
}

export function ProposeModal({ open, onClose, businessId, businessName, onDone }: { open: boolean; onClose: () => void; businessId: string; businessName: string; onDone: () => void }) {
  const [type, setType] = useState<PartnershipType | null>(null);
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async () => {
    if (!type || intro.trim().length < 10) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return toast.error(!type ? "Escolha o tipo de parceria." : "Escreva uma apresentação (mín. 10 caracteres).");
    }
    setBusy(true);
    try {
      await backend.propose(businessId, type, intro);
      celebrate();
      toast.success("Proposta enviada!", `${businessName} vai ver sua proposta em Parcerias.`);
      setIntro("");
      setType(null);
      onDone();
      onClose();
    } catch (e) {
      toast.error("Não foi possível enviar", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Propor parceria a ${businessName}`}>
      <p className="-mt-2 mb-5 text-sm text-ink-soft">Escolha o formato e conte, em poucas linhas, o que você imagina. O outro lado pode aceitar ou recusar.</p>
      <div className={clsx("grid grid-cols-2 gap-2 sm:grid-cols-3", shake && !type && "animate-shake")} role="radiogroup" aria-label="Tipo de parceria">
        {PARTNERSHIP_TYPES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={type === t.id}
            onClick={() => setType(t.id)}
            className={clsx(
              "relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left text-sm font-semibold transition",
              type === t.id ? "border-teal bg-aqua/10 text-ink" : "border-line bg-surface hover:border-teal/40",
            )}
          >
            <span className="text-2xl">{t.emoji}</span>
            {t.label}
            {type === t.id && <motion.span layoutId="type-ring" className="absolute inset-0 rounded-2xl ring-2 ring-teal" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
          </button>
        ))}
      </div>
      <TextArea
        className={clsx("mt-5", shake && intro.trim().length < 10 && "animate-shake")}
        label="Apresentação"
        value={intro}
        onChange={(e) => setIntro(e.target.value)}
        maxLength={1500}
        counter={intro.length}
        rows={5}
        hint="Ex.: “Indicamos vocês aos nossos hóspedes e vocês oferecem 10% para eles.”"
      />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} loading={busy} icon={<Send className="size-4" />}>Enviar proposta</Button>
      </div>
    </Modal>
  );
}
