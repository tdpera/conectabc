import { NextResponse } from "next/server";
import { serverConfigured, userClient } from "@/lib/server/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/painel";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
  const code = url.searchParams.get("code");
  if (code && serverConfigured()) {
    const sb = await userClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
