import { NextResponse } from "next/server";
import { BC_CENTER, validCoords } from "@/lib/geo";
import { norm, reverseLocal, searchLocal } from "@/lib/server/enderecos";
import type { Place } from "@/lib/places";

/**
 * Endereços: primeiro o CNEFE/IBGE (local). Fora de Balneário Camboriú, o Photon (OpenStreetMap),
 * um serviço público de uso moderado: por isso o cache e o limite por IP.
 */
const PHOTON = process.env.PHOTON_URL || "https://photon.komoot.io";
const cache = new Map<string, { at: number; v: Place[] }>();
const hits = new Map<string, { at: number; n: number }>();

function allowed(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const h = hits.get(ip);
  if (!h || now - h.at > 60_000) {
    hits.set(ip, { at: now, n: 1 });
    return true;
  }
  return ++h.n <= 40;
}

type Feature = { properties: Record<string, string | undefined>; geometry: { coordinates: [number, number] } };

async function photon(path: string, req: Request): Promise<Place[]> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.v;
  if (!allowed(req)) return [];
  try {
    const r = await fetch(PHOTON + path, { signal: AbortSignal.timeout(3500), headers: { "User-Agent": "business-map/1.0" } });
    if (!r.ok) return [];
    const j = (await r.json()) as { features?: Feature[] };
    const v = (j.features ?? [])
      .filter((f) => f.properties.countrycode === "BR")
      .map((f): Place => {
        const p = f.properties;
        const street = p.street || (p.osm_key === "highway" ? p.name : "") || "";
        const address = [street || p.name, p.housenumber].filter(Boolean).join(", ");
        const named = p.name && p.name !== street;
        return {
          label: [named ? p.name : "", address !== p.name ? address : ""].filter(Boolean).join(", ") || address,
          address,
          neighborhood: p.district ?? "",
          city: p.city ?? p.county ?? "",
          state: p.state === "Santa Catarina" ? "SC" : p.state === "Paraná" ? "PR" : p.state === "Rio Grande do Sul" ? "RS" : p.state === "São Paulo" ? "SP" : p.state === "Rio de Janeiro" ? "RJ" : p.state === "Minas Gerais" ? "MG" : "",
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          // nunca "exact": o Photon às vezes troca a rua, então a pessoa confere o pin
          precision: p.housenumber ? "approx" : "street",
        };
      })
      .filter((p) => p.label);
    if (cache.size > 2000) cache.clear();
    cache.set(path, { at: Date.now(), v });
    return v;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  if (u.has("lat")) {
    const lat = Number(u.get("lat") || NaN);
    const lng = Number(u.get("lng") || NaN);
    if (!validCoords(lat, lng)) return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
    const local = reverseLocal(lat, lng);
    if (local) return NextResponse.json(local);
    const r = await photon(`/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&limit=1`, req);
    return NextResponse.json(r[0] ?? null);
  }
  const q = (u.get("q") ?? "").trim().slice(0, 160);
  if (q.length < 2) return NextResponse.json([]);
  const city = (u.get("city") ?? "").trim().slice(0, 80);
  const here = !city || norm(city) === "balneario camboriu";
  const local = here ? searchLocal(q) : [];
  if (local.length || q.length < 4) return NextResponse.json(local);
  const full = city && !norm(q).includes(norm(city)) ? `${q}, ${city}` : q;
  const path = `/api/?q=${encodeURIComponent(full)}&lat=${BC_CENTER.lat}&lon=${BC_CENTER.lng}&limit=6`;
  return NextResponse.json(await photon(path, req));
}
