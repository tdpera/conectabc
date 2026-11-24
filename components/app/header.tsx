"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  Compass, Handshake, Home, LogOut, Menu, MessagesSquare, Shield, Store, CreditCard, X, ChevronDown,
} from "lucide-react";
import { Logo } from "./logo";
import { useApp } from "./providers";
import { CountdownBar } from "./countdown";
import { buttonClass } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { toast } from "@/components/ui/toast";

export const INTRO_DONE = "conectabc:intro-done";

const MEMBER_NAV = [
  { href: "/painel", label: "Início", icon: Home },
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/painel/parcerias", label: "Parcerias", icon: Handshake },
  { href: "/painel/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/painel/meu-negocio", label: "Meu negócio", icon: Store },
];

function active(path: string, href: string) {
  if (href === "/painel") return path === "/painel";
  return path === href || path.startsWith(href + "/");
}

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const { session, loading, refresh, launched } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const isHome = path === "/";
  const [introDone, setIntroDone] = useState(!isHome);
  const user = session?.user;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isHome) return setIntroDone(true);
    const w = window as unknown as { __introDone?: boolean };
    if (w.__introDone) return setIntroDone(true);
    setIntroDone(false);
    const on = () => setIntroDone(true);
    window.addEventListener(INTRO_DONE, on);
    const t = setTimeout(on, 11000); // segurança: abertura (~5,4 s) + espera máxima da cena
    return () => {
      window.removeEventListener(INTRO_DONE, on);
      clearTimeout(t);
    };
  }, [isHome]);

  useEffect(() => {
    document.documentElement.style.setProperty("--hh", launched ? "64px" : "96px");
  }, [launched]);

  useEffect(() => {
    setMenu(false);
    setAccount(false);
  }, [path]);

  const overHero = isHome && !scrolled;
  const signOut = async () => {
    await backend.signOut();
    await refresh();
    toast.info("Você saiu da sua conta.");
    router.push("/");
  };

  const fullBleed = path.startsWith("/explorar") || path.startsWith("/painel/conversas");

  return (
    <>
      <motion.header
        initial={false}
        animate={{ opacity: introDone ? 1 : 0, y: introDone ? 0 : -16 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={clsx("fixed inset-x-0 top-0 z-[1000]", !introDone && "pointer-events-none")}
      >
        {!launched && <CountdownBar dark={overHero} />}
        <div
          className={clsx(
            "transition-[background,border-color,backdrop-filter] duration-500",
            overHero ? "border-b border-transparent bg-transparent" : "glass !border-x-0 !border-t-0 !rounded-none !shadow-none",
          )}
        >
          <nav className={clsx("mx-auto flex h-16 items-center gap-4 px-4 sm:px-6", fullBleed ? "max-w-none" : "max-w-7xl")}>
            <Link href={user ? "/painel" : "/"} aria-label="ConectaBC, início" className="shrink-0">
              <Logo light={overHero} />
            </Link>

            {user ? (
              <div className="hidden flex-1 justify-center lg:flex">
                <ul className="flex items-center gap-1 rounded-full p-1">
                  {MEMBER_NAV.map((n) => {
                    const on = active(path, n.href);
                    return (
                      <li key={n.href} className="relative">
                        <Link
                          href={n.href}
                          className={clsx(
                            "relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                            on ? "text-white" : overHero ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-ink",
                          )}
                        >
                          <n.icon className="size-4" />
                          {n.label}
                          {n.href === "/painel/meu-negocio" && !session?.business && (
                            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-coral ring-2 ring-surface" />
                          )}
                        </Link>
                        {on && (
                          <motion.span
                            layoutId="nav-pill"
                            className="absolute inset-0 rounded-full bg-teal shadow-[0_8px_20px_-8px_rgba(15,139,141,0.9)]"
                            transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="hidden flex-1 justify-center gap-1 md:flex">
                {[
                  { href: "/explorar", label: "Explorar o mapa" },
                  { href: "/#como-funciona", label: "Como funciona" },
                  { href: "/#planos", label: "Assinatura" },
                ].map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={clsx(
                      "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      overHero ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-soft hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {loading ? (
                <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setAccount((v) => !v)}
                    className={clsx(
                      "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold transition",
                      overHero ? "text-white hover:bg-white/10" : "text-ink hover:bg-surface-2",
                    )}
                    aria-expanded={account}
                    aria-haspopup="menu"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-aqua to-teal font-display text-sm font-bold text-white">
                      {(session?.business?.name || user.name || user.email).charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-36 truncate sm:inline">{session?.business?.name ?? user.name}</span>
                    <ChevronDown className={clsx("size-4 transition-transform", account && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {account && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.18 }}
                        className="glass absolute right-0 top-12 w-64 origin-top-right rounded-2xl p-2"
                        role="menu"
                      >
                        <div className="px-3 py-2">
                          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                          <p className="truncate text-xs text-ink-faint">{user.email}</p>
                        </div>
                        <div className="my-1 h-px bg-line" />
                        <MenuLink href="/painel/assinatura" icon={CreditCard}>Assinatura</MenuLink>
                        <MenuLink href="/painel/meu-negocio" icon={Store}>Meu negócio</MenuLink>
                        {user.isAdmin && <MenuLink href="/admin" icon={Shield}>Painel administrativo</MenuLink>}
                        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-coral-deep hover:bg-coral/10" role="menuitem">
                          <LogOut className="size-4" /> Sair
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <Link href="/entrar" className={clsx("hidden rounded-full px-4 py-2 text-sm font-semibold sm:inline-flex", overHero ? "text-white hover:bg-white/10" : "text-ink hover:bg-surface-2")}>
                    Entrar
                  </Link>
                  <Link href="/cadastro" className={buttonClass("primary", "sm")}>Criar conta</Link>
                </>
              )}
              {!user && (
                <button className={clsx("grid size-10 place-items-center rounded-full md:hidden", overHero ? "text-white" : "text-ink")} onClick={() => setMenu(true)} aria-label="Abrir menu">
                  <Menu className="size-5" />
                </button>
              )}
            </div>
          </nav>
        </div>
      </motion.header>

      {/* Menu móvel do visitante */}
      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[1100] bg-abyss/95 backdrop-blur-xl md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex h-16 items-center justify-between px-4">
              <Logo light />
              <button className="grid size-10 place-items-center text-white" onClick={() => setMenu(false)} aria-label="Fechar menu">
                <X className="size-6" />
              </button>
            </div>
            <ul className="mt-10 space-y-2 px-6">
              {[
                ["/explorar", "Explorar o mapa"],
                ["/#como-funciona", "Como funciona"],
                ["/#planos", "Assinatura"],
                ["/entrar", "Entrar"],
                ["/cadastro", "Criar conta"],
              ].map(([href, label], i) => (
                <motion.li key={href} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i + 0.1, ease: [0.16, 1, 0.3, 1], duration: 0.6 }}>
                  <Link href={href} onClick={() => setMenu(false)} className="font-display block py-2 text-4xl font-bold text-white">
                    {label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra inferior do membro (celular) */}
      {user && (
        <nav className="glass fixed inset-x-3 bottom-3 z-[1000] rounded-3xl px-1 py-1.5 lg:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
          <ul className="grid grid-cols-5">
            {MEMBER_NAV.map((n) => {
              const on = active(path, n.href);
              return (
                <li key={n.href} className="relative">
                  <Link href={n.href} className={clsx("relative z-10 flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold", on ? "text-teal" : "text-ink-faint")}>
                    <n.icon className="size-5" />
                    {n.label.split(" ")[0]}
                  </Link>
                  {on && <motion.span layoutId="tab-pill" className="absolute inset-x-1.5 inset-y-0 rounded-2xl bg-aqua/15" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: typeof Home; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2" role="menuitem">
      <Icon className="size-4 text-ink-faint" />
      {children}
    </Link>
  );
}
