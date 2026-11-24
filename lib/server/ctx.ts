import "server-only";
import type { Ctx } from "../core";
import { supabaseRepo } from "./repo";
import { isEntitled } from "./entitlement";
import { adminClient, userClient } from "./supabase";

export async function currentUser() {
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export async function serverCtx(): Promise<Ctx & { email: string | null; name: string | null }> {
  const user = await currentUser();
  let isAdmin = false;
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (adminClient() as any).from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = !!data?.is_admin;
  }
  return {
    repo: supabaseRepo,
    userId: user?.id ?? null,
    isAdmin,
    now: new Date(),
    isEntitled: (id) => isEntitled(id),
    email: user?.email ?? null,
    name: (user?.user_metadata?.name as string) ?? null,
  };
}
