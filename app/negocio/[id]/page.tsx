"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowLeft, Clock, Globe, Handshake, AtSign, Lock, MapPin, MessageCircle, MessagesSquare, Pencil, Phone, Gift, Target, Hourglass,
} from "lucide-react";
import { backend } from "@/lib/backend";
import type { DirectoryEntry } from "@/lib/backend/types";
import type { Business, Partnership } from "@/lib/types";
import { category } from "@/lib/categories";
import { instagramLink, websiteLink, whatsappLink } from "@/lib/format";
import { useApp } from "@/components/app/providers";
import { LockScreen, Paywall } from "@/components/app/gates";
import { Cover } from "@/components/ui/cover";
import { CategoryBadge, Empty, Skeleton } from "@/components/ui/misc";
import { Button, LinkButton } from "@/components/ui/button";
import { ProposeModal } from "@/components/partner/propose-modal";
import { Footer } from "@/components/app/footer";

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), { ssr: false, loading: () => <div className="skeleton size-full" /> });

const ease = [0.16, 1, 0.3, 1] as const;

function isFull(b: DirectoryEntry): b is Business {
  return "ownerId" in b;
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading, launched } = useApp();
  const [b, setB] = useState<DirectoryEntry | null | undefined>(undefined);
  const [live, setLive] = useState<Partnership | null>(null);
  const [propose, setPropose] = useState(false);
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const coverY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const coverScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  const loadLive = useCallback(() => {
    if (session?.user && session.business && session.entitled) backend.partnershipWith(id).then(setLive).catch(() => {});
  }, [id, session?.user, session?.business, session?.entitled]);

  useEffect(() => {
    if (loading) return;
    backend.getBusiness(id).then(setB).catch(() => setB(null));
    loadLive();
  }, [id, loading, launched, loadLive]);

  if (!loading && launched && !session?.user) return <LockScreen />;
  if (!loading && launched && session?.user && !session.entitled && session.business?.id !== id) return <Paywall />;

  if (b === null)
    return (
      <main className="pt-[var(--hh,96px)]">
        <Empty icon="🧭" title="Negócio não encontrado" body="Ele pode ter saído da rede ou o link está incorreto." action={<LinkButton href="/explorar">Voltar ao mapa</LinkButton>} />
      </main>
    );

  const c = b ? category(b.category) : null;
  const mine = !!b && !!session?.business && session.business.id === b.id;
  const member = !!session?.user;
  const hasBiz = !!session?.business;

  return (
    <main className="pt-[var(--hh,96px)]">
      <div ref={hero} className="relative h-[46vh] min-h-[320px] overflow-hidden sm:h-[52vh]">
        {b ? (
          <motion.div style={{ y: coverY, scale: coverScale }} className="absolute inset-0">
            <Cover big name={b.name} cat={b.category} url={b.coverUrl} className="size-full" />
          </motion.div>
        ) : (
          <Skeleton className="size-full !rounded-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-abyss/85 via-abyss/20 to-transparent" />
        <div className="absolute inset-x-0 top-4 mx-auto max-w-6xl px-5 sm:px-8">
          <Link href="/explorar" className="glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/15">
            <ArrowLeft className="size-4" /> Mapa
          </Link>
        </div>
        {b && c && (
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-8 sm:px-8">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}>
              <CategoryBadge id={b.category} glass />
              <h1 className="font-display mt-3 text-5xl font-bold leading-[0.95] text-white sm:text-7xl">{b.name}</h1>
              <p className="mt-3 flex items-center gap-1.5 text-white/80">
                <MapPin className="size-4" /> {[b.neighborhood, b.city, b.state].filter(Boolean).join(" · ")}
              </p>
            </motion.div>
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {/* Ações */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease }} className="flex flex-wrap gap-3">
            {!b ? (
              <Skeleton className="h-11 w-60 !rounded-full" />
            ) : mine ? (
              <LinkButton href="/painel/meu-negocio" variant="brand" icon={<Pencil className="size-4" />}>Editar meu perfil</LinkButton>
            ) : !member ? (
              <>
                <LinkButton href="/cadastro" variant="primary" icon={<MessagesSquare className="size-4" />}>Crie sua conta para conversar</LinkButton>
                <LinkButton href="/entrar" variant="outline">Já tenho conta</LinkButton>
              </>
            ) : !hasBiz ? (
              <LinkButton href="/painel/meu-negocio" variant="primary">Cadastre seu negócio para conectar</LinkButton>
            ) : (
              <>
                <LinkButton href={`/painel/conversas/${b.id}`} variant="brand" icon={<MessagesSquare className="size-4" />}>Conversar</LinkButton>
                {live ? (
                  <Button variant="outline" disabled icon={<Hourglass className="size-4" />}>
                    Parceria em andamento {live.status === "accepted" ? "· aceita" : "· pendente"}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setPropose(true)} icon={<Handshake className="size-4" />}>Propor parceria</Button>
                )}
              </>
            )}
          </motion.div>

          <Section title="Sobre" delay={0.2}>
            {b ? <p className="whitespace-pre-line text-lg leading-relaxed text-ink-soft">{b.description || "O dono ainda não escreveu uma descrição."}</p> : <Skeleton className="h-24" />}
          </Section>

          {b && (b.idealPartners || b.partnerOffer) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {b.idealPartners && (
                <Section delay={0.25} card icon={<Target className="size-5" />} title="Parceiros que procura">
                  <p className="text-ink-soft">{b.idealPartners}</p>
                </Section>
              )}
              {b.partnerOffer && (
                <Section delay={0.3} card accent icon={<Gift className="size-5" />} title="Benefício para parceiros">
                  <p className="text-ink">{b.partnerOffer}</p>
                  <p className="mt-3 text-xs text-ink-faint">Oferta informal, combinada diretamente entre os negócios. O ConectaBC não intermedeia nem garante benefícios.</p>
                </Section>
              )}
            </div>
          )}

          {b && b.lat !== null && b.lng !== null && (
            <Section title="Localização" delay={0.35}>
              <div className="card h-72 overflow-hidden rounded-3xl">
                <LeafletMap businesses={[b]} activeId={b.id} zoom={16} center={{ lat: b.lat, lng: b.lng }} interactive />
              </div>
              <p className="mt-2 text-sm text-ink-faint">{b.address}</p>
            </Section>
          )}
        </div>

        {/* Contato */}
        <aside>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.8, ease }} className="card sticky top-[calc(var(--hh,96px)+1.5rem)] rounded-3xl p-6">
            <h2 className="font-display text-xl font-bold">Contato</h2>
            {!b ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
              </div>
            ) : (
              <ul className="mt-4 space-y-4 text-sm">
                {b.address && <Row icon={MapPin} label="Endereço">{b.address}{b.neighborhood ? `, ${b.neighborhood}` : ""}</Row>}
                {b.hours && <Row icon={Clock} label="Horário">{b.hours}</Row>}
                {isFull(b) ? (
                  <>
                    {b.phone && <Row icon={Phone} label="Telefone"><a className="hover:text-teal" href={`tel:${b.phone.replace(/\D/g, "")}`}>{b.phone}</a></Row>}
                    {b.whatsapp && (
                      <Row icon={MessageCircle} label="WhatsApp">
                        <a className="font-semibold text-teal hover:underline" href={whatsappLink(b.whatsapp)} target="_blank" rel="noopener noreferrer">{b.whatsapp} ↗</a>
                      </Row>
                    )}
                    {b.instagram && <Row icon={AtSign} label="Instagram"><a className="hover:text-teal" href={instagramLink(b.instagram)} target="_blank" rel="noopener noreferrer">{b.instagram}</a></Row>}
                    {b.website && <Row icon={Globe} label="Site"><a className="hover:text-teal" href={websiteLink(b.website)} target="_blank" rel="noopener noreferrer">{b.website}</a></Row>}
                  </>
                ) : (
                  <li className="rounded-2xl bg-surface-2 p-4 text-ink-soft">
                    <Lock className="mb-2 size-5 text-teal" />
                    Telefone, WhatsApp, Instagram e site ficam visíveis apenas para membros.{" "}
                    <Link href="/cadastro" className="font-semibold text-teal hover:underline">Criar conta grátis</Link>
                  </li>
                )}
              </ul>
            )}
          </motion.div>
        </aside>
      </div>

      {b && <ProposeModal open={propose} onClose={() => setPropose(false)} businessId={b.id} businessName={b.name} onDone={loadLive} />}
      <Footer />
    </main>
  );
}

function Section({ title, children, delay = 0, card, icon, accent }: { title: string; children: React.ReactNode; delay?: number; card?: boolean; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8, ease }}
      className={card ? `rounded-3xl p-6 ${accent ? "bg-gradient-to-br from-aqua/15 to-sand/40 border border-teal/15 dark:to-transparent" : "card"}` : ""}
    >
      <h2 className="font-display mb-3 flex items-center gap-2 text-xl font-bold">
        {icon && <span className="text-teal">{icon}</span>}
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-teal">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        <div className="break-words text-ink">{children}</div>
      </div>
    </li>
  );
}
