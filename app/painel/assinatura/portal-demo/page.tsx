"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { CreditCard, FlaskConical } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp } from "@/components/app/providers";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { demoBilling } from "@/lib/backend/demo";

export default function Page() {
  const { demo, session, refresh } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!demo) return null;
  const sub = session?.subscription;
  return (
    <RequireMember>
      <main className="mx-auto max-w-md px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card rounded-[2rem] p-6 sm:p-8">
          <p className="mb-4 flex items-center gap-2 rounded-2xl bg-coral/10 px-3 py-2 text-xs font-semibold text-coral-deep">
            <FlaskConical className="size-4" /> Portal de cobrança de demonstração
          </p>
          <h1 className="font-display text-3xl font-bold">Gerenciar assinatura</h1>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-surface-2 p-4">
            <div className="flex items-center gap-3"><CreditCard className="size-5 text-teal" /><span className="font-semibold">•••• 4242</span></div>
            <Pill tone={sub?.status === "canceled" ? "default" : "success"}>{sub?.status ?? "—"}</Pill>
          </div>
          <Button
            variant="danger"
            size="lg"
            className="mt-6 w-full"
            loading={busy}
            disabled={!sub || sub.status === "canceled"}
            onClick={async () => {
              setBusy(true);
              await demoBilling.cancelSubscription();
              await refresh();
              toast.info("Assinatura cancelada (simulação).");
              router.push("/painel/assinatura");
            }}
          >
            Cancelar assinatura (simulação)
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push("/painel/assinatura")}>Voltar ao ConectaBC</Button>
        </motion.div>
      </main>
    </RequireMember>
  );
}
