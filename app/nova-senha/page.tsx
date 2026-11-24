"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/shell";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { toast } from "@/components/ui/toast";

export default function Page() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha nova para sua conta.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          if (pw.length < 8) return setErr("A senha precisa de pelo menos 8 caracteres.");
          if (pw !== pw2) return setErr("As senhas não conferem.");
          setBusy(true);
          try {
            await backend.updatePassword(pw);
            toast.success("Senha alterada!");
            router.push("/painel");
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nova senha" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        <Field label="Repita a nova senha" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {err && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral-deep">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Salvar nova senha</Button>
      </form>
    </AuthShell>
  );
}
