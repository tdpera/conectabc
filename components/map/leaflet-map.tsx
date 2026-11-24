"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo, useRef } from "react";
import { category } from "@/lib/categories";
import { BC_CENTER } from "@/lib/geo";
import type { DirectoryEntry } from "@/lib/backend/types";

const TILE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const iconCache = new Map<string, L.DivIcon>();

export function pinIcon(cat: string, opts: { active?: boolean; dim?: boolean; delay?: number; mine?: boolean } = {}) {
  const key = `${cat}|${!!opts.active}|${!!opts.dim}|${opts.active ? 0 : opts.delay ?? 0}|${!!opts.mine}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const icon = makeIcon(cat, { ...opts, delay: opts.active ? 0 : opts.delay });
  iconCache.set(key, icon);
  return icon;
}

function makeIcon(cat: string, opts: { active?: boolean; dim?: boolean; delay?: number; mine?: boolean }) {
  const c = category(cat);
  return L.divIcon({
    className: `cbc-pin${opts.active ? " active" : ""}${opts.dim ? " dim" : ""}`,
    html: `<div class="pin" style="--c1:${opts.mine ? "#ff7a59" : c.hue[0]};--c2:${opts.mine ? "#e85d3c" : c.hue[1]};--d:${opts.delay ?? 0}ms"><span class="shadow"></span><span class="tail"></span><span class="bubble">${c.emoji}</span></div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 44],
    popupAnchor: [0, -40],
  });
}

const meIcon = L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function Controller({ focus, me, fitIds, list }: { focus: { lat: number; lng: number; zoom?: number; key: number } | null; me: { lat: number; lng: number } | null; fitIds: string; list: DirectoryEntry[] }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), focus.zoom ?? 16), { duration: 0.9, easeLinearity: 0.2 });
  }, [focus, map]);
  useEffect(() => {
    if (me) map.flyTo([me.lat, me.lng], 15, { duration: 1.2 });
  }, [me, map]);
  // Ajusta o enquadramento quando o filtro muda
  const first = useRef(true);
  useEffect(() => {
    if (map.getSize().x === 0) return;
    const initial = first.current;
    first.current = false;
    const pts = list.filter((b) => b.lat !== null && b.lng !== null).map((b) => [b.lat!, b.lng!] as [number, number]);
    if (initial) {
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.08), { maxZoom: 16, animate: false });
      return;
    }
    if (pts.length > 1) map.flyToBounds(L.latLngBounds(pts).pad(0.15), { duration: 0.9, maxZoom: 16 });
    else if (pts.length === 1) map.flyTo(pts[0], 16, { duration: 0.9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitIds]);
  return null;
}

function ClickCatcher({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LeafletMap({
  businesses,
  activeId,
  hoverId,
  me,
  focus,
  mineId,
  onSelect,
  renderPopup,
  zoom = 14,
  center,
  className,
  interactive = true,
}: {
  businesses: DirectoryEntry[];
  activeId?: string | null;
  hoverId?: string | null;
  me?: { lat: number; lng: number } | null;
  focus?: { lat: number; lng: number; zoom?: number; key: number } | null;
  mineId?: string | null;
  onSelect?: (id: string) => void;
  renderPopup?: (b: DirectoryEntry) => React.ReactNode;
  zoom?: number;
  center?: { lat: number; lng: number };
  className?: string;
  interactive?: boolean;
}) {
  const withPin = useMemo(() => businesses.filter((b) => b.lat !== null && b.lng !== null), [businesses]);
  const fitIds = useMemo(() => withPin.map((b) => b.id).join(","), [withPin]);
  const c = center ?? BC_CENTER;
  return (
    <MapContainer
      center={[c.lat, c.lng]}
      zoom={zoom}
      className={className}
      zoomControl={interactive}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      attributionControl
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={TILE} attribution={ATTR} subdomains="abcd" maxZoom={20} detectRetina />
      <Controller focus={focus ?? null} me={me ?? null} fitIds={fitIds} list={withPin} />
      {onSelect && <ClickCatcher />}
      {withPin.map((b, i) => {
        const hot = b.id === activeId || b.id === hoverId;
        return (
          <Marker
            key={b.id}
            position={[b.lat!, b.lng!]}
            icon={pinIcon(b.category, { active: hot, delay: Math.min(i * 35, 1200), mine: b.id === mineId })}
            zIndexOffset={hot ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(b.id) }}
            keyboard
            title={b.name}
          >
            {renderPopup && <Popup closeButton>{renderPopup(b)}</Popup>}
          </Marker>
        );
      })}
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} zIndexOffset={2000} />}
    </MapContainer>
  );
}

export function PickerMap({
  value,
  onChange,
  className,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}) {
  const c = value ?? BC_CENTER;
  return (
    <MapContainer center={[c.lat, c.lng]} zoom={value ? 17 : 14} className={className} style={{ height: "100%", width: "100%" }}>
      <TileLayer url={TILE} attribution={ATTR} subdomains="abcd" maxZoom={20} detectRetina />
      <ClickCatcher onClick={onChange} />
      <PickerFollow value={value} />
      {value && (
        <Marker
          key={`${value.lat.toFixed(6)},${value.lng.toFixed(6)}`}
          position={[value.lat, value.lng]}
          icon={L.divIcon({
            className: "cbc-pin active",
            html: `<div class="pin" style="--c1:#ff7a59;--c2:#e85d3c"><span class="shadow"></span><span class="tail"></span><span class="bubble">📍</span><span class="picker-ripple" style="transform:translate(-50%,-50%)"></span></div>`,
            iconSize: [44, 52],
            iconAnchor: [22, 50],
          })}
          draggable
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }}
        />
      )}
    </MapContainer>
  );
}

function PickerFollow({ value }: { value: { lat: number; lng: number } | null }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!value) return;
    const k = `${value.lat},${value.lng}`;
    if (k === last.current) return;
    last.current = k;
    if (!map.getBounds().pad(-0.2).contains([value.lat, value.lng])) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [value, map]);
  return null;
}
