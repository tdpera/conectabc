"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl, GeolocateControl, LngLatBounds, Map as GLMap, Marker, NavigationControl, Popup, setWorkerUrl,
  type MapOptions,
} from "maplibre-gl";
import Supercluster from "supercluster";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { category } from "@/lib/categories";
import { BC_CENTER } from "@/lib/geo";
import type { DirectoryEntry } from "@/lib/backend/types";

/** OpenFreeMap: mapa vetorial gratuito, sem chave e sem limite de acessos. */
const STYLE = { light: "https://tiles.openfreemap.org/styles/liberty", dark: "https://tiles.openfreemap.org/styles/dark" };
const LOCALE = {
  "NavigationControl.ZoomIn": "Aproximar",
  "NavigationControl.ZoomOut": "Afastar",
  "NavigationControl.ResetBearing": "Apontar para o norte",
  "GeolocateControl.FindMyLocation": "Minha localização",
  "GeolocateControl.LocationNotAvailable": "Localização indisponível",
  "AttributionControl.ToggleAttribution": "Créditos do mapa",
  "Popup.Close": "Fechar",
  "CooperativeGesturesHandler.WindowsHelpText": "Use Ctrl + rolagem para dar zoom",
  "CooperativeGesturesHandler.MacHelpText": "Use ⌘ + rolagem para dar zoom",
  "CooperativeGesturesHandler.MobileHelpText": "Use dois dedos para mover o mapa",
};

// Copiado para public/ antes do dev/build (package.json), sempre na mesma versão da biblioteca.
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-worker.mjs");

type Pos = { lat: number; lng: number };

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** Cria o mapa uma vez e acompanha o tema claro/escuro. */
function useGLMap(opts: () => Partial<MapOptions>) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GLMap | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let m: GLMap;
    let dark = isDark();
    try {
      m = new GLMap({
        container: box.current!,
        style: dark ? STYLE.dark : STYLE.light,
        maxZoom: 19.5,
        minZoom: 3,
        attributionControl: false,
        locale: LOCALE,
        ...opts(),
      });
    } catch {
      setFailed(true);
      return;
    }
    m.addControl(new AttributionControl({ compact: true }), "bottom-right");
    m.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    const sync = () => {
      if (isDark() === dark) return;
      dark = !dark;
      m.setStyle(dark ? STYLE.dark : STYLE.light);
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    setMap(m);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", sync);
      setMap(null);
      m.remove();
    };
    // o mapa é criado uma única vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { box, map, failed };
}

const Failed = () => (
  <div className="absolute inset-0 grid place-items-center bg-surface-2 p-6 text-center text-sm text-ink-soft">
    O mapa não pôde ser carregado neste navegador.
  </div>
);

function pinElement(b: DirectoryEntry, mine: boolean) {
  const c = category(b.category);
  const el = document.createElement("button");
  el.type = "button";
  el.className = "cbc-pin";
  el.setAttribute("aria-label", b.name);
  el.title = b.name;
  el.innerHTML = `<span class="pin" style="--c1:${mine ? "#ff7a59" : c.hue[0]};--c2:${mine ? "#e85d3c" : c.hue[1]}"><span class="shadow"></span><span class="tail"></span><span class="bubble">${c.emoji}</span></span>`;
  return el;
}

export default function BusinessMap({
  businesses, activeId, hoverId, me, focus, fitKey = "", mineId, onSelect, renderPopup, zoom = 14, center, className, embedded = false,
}: {
  businesses: DirectoryEntry[];
  activeId?: string | null;
  hoverId?: string | null;
  me?: Pos | null;
  focus?: (Pos & { zoom?: number; key: number }) | null;
  /** Reenquadra o mapa só quando este valor muda (busca/filtro), nunca porque chegou um negócio novo. */
  fitKey?: string;
  mineId?: string | null;
  onSelect?: (id: string | null) => void;
  renderPopup?: (b: DirectoryEntry) => React.ReactNode;
  zoom?: number;
  center?: Pos;
  className?: string;
  /** Dentro de uma página que rola: não captura a rolagem. */
  embedded?: boolean;
}) {
  const pins = useMemo(() => businesses.filter((b) => b.lat !== null && b.lng !== null), [businesses]);
  const c = center ?? BC_CENTER;
  const { box, map, failed } = useGLMap(() => ({ center: [c.lng, c.lat], zoom, cooperativeGestures: embedded }));
  const markers = useRef(new Map<string, Marker>());
  const select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; });
  const [popup, setPopup] = useState<{ id: string; el: HTMLElement } | null>(null);

  useEffect(() => {
    if (!map || embedded) return;
    const g = new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true });
    map.addControl(g, "top-right");
  }, [map, embedded]);

  // Pins e agrupamentos: recalcula ao mover o mapa ou mudar os dados
  useEffect(() => {
    if (!map) return;
    const index = new Supercluster<{ id: string }>({ radius: 46, maxZoom: 16 }).load(
      pins.map((b) => ({ type: "Feature", properties: { id: b.id }, geometry: { type: "Point", coordinates: [b.lng!, b.lat!] } })),
    );
    const byId = new Map(pins.map((b) => [b.id, b]));
    const shown = markers.current;
    shown.forEach((m) => m.remove());
    shown.clear();
    const draw = () => {
      const v = map.getBounds();
      const keep = new Set<string>();
      for (const f of index.getClusters([v.getWest() - 0.01, v.getSouth() - 0.01, v.getEast() + 0.01, v.getNorth() + 0.01], Math.floor(map.getZoom()))) {
        const at = f.geometry.coordinates as [number, number];
        if ("cluster" in f.properties && f.properties.cluster) {
          const { cluster_id: cid, point_count: n } = f.properties;
          const key = `c${cid}-${n}`;
          keep.add(key);
          if (shown.has(key)) continue;
          const el = document.createElement("button");
          el.type = "button";
          el.className = "cbc-cluster";
          el.setAttribute("aria-label", `${n} negócios nesta área`);
          el.innerHTML = `<span>${n}</span>`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            map.easeTo({ center: at, zoom: Math.min(19, index.getClusterExpansionZoom(cid) + 0.4), duration: 600 });
          });
          shown.set(key, new Marker({ element: el }).setLngLat(at).addTo(map));
        } else {
          const b = byId.get((f.properties as { id: string }).id)!;
          keep.add(b.id);
          if (shown.has(b.id)) continue;
          const el = pinElement(b, b.id === mineId);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            select.current?.(b.id);
          });
          shown.set(b.id, new Marker({ element: el, anchor: "bottom" }).setLngLat(at).addTo(map));
        }
      }
      shown.forEach((m, k) => {
        if (keep.has(k)) return;
        m.remove();
        shown.delete(k);
      });
      hot.current();
    };
    draw();
    map.on("move", draw);
    return () => {
      map.off("move", draw);
      shown.forEach((m) => m.remove());
      shown.clear();
    };
  }, [map, pins, mineId]);

  // Destaque do pin ativo / em foco na lista
  const hot = useRef<() => void>(() => {});
  useEffect(() => {
    hot.current = () =>
      markers.current.forEach((m, id) => {
        const on = id === activeId || id === hoverId;
        m.getElement().classList.toggle("active", on);
        m.getElement().style.zIndex = on ? "5" : "";
      });
    hot.current();
  }, [activeId, hoverId, pins, map, mineId]);

  // Balão do negócio selecionado
  const activePin = pins.find((b) => b.id === activeId) ?? null;
  const hasPopup = !!renderPopup;
  const { lat: pLat, lng: pLng, id: pId } = activePin ?? {};
  useEffect(() => {
    if (!map || !hasPopup || !pId || pLat == null || pLng == null) return;
    const el = document.createElement("div");
    const p = new Popup({ offset: [0, -48], anchor: "bottom", maxWidth: "260px", closeOnClick: false, focusAfterOpen: false, className: "cbc-popup" })
      .setLngLat([pLng, pLat])
      .setDOMContent(el)
      .addTo(map);
    setPopup({ id: pId, el });
    const closed = () => select.current?.(null);
    p.on("close", closed);
    const clear = () => p.remove();
    map.on("click", clear);
    if (!map.isMoving()) map.easeTo({ center: [pLng, pLat], offset: [0, 110], zoom: Math.max(map.getZoom(), 15.5), duration: 600 });
    return () => {
      p.off("close", closed);
      map.off("click", clear);
      p.remove();
      setPopup(null);
    };
  }, [map, hasPopup, pId, pLat, pLng]);

  // Enquadramento inicial e quando a busca muda
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!map || fitted.current === fitKey || (!pins.length && fitted.current === null)) return;
    const first = fitted.current === null;
    fitted.current = fitKey;
    if (first && (center || focus)) return;
    if (pins.length === 1) map.easeTo({ center: [pins[0].lng!, pins[0].lat!], zoom: 16, duration: first ? 0 : 800 });
    else if (pins.length > 1) {
      const b = new LngLatBounds();
      pins.forEach((p) => b.extend([p.lng!, p.lat!]));
      map.fitBounds(b, { padding: 60, maxZoom: 16, duration: first ? 0 : 800 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey, pins]);

  useEffect(() => {
    if (map && focus) map.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), focus.zoom ?? 16), duration: 800 });
  }, [map, focus]);

  useEffect(() => {
    if (!map || !me) return;
    const el = document.createElement("div");
    el.className = "me-dot";
    const m = new Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map);
    map.easeTo({ center: [me.lng, me.lat], zoom: 15, duration: 900 });
    return () => { m.remove(); };
  }, [map, me]);

  const shownInPopup = popup && pins.find((b) => b.id === popup.id);
  return (
    <div className={className ?? "relative size-full"}>
      <div ref={box} className="size-full" role="region" aria-label="Mapa dos negócios" />
      {failed && <Failed />}
      {popup && shownInPopup && renderPopup && createPortal(renderPopup(shownInPopup), popup.el)}
    </div>
  );
}

export function PickerMap({ value, onChange }: { value: Pos | null; onChange: (lat: number, lng: number) => void }) {
  const c = value ?? BC_CENTER;
  const { box, map, failed } = useGLMap(() => ({ center: [c.lng, c.lat], zoom: value ? 17 : 13.5, cooperativeGestures: true }));
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; });
  const marker = useRef<Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = "crosshair";
    const click = (e: { lngLat: Pos }) => change.current(e.lngLat.lat, e.lngLat.lng);
    map.on("click", click);
    return () => {
      map.off("click", click);
      marker.current = null;
    };
  }, [map]);

  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (!map) return;
    if (lat === undefined || lng === undefined) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const el = document.createElement("div");
      el.className = "cbc-pin active";
      el.innerHTML = '<span class="pin" style="--c1:#ff7a59;--c2:#e85d3c"><span class="shadow"></span><span class="tail"></span><span class="bubble">📍</span></span>';
      const m = new Marker({ element: el, anchor: "bottom", draggable: true }).setLngLat([lng, lat]).addTo(map);
      m.on("dragend", () => { const p = m.getLngLat(); change.current(p.lat, p.lng); });
      marker.current = m;
    } else marker.current.setLngLat([lng, lat]);
    const v = map.getBounds();
    const w = (v.getEast() - v.getWest()) * 0.15;
    const h = (v.getNorth() - v.getSouth()) * 0.15;
    const inside = lng > v.getWest() + w && lng < v.getEast() - w && lat > v.getSouth() + h && lat < v.getNorth() - h;
    if (!inside || map.getZoom() < 15.5) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 17), duration: 800 });
  }, [map, lat, lng]);

  return (
    <div className="relative size-full">
      <div ref={box} className="size-full" role="region" aria-label="Mapa para marcar o ponto do negócio" />
      {failed && <Failed />}
    </div>
  );
}
