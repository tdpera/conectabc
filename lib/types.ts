export type CategoryId =
  | "restaurantes"
  | "cafes"
  | "bares"
  | "varejo"
  | "beleza"
  | "turismo"
  | "hoteis"
  | "esporte"
  | "servicos"
  | "outros";

export interface PublicBusiness {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  neighborhood: string;
  city: string;
  address: string;
  state: string;
  hours: string;
  coverUrl: string | null;
  idealPartners: string;
  partnerOffer: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface Business extends PublicBusiness {
  ownerId: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  isVisible: boolean;
}

export type BusinessInput = Omit<Business, "id" | "ownerId" | "createdAt" | "isVisible">;

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  senderBusinessId: string;
  recipientBusinessId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export type PartnershipType = "indicacao" | "desconto" | "promocao" | "evento" | "outro";
export type PartnershipStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface Partnership {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterBusinessId: string;
  recipientBusinessId: string;
  type: PartnershipType;
  intro: string;
  status: PartnershipStatus;
  createdAt: string;
  respondedAt: string | null;
}

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "paused"
  | "incomplete";

export interface Subscription {
  userId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  amount: number; // centavos
  currency: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface Session {
  user: SessionUser | null;
  business: Business | null;
  subscription: Subscription | null;
  entitled: boolean;
}

export interface Conversation {
  business: PublicBusiness;
  lastMessage: Message;
  unread: number;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  /** null na demonstração, que não guarda a data da conta. */
  createdAt: string | null;
}

/** Uma conta cadastrada; `business` é null enquanto ela não registrou o negócio. */
export interface AdminRow {
  userId: string;
  ownerName: string;
  ownerEmail: string;
  joinedAt: string | null;
  business: Business | null;
  subscription: SubscriptionStatus;
}

export interface AdminStats {
  totalAccounts: number;
  totalBusinesses: number;
  partnershipsAccepted: number;
  partnershipsPending: number;
  /** Só a contagem: o painel não lê o conteúdo das conversas. */
  messages: number;
  activeSubscribers: number;
  earlyRegistrations: number;
  projectedMrr: number;
  config: { key: string; label: string; ok: boolean; detail?: string }[];
  mode: "test" | "live" | "unset";
  rows: AdminRow[];
}
