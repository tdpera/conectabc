# ConectaBC

A rede privada de negócios de Balneário Camboriú: um mapa onde donos de negócios se encontram, um chat para conversar e um sistema de parcerias para formalizar colaborações. B2B, em português, para desktop e celular.

## Rodar

```bash
npm install
npm run dev
```

Sem chaves configuradas, o app sobe em **modo demonstração**: 40 negócios fictícios, conversas e propostas guardados só no navegador. O botão **Demo** (canto da tela) troca de conta (membro, conta nova, admin), viaja para depois do lançamento e restaura os dados.

## Tour para avaliação

1. **Abertura** (`/`): a água "emerge", a costa da baía se desenha com coordenadas reais, os negócios caem como pins e a rede de conexões se forma. `Esc` pula.
2. Role a página: contadores em odômetro, celular fixo que conta os 3 passos, faixa de segmentos, holofote nos cartões, relógio até 15/01/2027.
3. **Explorar** (`/explorar`): busca, filtros, "Perto de mim" (distância real), passar o mouse num cartão voa até o pin.
4. Entre como **Membro** (Demo → Membro). Abra uma conversa e mande uma mensagem: o outro negócio responde. Proponha uma parceria num perfil e aceite uma em **Parcerias** (🎉).
5. Demo → **Pós-lançamento**: o paywall entra em vigor. Assine pelo checkout simulado e veja o mapa só com negócios pagantes. Saia da conta para ver a tela de bloqueio do visitante.
6. Demo → **Administrador**: indicadores, checklist do Stripe e tabela filtrável.

## Modo real (Supabase + Stripe)

1. Crie um projeto Supabase e rode `supabase/migrations/*.sql` em ordem.
2. Em Auth → Email Templates → *Confirm signup*, use `{{ .Token }}` para enviar o código de 6 dígitos. Ative o provedor Google com o redirect `https://SEU_DOMINIO/auth/callback`.
3. Defina o admin: `update public.profiles set is_admin = true where email = 'voce@exemplo.com';`
4. Preencha `.env` a partir de `.env.example` e siga `/admin/stripe-guia` (preço mensal R$ 49,99 BRL, webhook em `/api/stripe/webhook`).

## Arquitetura

- `lib/core.ts`: todas as regras (diretório, mensagens, parcerias, admin), escritas uma vez e executadas no servidor (`app/api/rpc/[op]`, com service role) e na demo (`lib/backend/demo.ts`).
- `lib/server/entitlement.ts`: acesso após o lançamento verificado **ao vivo no Stripe**, com cache de 2 minutos; o webhook mantém `subscriptions` em dia e usa `billing_events` para idempotência.
- `supabase/migrations`: esquema, RLS (cada usuário lê só o que é seu; sem escrita direta em mensagens/parcerias/assinaturas), índice único de parceria viva por par.
- Visual: Next.js 15, Tailwind 4, Motion, GSAP + ScrollTrigger, Lenis, react-three-fiber (shader de água), Leaflet + OpenStreetMap/CARTO.

## Testes

```bash
npm test               # regras, núcleo e RLS (migrações reais em Postgres/PGlite)
node e2e/flow.mjs      # fluxo completo no navegador (com o app rodando em :3000)
```

## Ainda não construído

Notificações por e-mail/push · chat em tempo real (é polling de 15 s) · upload de imagem (capa por URL ou arte automática) · avaliações e reservas · rastreamento de indicações/descontos · 2FA · um negócio por conta.
