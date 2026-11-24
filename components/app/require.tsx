"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useApp } from "./providers";
import { Paywall } from "./gates";

/** Exige login; com `paywall`, exige também assinatura ativa após o lançamento. */
export function RequireMember({ children, paywall, admin }: { children: React.ReactNode; paywall?: boolean; admin?: boolean }) {
  const { session, loading } = useApp();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!loading && !session?.user) router.replace(`/entrar?next=${encodeURIComponent(path)}`);
    else if (!loading && admin && !session?.user?.isAdmin) router.replace("/painel");
  }, [loading, session?.user, router, path, admin]);
  if (loading || !session?.user || (admin && !session.user.isAdmin))
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-teal" />
      </div>
    );
  if (paywall && !session.entitled) return <div className="pt-[var(--hh,96px)]"><Paywall /></div>;
  return <>{children}</>;
}
