"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { clsx } from "clsx";
import { FlaskConical, Shield, Store, UserPlus } from "lucide-react";
import { AuthShell, Divider, GoogleIcon } from "@/components/auth/shell";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { useApp } from "@/components/app/providers";
import { toast } from "@/components/ui/toast";

export default function Page() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/painel";
}

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, demo } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState(params.get("erro") === "link" ? "O link expirou ou é inválido. Tente novamente." : "");
  const next = safeNext(params.get("next"));

  const go = async (key: string, fn: () => Promise<unknown>, dest = next) => {
    setBusy(key);
    setErr("");
    try {
      await fn();
      const s = await refresh();
      if (s.user) {
        toast.success(`Bem-vindo(a), ${s.business?.name ?? s.user.name}!`);
        router.push(s.user.isAdmin && dest === "/painel" ? "/admin" : dest);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Acesse sua conta para ver contatos, conversar e propor parcerias." footer={<>Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-teal hover:underline">Criar conta grátis</Link></>}>
      {demo && (
        <div className="mb-6 rounded-3xl border border-coral/25 bg-gradient-to-br from-coral/10 to-sand/40 p-4 dark:to-transparent">
          <p className="flex items-center gap-2 text-sm font-bold"><FlaskConical className="size-4 text-coral" /> Modo demonstração · entre com um clique</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([["member", "Membro", Store], ["new", "Conta nova", UserPlus], ["admin", "Admin", Shield]] as const).map(([k, l, I]) => (
              <Button key={k} variant="outline" size="sm" loading={busy === k} icon={<I className="size-4" />} onClick={() => go(k, () => backend.demoLogin!(k), k === "admin" ? "/admin" : "/painel")}>
                {l}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">Ou use voce@demo.conectabc · senha demo1234</p>
        </div>
      )}
      <Button variant="outline" size="lg" className="w-full" loading={busy === "google"} icon={<GoogleIcon />} onClick={() => go("google", () => backend.signInWithGoogle())}>
        Continuar com Google
      </Button>
      <Divider>ou com e-mail</Divider>
      <form
        className={clsx("space-y-4", err && "animate-shake")}
        onSubmit={(e) => {
          e.preventDefault();
          go("pw", () => backend.signIn(email, password));
        }}
      >
        <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral-deep" role="alert">{err}</p>}
        <div className="flex justify-end">
          <Link href="/recuperar-senha" className="text-sm font-semibold text-teal hover:underline">Esqueci minha senha</Link>
        </div>
        <Button type="submit" variant="brand" size="lg" className="w-full" loading={busy === "pw"}>Entrar</Button>
      </form>
    </AuthShell>
  );
}
