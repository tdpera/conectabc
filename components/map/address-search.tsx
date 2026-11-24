"use client";
import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { Loader2, MapPin, Search } from "lucide-react";
import { searchPlaces, type Place } from "@/lib/places";

/** Campo de endereço com sugestões enquanto a pessoa digita. */
export function AddressSearch({
  value, city, onText, onPick, label = "Endereço", className,
}: {
  value: string;
  city: string;
  onText: (v: string) => void;
  onPick: (p: Place) => void;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "empty" | "error">("idle");
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const ctl = new AbortController();
    const q = value.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setItems([]);
        setState("idle");
        return;
      }
      setState("busy");
      try {
        const r = await searchPlaces(q, city, ctl.signal);
        setItems(r);
        setCur(0);
        setState(r.length ? "idle" : "empty");
      } catch {
        if (ctl.signal.aborted) return;
        setItems([]);
        setState("error");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value, city]);

  const pick = (p: Place) => {
    typed.current = false;
    setOpen(false);
    setItems([]);
    onPick(p);
  };
  const show = open && value.trim().length >= 2 && (items.length > 0 || state === "empty" || state === "error");

  return (
    <div className={clsx("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={show}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={show && items[cur] ? `${id}-${cur}` : undefined}
          autoComplete="off"
          value={value}
          maxLength={200}
          placeholder="Endereço: rua e número"
          onChange={(e) => {
            typed.current = true;
            setOpen(true);
            onText(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (!show || !items.length) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setCur((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(items[cur]);
            }
          }}
          className="h-14 w-full rounded-2xl border border-line bg-surface pl-11 pr-11 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:ring-4 focus:ring-aqua/20"
        />
        {state === "busy" && <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />}
      </div>
      {show && (
        <div className="absolute inset-x-0 top-full z-[960] mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lg)]">
          {items.length > 0 ? (
            <ul id={`${id}-list`} role="listbox" aria-label="Sugestões de endereço" className="max-h-72 overflow-y-auto py-1">
              {items.map((p, i) => (
                <li
                  key={`${p.label}-${p.lat}-${p.lng}`}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === cur}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  onPointerEnter={() => setCur(i)}
                  className={clsx("flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2", i === cur && "bg-surface-2")}
                >
                  <MapPin className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{p.label}</span>
                    <span className="block truncate text-xs text-ink-faint">
                      {[p.neighborhood, p.city, p.state].filter(Boolean).join(", ")}
                      {p.precision === "approx" && " · posição aproximada"}
                      {p.precision === "street" && !/\d$/.test(p.label) && " · inclua o número"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-soft" role="status">
              {state === "error" ? "A busca falhou. Marque o ponto direto no mapa." : "Endereço não encontrado. Confira o número ou toque no mapa."}
            </p>
          )}
          <p className="border-t border-line px-4 py-1.5 text-[11px] text-ink-faint">Endereços: IBGE (Censo 2022) e © OpenStreetMap</p>
        </div>
      )}
    </div>
  );
}
