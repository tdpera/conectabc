import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "../supabase-env";

/** Chave secreta (só servidor): nome novo ou o antigo service_role. */
const serverKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function serverConfigured() {
  return !!(SUPABASE_URL && SUPABASE_PUBLIC_KEY && serverKey());
}

/** Cliente com a sessão do usuário (respeita RLS). */
export async function userClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}

let admin: ReturnType<typeof createClient> | null = null;
/** Cliente service role: usado apenas depois que o servidor validou dono e permissão. */
export function adminClient() {
  if (!admin)
    admin = createClient(SUPABASE_URL, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return admin;
}
