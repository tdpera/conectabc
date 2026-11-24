import type { CategoryId } from "./types";

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  hue: [string, string];
}

export const CATEGORIES: Category[] = [
  { id: "restaurantes", label: "Restaurantes", emoji: "🍽️", hue: ["#ff7a59", "#ffb36b"] },
  { id: "cafes", label: "Cafés e padarias", emoji: "☕", hue: ["#8b5a3c", "#e0a96d"] },
  { id: "bares", label: "Bares e vida noturna", emoji: "🍹", hue: ["#6d28d9", "#ec4899"] },
  { id: "varejo", label: "Varejo e lojas", emoji: "🛍️", hue: ["#0f8b8d", "#3fd0c9"] },
  { id: "beleza", label: "Beleza e bem-estar", emoji: "💆", hue: ["#db2777", "#f9a8d4"] },
  { id: "turismo", label: "Turismo e passeios", emoji: "⛱️", hue: ["#0284c7", "#67e8f9"] },
  { id: "hoteis", label: "Hotéis e pousadas", emoji: "🏨", hue: ["#0b4f5c", "#2dd4bf"] },
  { id: "esporte", label: "Esporte e lazer", emoji: "🏄", hue: ["#16a34a", "#a3e635"] },
  { id: "servicos", label: "Serviços profissionais", emoji: "💼", hue: ["#334155", "#94a3b8"] },
  { id: "outros", label: "Outros", emoji: "🏪", hue: ["#b45309", "#f4e3c3"] },
];

const BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

export function category(id: string): Category {
  return BY_ID[id as CategoryId] ?? BY_ID.outros;
}

export const PARTNERSHIP_TYPES = [
  { id: "indicacao", label: "Indicação de clientes", emoji: "🤝" },
  { id: "desconto", label: "Desconto cruzado", emoji: "🏷️" },
  { id: "promocao", label: "Promoção conjunta", emoji: "📣" },
  { id: "evento", label: "Evento ou campanha", emoji: "🎉" },
  { id: "outro", label: "Outro", emoji: "✨" },
] as const;

export function partnershipType(id: string) {
  return PARTNERSHIP_TYPES.find((t) => t.id === id) ?? PARTNERSHIP_TYPES[4];
}
