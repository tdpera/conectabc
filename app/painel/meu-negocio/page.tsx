"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { AlertTriangle, Check, Contact, Handshake, Info, LocateFixed, MapPin, Save, Store } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp } from "@/components/app/providers";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { toast } from "@/components/ui/toast";
import { CATEGORIES } from "@/lib/categories";
import { backend } from "@/lib/backend";
import { businessSchema } from "@/lib/rules";
import type { BusinessInput } from "@/lib/types";

const PickerMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.PickerMap), { ssr: false, loading: () => <div className="skeleton size-full" /> });

const ease = [0.16, 1, 0.3, 1] as const;

const EMPTY: BusinessInput = {
  name: "", category: "outros", description: "", neighborhood: "", city: "Balneário Camboriú", address: "", state: "SC", hours: "",
  phone: "", whatsapp: "", instagram: "", website: "", coverUrl: null, idealPartners: "", partnerOffer: "", lat: null, lng: null,
};

const SECTIONS = [
  { id: "info", label: "Informações", icon: Store },
  { id: "contato", label: "Contato e divulgação", icon: Contact },
  { id: "parcerias", label: "Oportunidades", icon: Handshake },
  { id: "pin", label: "Ponto no mapa", icon: MapPin },
];

export default function Page() {
  return (
    <RequireMember>
      <BusinessForm />
    </RequireMember>
  );
}

function BusinessForm() {
  const { session, refresh } = useApp();
  const router = useRouter();
  const existing = session?.business;
  const [f, setF] = useState<BusinessInput>(EMPTY);
  const [category, setCategory] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [section, setSection] = useState("info");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (existing) {
      const { id: _i, ownerId: _o, createdAt: _c, isVisible: _v, ...rest } = existing;
      void _i; void _o; void _c; void _v;
      setF(rest);
      setCategory(existing.category);
    }
  }, [existing]);

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setSection(e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
    Object.values(refs.current).forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  const set = <K extends keyof BusinessInput>(k: K, v: BusinessInput[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };
  const bind = (k: keyof BusinessInput) => ({
    value: (f[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    "aria-invalid": !!errors[k],
  });

  const locate = () => {
    if (!("geolocation" in navigator)) return toast.error("Seu navegador não permite localização.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set("lat", +p.coords.latitude.toFixed(6));
        set("lng", +p.coords.longitude.toFixed(6));
        setLocating(false);
        toast.info("Localização aplicada", "Confira se o pin está na porta do seu negócio e ajuste se precisar.");
      },
      () => {
        setLocating(false);
        toast.error("Não conseguimos sua localização", "Clique no mapa para marcar o ponto manualmente.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    const r = businessSchema.safeParse({ ...f, category });
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => (e[String(i.path[0])] ||= i.message));
      setErrors(e);
      const first = Object.keys(e)[0];
      const sec = ["lat", "lng"].includes(first) ? "pin" : ["phone", "whatsapp", "instagram", "website", "coverUrl"].includes(first) ? "contato" : ["idealPartners", "partnerOffer"].includes(first) ? "parcerias" : "info";
      refs.current[sec]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return toast.error("Confira os campos destacados", Object.values(e)[0]);
    }
    setBusy(true);
    try {
      await backend.saveMyBusiness(r.data as BusinessInput);
      await refresh();
      router.push("/explorar?salvo=1");
    } catch (e) {
      toast.error("Não foi possível salvar", (e as Error).message);
      setBusy(false);
    }
  };

  const filled = [!!f.name && !!category && !!f.city, !!(f.phone || f.whatsapp || f.instagram), !!(f.idealPartners || f.partnerOffer), f.lat !== null];

  return (
    <main className="mx-auto max-w-6xl px-5 pb-40 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-ink">{existing ? "Editar" : "Cadastrar"}</p>
        <h1 className="font-display mt-1 text-4xl font-bold sm:text-5xl">Meu negócio</h1>
        <p className="mt-2 max-w-xl text-ink-soft">Uma conta, um negócio. Essas informações aparecem no mapa e no seu perfil. Contatos só são visíveis para membros.</p>
      </motion.div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[230px_1fr]">
        <nav className="hidden lg:block">
          <ol className="sticky top-[calc(var(--hh,96px)+2rem)] space-y-1">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => refs.current[s.id]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={clsx("relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition", section === s.id ? "text-ink" : "text-ink-faint hover:text-ink")}
                >
                  {section === s.id && <motion.span layoutId="sec-pill" className="absolute inset-0 rounded-2xl bg-surface shadow-[var(--shadow)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <span className={clsx("relative grid size-7 place-items-center rounded-full text-xs transition-colors", filled[i] ? "bg-teal text-white" : "bg-surface-2")}>
                    {filled[i] ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="relative">{s.label}</span>
                </button>
              </li>
            ))}
            <li className="pt-4">
              <Button variant="primary" className="w-full" loading={busy} onClick={save} icon={<Save className="size-4" />}>Salvar</Button>
            </li>
          </ol>
        </nav>

        <div className="space-y-8">
          <Card id="info" n={1} title="Informações do negócio" refs={refs}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do negócio *" {...bind("name")} maxLength={120} className={clsx("sm:col-span-2", errors.name && "animate-shake")} hint={errors.name} />
              <div className={clsx("sm:col-span-2", errors.category && "animate-shake")}>
                <p className="mb-2 px-1 text-xs font-semibold text-ink-faint">Categoria *</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => { setCategory(c.id); setErrors((e) => ({ ...e, category: "" })); }}
                      className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition", category === c.id ? "border-teal bg-teal text-white" : "border-line bg-surface hover:border-teal/40")}
                      aria-pressed={category === c.id}
                    >
                      <span aria-hidden>{c.emoji}</span> {c.label}
                    </button>
                  ))}
                </div>
                {errors.category && <p className="mt-1.5 px-1 text-xs text-coral-deep">{errors.category}</p>}
              </div>
              <TextArea label="Descrição" {...bind("description")} maxLength={1500} counter={f.description.length} rows={4} className="sm:col-span-2" />
              <Field label="Bairro" {...bind("neighborhood")} maxLength={80} />
              <Field label="Cidade *" {...bind("city")} maxLength={80} className={clsx(errors.city && "animate-shake")} hint={errors.city} />
              <Field label="Endereço" {...bind("address")} maxLength={200} />
              <Select label="Estado" value={f.state} onChange={(e) => set("state", e.target.value)}>
                {["SC", "PR", "RS", "SP", "RJ", "MG", "Outro"].map((s) => <option key={s} value={s === "Outro" ? "" : s}>{s}</option>)}
              </Select>
              <Field label="Horário de funcionamento" {...bind("hours")} maxLength={200} className="sm:col-span-2" hint="Ex.: Seg a sáb, 8h às 19h" />
            </div>
          </Card>

          <Card id="contato" n={2} title="Contato e divulgação" refs={refs} note="Visível apenas para membros logados.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefone" type="tel" {...bind("phone")} maxLength={30} />
              <Field label="WhatsApp" type="tel" {...bind("whatsapp")} maxLength={30} hint="Vira um link de conversa direta." />
              <Field label="Instagram" {...bind("instagram")} maxLength={80} hint="@seunegocio" />
              <Field label="Site" {...bind("website")} maxLength={200} />
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_180px]">
                <Field label="URL da imagem de capa" value={f.coverUrl ?? ""} onChange={(e) => set("coverUrl", e.target.value || null)} aria-invalid={!!errors.coverUrl} hint={errors.coverUrl || "Cole um link https:// de uma foto. Sem imagem, criamos uma arte automática."} />
                <div className="h-24 overflow-hidden rounded-2xl"><Cover name={f.name || "Seu negócio"} cat={category || "outros"} url={f.coverUrl} className="size-full" /></div>
              </div>
            </div>
          </Card>

          <Card id="parcerias" n={3} title="Oportunidades de parceria" refs={refs}>
            <div className="grid gap-4">
              <TextArea label="Parceiros que procura" {...bind("idealPartners")} maxLength={600} counter={f.idealPartners.length} rows={3} hint="Que tipo de negócio combina com o seu?" />
              <TextArea label="Benefício para parceiros" {...bind("partnerOffer")} maxLength={600} counter={f.partnerOffer.length} rows={3} hint="Ex.: 10% de desconto para clientes indicados. É informal, combinado direto entre vocês." />
            </div>
          </Card>

          <Card id="pin" n={4} title="Ponto no mapa" refs={refs}>
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>Marque o endereço do <strong>estabelecimento</strong>. Nunca use o endereço da sua casa: o ponto fica visível para toda a rede.</p>
            </div>
            <div className={clsx("relative h-80 overflow-hidden rounded-3xl border border-line sm:h-96", errors.lat && "animate-shake ring-2 ring-coral")}>
              <PickerMap value={f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : null} onChange={(lat, lng) => { set("lat", +lat.toFixed(6)); set("lng", +lng.toFixed(6)); setErrors((e) => ({ ...e, lat: "" })); }} />
              {f.lat === null && (
                <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center">
                  <span className="glass rounded-full px-4 py-2 text-sm font-semibold">👆 Clique no mapa para marcar seu ponto</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm text-ink-faint">
                <Info className="size-4" />
                {f.lat !== null ? `Pin em ${f.lat.toFixed(5)}, ${f.lng!.toFixed(5)} · arraste para ajustar` : "Sem pin: seu negócio aparece só na lista."}
              </p>
              <div className="flex gap-2">
                {f.lat !== null && <Button variant="ghost" size="sm" onClick={() => { set("lat", null); set("lng", null); }}>Remover pin</Button>}
                <Button variant="outline" size="sm" onClick={locate} loading={locating} icon={!locating && <LocateFixed className="size-4" />}>Minha localização</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Barra de salvar (celular) */}
      <div className="glass fixed inset-x-3 bottom-24 z-[950] flex items-center justify-between gap-3 rounded-2xl p-2.5 pl-4 lg:hidden">
        <span className="text-sm font-semibold">{filled.filter(Boolean).length}/4 seções</span>
        <Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}>Salvar negócio</Button>
      </div>
    </main>
  );
}

function Card({ id, n, title, children, refs, note }: { id: string; n: number; title: string; children: React.ReactNode; refs: React.RefObject<Record<string, HTMLElement | null>>; note?: string }) {
  return (
    <motion.section
      id={id}
      ref={(el) => { refs.current[id] = el; }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease }}
      className="card scroll-mt-[calc(var(--hh,96px)+1.5rem)] rounded-[2rem] p-6 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="font-display grid size-9 place-items-center rounded-full bg-gradient-to-br from-aqua to-teal font-bold text-white">{n}</span>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {note && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-faint">{note}</span>}
      </div>
      {children}
    </motion.section>
  );
}
