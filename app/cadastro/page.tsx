"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { AuthShell, Divider, GoogleIcon } from "@/components/auth/shell";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { useApp } from "@/components/app/providers";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const LEVEL = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
const COLOR = ["bg-coral", "bg-coral", "bg-amber-400", "bg-aqua", "bg-teal"];

export default function Page() {
  const router = useRouter();
  const { refresh } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const st = strength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr("A senha precisa de pelo menos 8 caracteres.");
    setBusy("pw");
    try {
      const r = await backend.signUp(email, password, name);
      if (r.needsVerification) router.push(`/verificar?email=${encodeURIComponent(email)}`);
      else {
        await refresh();
        router.push("/painel/meu-negocio");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthShell
      title="Criar conta"
      subtitle={<>Grátis até 15/01/2027. Depois, R$ 49,99/mês — sem fidelidade.</>}
      footer={<>Já tem conta? <Link href="/entrar" className="font-semibold text-teal hover:underline">Entrar</Link></>}
    >
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        loading={busy === "google"}
        icon={<GoogleIcon />}
        onClick={async () => {
          setBusy("google");
          try {
            await backend.signInWithGoogle();
            const s = await refresh();
            if (s.user) router.push("/painel");
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(null);
          }
        }}
      >
        Cadastrar com Google
      </Button>
      <Divider>ou com e-mail</Divider>
      <form onSubmit={submit} className={clsx("space-y-4", err && "animate-shake")}>
        <Field label="Seu nome" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <Field label="Senha (mín. 8 caracteres)" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && (
            <div className="mt-2 px-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <motion.div className={clsx("h-full", COLOR[st])} initial={{ width: 0 }} animate={{ width: i < st ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-faint">Força: {LEVEL[st]}</p>
            </div>
          )}
        </div>
        {err && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral-deep" role="alert">{err}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === "pw"}>Criar minha conta</Button>
        <p className="text-center text-xs text-ink-faint">Enviaremos um código de 6 dígitos para confirmar seu e-mail.</p>
      </form>
    </AuthShell>
  );
}
