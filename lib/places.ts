export type Place = {
  label: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  /** exact: número registrado · approx: número vizinho · street: só a rua/lugar */
  precision: "exact" | "approx" | "street";
};

async function get<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`/api/enderecos?${new URLSearchParams(params)}`, { signal });
  if (!r.ok) throw new Error("Busca de endereços indisponível.");
  return r.json();
}

export const searchPlaces = (q: string, city: string, signal?: AbortSignal) => get<Place[]>({ q, city }, signal);
export const reversePlace = (lat: number, lng: number, signal?: AbortSignal) => get<Place | null>({ lat: String(lat), lng: String(lng) }, signal);
