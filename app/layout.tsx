import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/app/providers";
import { Header } from "@/components/app/header";
import { DemoDock } from "@/components/app/demo-dock";

const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ConectaBC · Rede de negócios de Balneário Camboriú", template: "%s · ConectaBC" },
  description:
    "A rede privada que conecta donos de negócios de Balneário Camboriú: encontre parceiros no mapa, converse direto e formalize parcerias.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { title: "ConectaBC", description: "Seu próximo parceiro está aqui perto.", locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5fbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#021a21" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={onest.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <AppProvider>
          <Header />
          {children}
          <DemoDock />
        </AppProvider>
      </body>
    </html>
  );
}
