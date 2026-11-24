"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/shell";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { useApp } from "@/components/app/providers";

export default function Page() {
  const { demo } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha." footer={<Link href="/entrar" className="font-semibold text-teal hover:underline">← Voltar para entrar</Link>}>
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="s" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card rounded-3xl p-6 text-center">
            <MailCheck className="mx-auto size-10 text-teal" />
            <p className="font-display mt-3 text-xl font-bold">Confira seu e-mail</p>
            <p className="mt-1 text-sm text-ink-soft">Se existir uma conta para <strong>{email}</strong>, você receberá um link em instantes.</p>
            {demo && <Link href="/nova-senha" className="mt-4 inline-block text-sm font-semibold text-teal hover:underline">Demo: abrir a tela de nova senha →</Link>}
          </motion.div>
        ) : (
          <motion.form
            key="f"
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr("");
              try {
                await backend.requestPasswordReset(email);
                setSent(true);
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="E-mail da conta" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {err && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral-deep">{err}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Enviar link</Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
