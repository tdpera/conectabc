import "server-only";
import type { Repo } from "../core";
import { RuleError } from "../rules";
import type { Business, BusinessInput, Message, Partnership, Subscription } from "../types";
import { adminClient } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
const B = (r: any): Business => ({
  id: r.id, ownerId: r.owner_id, name: r.name, category: r.category, description: r.description ?? "",
  neighborhood: r.neighborhood ?? "", city: r.city, address: r.address ?? "", state: r.state ?? "", hours: r.hours ?? "",
  phone: r.phone ?? "", whatsapp: r.whatsapp ?? "", instagram: r.instagram ?? "", website: r.website ?? "",
  coverUrl: r.cover_url, idealPartners: r.ideal_partners ?? "", partnerOffer: r.partner_offer ?? "",
  lat: r.lat, lng: r.lng, isVisible: r.is_visible, createdAt: r.created_at,
});
const toRow = (b: BusinessInput) => ({
  name: b.name, category: b.category, description: b.description, neighborhood: b.neighborhood, city: b.city,
  address: b.address, state: b.state, hours: b.hours, phone: b.phone, whatsapp: b.whatsapp, instagram: b.instagram,
  website: b.website, cover_url: b.coverUrl, ideal_partners: b.idealPartners, partner_offer: b.partnerOffer, lat: b.lat, lng: b.lng,
});
const M = (r: any): Message => ({
  id: r.id, senderId: r.sender_id, recipientId: r.recipient_id, senderBusinessId: r.sender_business_id,
  recipientBusinessId: r.recipient_business_id, body: r.body, readAt: r.read_at, createdAt: r.created_at,
});
const P = (r: any): Partnership => ({
  id: r.id, requesterId: r.requester_id, recipientId: r.recipient_id, requesterBusinessId: r.requester_business_id,
  recipientBusinessId: r.recipient_business_id, type: r.type, intro: r.intro, status: r.status,
  createdAt: r.created_at, respondedAt: r.responded_at,
});
const S = (r: any): Subscription => ({
  userId: r.user_id, status: r.status, currentPeriodEnd: r.current_period_end, trialEnd: r.trial_end,
  amount: r.amount ?? 0, currency: r.currency ?? "brl",
});

function ok(res: { data: any; error: any }): any {
  if (res.error) {
    if (res.error.code === "23505") throw new RuleError("Registro duplicado: já existe um item igual.", 409);
    throw new Error(res.error.message);
  }
  return res.data;
}

const db = () => adminClient() as any;

export const supabaseRepo: Repo = {
  async listBusinesses(limit) {
    return ok(await db().from("businesses").select("*").order("created_at", { ascending: false }).limit(limit)).map(B);
  },
  async getBusiness(id) {
    const r = ok(await db().from("businesses").select("*").eq("id", id).maybeSingle());
    return r ? B(r) : null;
  },
  async getBusinessByOwner(ownerId) {
    const r = ok(await db().from("businesses").select("*").eq("owner_id", ownerId).maybeSingle());
    return r ? B(r) : null;
  },
  async getBusinessesByIds(ids) {
    if (!ids.length) return [];
    return ok(await db().from("businesses").select("*").in("id", ids)).map(B);
  },
  async insertBusiness(b) {
    try {
      return B(ok(await db().from("businesses").insert({ ...toRow(b), owner_id: b.ownerId, is_visible: true }).select().single()));
    } catch (e) {
      if (e instanceof RuleError && e.status === 409) throw new RuleError("Cada conta pode cadastrar apenas um negócio.", 409);
      throw e;
    }
  },
  async updateBusiness(id, ownerId, b) {
    return B(ok(await db().from("businesses").update(toRow(b)).eq("id", id).eq("owner_id", ownerId).select().single()));
  },
  async listMessagesForUser(userId) {
    return ok(await db().from("messages").select("*").or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order("created_at", { ascending: false }).limit(2000)).map(M);
  },
  async listThread(userId, mine, other) {
    return ok(
      await db().from("messages").select("*")
        .or(`and(sender_business_id.eq.${mine},recipient_business_id.eq.${other}),and(sender_business_id.eq.${other},recipient_business_id.eq.${mine})`)
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: true }).limit(500),
    ).map(M);
  },
  async insertMessage(m) {
    return M(ok(await db().from("messages").insert({
      sender_id: m.senderId, recipient_id: m.recipientId, sender_business_id: m.senderBusinessId,
      recipient_business_id: m.recipientBusinessId, body: m.body,
    }).select().single()));
  },
  async markThreadRead(userId, other, at) {
    ok(await db().from("messages").update({ read_at: at }).eq("recipient_id", userId).eq("sender_business_id", other).is("read_at", null));
  },
  async listPartnershipsForBusiness(id) {
    return ok(await db().from("partnerships").select("*").or(`requester_business_id.eq.${id},recipient_business_id.eq.${id}`)).map(P);
  },
  async listPartnershipsBetween(a, b) {
    return ok(await db().from("partnerships").select("*")
      .or(`and(requester_business_id.eq.${a},recipient_business_id.eq.${b}),and(requester_business_id.eq.${b},recipient_business_id.eq.${a})`)).map(P);
  },
  async getPartnership(id) {
    const r = ok(await db().from("partnerships").select("*").eq("id", id).maybeSingle());
    return r ? P(r) : null;
  },
  async insertPartnership(p) {
    try {
      return P(ok(await db().from("partnerships").insert({
        requester_id: p.requesterId, recipient_id: p.recipientId, requester_business_id: p.requesterBusinessId,
        recipient_business_id: p.recipientBusinessId, type: p.type, intro: p.intro,
      }).select().single()));
    } catch (e) {
      if (e instanceof RuleError && e.status === 409) throw new RuleError("Já existe uma parceria pendente ou aceita com este negócio.", 409);
      throw e;
    }
  },
  async transitionPartnership(id, to, at) {
    const r = ok(await db().from("partnerships").update({ status: to, responded_at: at }).eq("id", id).eq("status", "pending").select().maybeSingle());
    return r ? P(r) : null;
  },
  async getSubscription(userId) {
    const r = ok(await db().from("subscriptions").select("*").eq("user_id", userId).maybeSingle());
    return r ? S(r) : null;
  },
  async listSubscriptions() {
    return ok(await db().from("subscriptions").select("*")).map(S);
  },
  async ownerEmails(ids) {
    const uniq = [...new Set(ids)];
    if (!uniq.length) return {};
    const rows = ok(await db().from("profiles").select("id,email").in("id", uniq)) as { id: string; email: string }[];
    return Object.fromEntries(rows.map((r) => [r.id, r.email]));
  },
};
