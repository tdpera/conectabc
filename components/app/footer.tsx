import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="relative bg-[#01141a] text-white/60">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-16 sm:px-8 lg:pb-12">
        <div className="flex flex-col gap-10 border-t border-white/10 pt-12 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-4 text-sm leading-relaxed">
              A rede privada que conecta donos de negócios de Balneário Camboriú. Feito à beira-mar, para quem tem porta aberta na cidade. 🌊
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div className="space-y-2.5">
              <p className="font-semibold text-white">Rede</p>
              <Link href="/explorar" className="block hover:text-white">Explorar o mapa</Link>
              <Link href="/#como-funciona" className="block hover:text-white">Como funciona</Link>
              <Link href="/#planos" className="block hover:text-white">Assinatura</Link>
            </div>
            <div className="space-y-2.5">
              <p className="font-semibold text-white">Conta</p>
              <Link href="/entrar" className="block hover:text-white">Entrar</Link>
              <Link href="/cadastro" className="block hover:text-white">Criar conta</Link>
              <Link href="/painel/meu-negocio" className="block hover:text-white">Cadastrar negócio</Link>
            </div>
            <div className="space-y-2.5">
              <p className="font-semibold text-white">Mapa</p>
              <p>Dados do mapa © colaboradores do OpenStreetMap</p>
            </div>
          </div>
        </div>
        <p className="mt-12 text-xs text-white/35">© {new Date().getFullYear()} ConectaBC · Balneário Camboriú, SC</p>
      </div>
    </footer>
  );
}
