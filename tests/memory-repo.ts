import type { Repo } from "@/lib/core";
import type { Business, Message, Partnership, Profile, Subscription } from "@/lib/types";
import { RuleError } from "@/lib/rules";

export function memoryRepo(seed: { businesses?: Business[]; subs?: Subscription[]; profiles?: Profile[] } = {}) {
  const db = { businesses: [...(seed.businesses ?? [])], messages: [] as Message[], partnerships: [] as Partnership[], subs: [...(seed.subs ?? [])], profiles: [...(seed.profiles ?? [])] };
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const repo: Repo = {
    listBusinesses: async (l) => db.businesses.slice(0, l),
    getBusiness: async (i) => db.businesses.find((b) => b.id === i) ?? null,
    getBusinessByOwner: async (o) => db.businesses.find((b) => b.ownerId === o) ?? null,
    getBusinessesByIds: async (ids) => db.businesses.filter((b) => ids.includes(b.id)),
    insertBusiness: async (b) => {
      if (db.businesses.some((x) => x.ownerId === b.ownerId)) throw new RuleError("dup", 409);
      const r = { ...b, id: id("b"), createdAt: new Date().toISOString() };
      db.businesses.push(r);
      return r;
    },
    updateBusiness: async (i, o, b) => Object.assign(db.businesses.find((x) => x.id === i && x.ownerId === o)!, b),
    listMessagesForUser: async (u) => db.messages.filter((m) => m.senderId === u || m.recipientId === u),
    listThread: async (u, a, b) => db.messages.filter((m) => (m.senderBusinessId === a && m.recipientBusinessId === b) || (m.senderBusinessId === b && m.recipientBusinessId === a)),
    insertMessage: async (m) => {
      const r = { ...m, id: id("m"), createdAt: new Date(Date.now() + n).toISOString(), readAt: null };
      db.messages.push(r);
      return r;
    },
    markThreadRead: async (u, o, at) => db.messages.forEach((m) => { if (m.recipientId === u && m.senderBusinessId === o && !m.readAt) m.readAt = at; }),
    listPartnershipsForBusiness: async (b) => db.partnerships.filter((p) => p.requesterBusinessId === b || p.recipientBusinessId === b),
    listPartnershipsBetween: async (a, b) => db.partnerships.filter((p) => [p.requesterBusinessId, p.recipientBusinessId].sort().join() === [a, b].sort().join()),
    getPartnership: async (i) => db.partnerships.find((p) => p.id === i) ?? null,
    insertPartnership: async (p) => {
      const r: Partnership = { ...p, id: id("p"), status: "pending", createdAt: new Date().toISOString(), respondedAt: null };
      db.partnerships.push(r);
      return r;
    },
    transitionPartnership: async (i, to, at) => {
      const p = db.partnerships.find((x) => x.id === i);
      if (!p || p.status !== "pending") return null;
      p.status = to;
      p.respondedAt = at;
      return p;
    },
    getSubscription: async (u) => db.subs.find((s) => s.userId === u) ?? null,
    listSubscriptions: async () => db.subs,
    listProfiles: async () => db.profiles,
    activityCounts: async () => ({
      accepted: db.partnerships.filter((p) => p.status === "accepted").length,
      pending: db.partnerships.filter((p) => p.status === "pending").length,
      messages: db.messages.length,
    }),
  };
  return { repo, db };
}

export function biz(i: number, ownerId: string, extra: Partial<Business> = {}): Business {
  return {
    id: `B${i}`, ownerId, name: `Negócio ${i}`, category: "cafes", description: "", neighborhood: "Centro", city: "Balneário Camboriú",
    address: "", state: "SC", hours: "", phone: "(47) 0000-0000", whatsapp: "(47) 90000-0000", instagram: "@x", website: "",
    coverUrl: null, idealPartners: "", partnerOffer: "", lat: -26.99, lng: -48.635, isVisible: true, createdAt: new Date().toISOString(), ...extra,
  };
}
