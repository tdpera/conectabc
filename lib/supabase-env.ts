/** Chaves do Supabase: aceita os nomes novos (publishable) e os antigos (anon). As referências precisam ser literais para o Next embutir no cliente. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
