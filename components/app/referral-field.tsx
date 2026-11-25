"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Field } from "@/components/ui/field";
import { backend } from "@/lib/backend";
import { normalizeCode, REFERRAL_MONTHS, REFERRAL_PERCENT } from "@/lib/plan";

const KEY = "conectabc:indicacao";

export function savedCode(): string {
  try {
    const url = new URLSearchParams(window.location.search).get("indicacao");
    return normalizeCode(url) ?? localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveCode(code: string | null) {
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {}
}

/** Campo opcional que confirma de quem é o código antes de enviar. */
export function ReferralField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [by, setBy] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setBy(null);
    setBad(false);
    const code = normalizeCode(value);
    if (!code) return;
    let on = true;
    const t = setTimeout(() => {
      backend.checkReferral(code).then((r) => {
        if (!on) return;
        setBy(r?.businessName ?? null);
        setBad(!r);
      }).catch(() => {});
    }, 300);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [value]);
  return (
    <Field
      label="Código de indicação (opcional)"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      maxLength={10}
      aria-invalid={bad}
      className={className}
      hint={
        by ? <span className="flex items-center gap-1 text-teal" role="status"><Check className="size-3.5" /> Indicado por {by}: {REFERRAL_PERCENT}% de desconto por {REFERRAL_MONTHS} meses</span>
          : bad ? <span className="text-coral-deep" role="alert">Código não encontrado.</span>
            : `Com um código, você ganha ${REFERRAL_PERCENT}% de desconto nas ${REFERRAL_MONTHS} primeiras mensalidades.`
      }
    />
  );
}
