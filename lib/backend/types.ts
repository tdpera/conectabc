import type {
  AdminStats, Business, BusinessInput, Conversation, Message, Partnership,
  PartnershipType, PublicBusiness, Session,
} from "../types";

export type DirectoryEntry = PublicBusiness | Business;

export interface DirectoryResult {
  businesses: DirectoryEntry[];
  /** true quando o usuário é membro com acesso (contatos incluídos). */
  full: boolean;
  /** true quando o membro logado não tem mês grátis nem assinatura ativos. */
  paywalled: boolean;
}

export interface PartnershipsResult {
  partnerships: Partnership[];
  businesses: Record<string, PublicBusiness>;
}

export interface Backend {
  mode: "demo" | "live";
  getSession(): Promise<Session>;

  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string, referralCode?: string | null): Promise<{ needsVerification: boolean }>;
  verifyCode(email: string, code: string): Promise<void>;
  resendCode(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  demoLogin?(as: "member" | "admin" | "new"): Promise<void>;
  demoReset?(): Promise<void>;

  listDirectory(): Promise<DirectoryResult>;
  getBusiness(id: string): Promise<DirectoryEntry | null>;
  saveMyBusiness(input: BusinessInput, referralCode?: string | null): Promise<Business>;
  checkReferral(code: string): Promise<{ businessName: string } | null>;

  listConversations(): Promise<Conversation[]>;
  getThread(businessId: string): Promise<Message[]>;
  sendMessage(businessId: string, body: string): Promise<Message>;

  listPartnerships(): Promise<PartnershipsResult>;
  partnershipWith(businessId: string): Promise<Partnership | null>;
  propose(businessId: string, type: PartnershipType, intro: string): Promise<Partnership>;
  respond(id: string, accept: boolean): Promise<Partnership>;
  cancel(id: string): Promise<Partnership>;

  startCheckout(): Promise<{ url: string }>;
  openPortal(): Promise<{ url: string }>;
  adminStats(): Promise<AdminStats>;
}

export class BackendError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
