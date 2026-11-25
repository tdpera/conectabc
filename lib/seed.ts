import type { Business, CategoryId, Membership, Message, Partnership, Subscription } from "./types";
import { PRICE_CENTS } from "./plan";

/**
 * Dados FICTÍCIOS do modo demonstração. Nenhum destes negócios existe de verdade;
 * telefones usam o prefixo fictício 0000 e não recebem mensagens.
 */

export const DEMO_USER = { id: "u-demo", email: "voce@demo.conectabc", name: "Marina (demo)", isAdmin: false };
export const DEMO_ADMIN = { id: "u-admin", email: "admin@demo.conectabc", name: "Administração (demo)", isAdmin: true };

type Row = [
  name: string,
  category: CategoryId,
  neighborhood: string,
  lat: number | null,
  lng: number | null,
  description: string,
  idealPartners: string,
  partnerOffer: string,
  hours: string,
  address: string,
  sub: Subscription["status"],
];

const ROWS: Row[] = [
  ["Café Maré Alta", "cafes", "Centro", -26.9915, -48.6352, "Cafeteria de especialidade a duas quadras do mar. Grãos de produtores catarinenses, pão de fermentação natural feito na casa e um balcão onde todo mundo se conhece.", "Hotéis e pousadas que queiram oferecer café da manhã diferenciado; lojas de praia para ações conjuntas.", "10% para hóspedes de pousadas parceiras e um café cortesia para cada indicação.", "Seg a sáb, 7h às 19h", "Rua 1500, 820", "none"],
  ["Pousada Vento Sul", "hoteis", "Barra Sul", -27.0019, -48.6272, "Pousada familiar com 14 quartos, a 80 m da areia na Barra Sul. Recebemos muitos casais e famílias que pedem dicas de onde comer e passear.", "Restaurantes, passeios de barco e cafés para indicar aos hóspedes.", "Indicamos parceiros no check-in e no grupo de WhatsApp dos hóspedes.", "Recepção 24h", "Av. Atlântica, 5410", "active"],
  ["Cantina Nonna Beatrice", "restaurantes", "Centro", -26.9889, -48.6361, "Massas frescas e molhos da receita da nonna, há 18 anos na mesma esquina. Salão para 60 pessoas e eventos fechados.", "Hotéis, agências de turismo e organizadores de eventos.", "Sobremesa cortesia para clientes indicados por parceiros.", "Ter a dom, 11h30 às 15h e 19h às 23h", "Av. Brasil, 1340", "active"],
  ["Escuna Horizonte Azul", "turismo", "Barra Sul", -27.0046, -48.6243, "Passeios de escuna pela orla, Ilha das Cabras e praias agrestes. Saídas diárias com guia bilíngue.", "Pousadas, hotéis e cafés que atendem turistas.", "Comissão de 10% por passageiro indicado ou desconto de 15% para clientes parceiros.", "Saídas às 10h, 14h e 16h30", "Píer da Barra Sul", "active"],
  ["Bossa Bar & Petiscos", "bares", "Centro", -26.9937, -48.6351, "Bar de petiscos com música ao vivo de quinta a domingo. Drinks autorais com frutas da estação.", "Hotéis, produtoras de eventos e restaurantes que fecham cedo.", "Happy hour estendido para grupos indicados.", "Qua a dom, 17h à 1h", "Rua 2000, 155", "trialing"],
  ["Studio Areia Pilates", "beleza", "Pioneiros", -26.9804, -48.6365, "Pilates, fisioterapia e massagem relaxante em um estúdio com vista para o morro.", "Academias, lojas de roupa fitness e hotéis com público de bem-estar.", "Aula experimental gratuita para clientes de parceiros.", "Seg a sex, 6h às 21h", "Rua 3100, 440", "active"],
  ["Loja Onda Livre Surf", "esporte", "Pioneiros", -26.9788, -48.6339, "Pranchas, roupas de borracha e aulas de surf para iniciantes. Aluguel por hora ou por dia.", "Pousadas, escolas e cafés perto da praia.", "Aluguel de prancha com 20% de desconto para hóspedes parceiros.", "Todos os dias, 8h às 18h", "Av. Atlântica, 1200", "trialing"],
  ["Padaria Pão do Morro", "cafes", "Nações", -26.9971, -48.6418, "Padaria de bairro com fornadas a cada duas horas. Cucas, sonhos e o pão francês que acaba antes das 8h.", "Pousadas e hotéis que compram café da manhã terceirizado.", "Preço de atacado e entrega antes das 6h30 para parceiros.", "Todos os dias, 6h às 21h", "Rua Japão, 210", "active"],
  ["Contábil Litoral", "servicos", "Centro", -26.9902, -48.6378, "Contabilidade para pequenos negócios do turismo e do comércio. Abertura de empresa, folha e MEI.", "Qualquer negócio local que precise organizar as contas.", "Primeiro mês de honorários com 50% de desconto para membros indicados.", "Seg a sex, 8h às 18h", "Rua 1900, 77, sala 302", "active"],
  ["Sorveteria Gelato da Praia", "cafes", "Centro", -26.9958, -48.6346, "Gelato artesanal italiano feito diariamente. Sabores de frutas nativas como butiá e araçá.", "Restaurantes sem sobremesa própria, hotéis e passeios.", "Fornecemos gelato para eventos de parceiros a preço de custo.", "Todos os dias, 12h às 23h", "Av. Atlântica, 3300", "none"],
  ["Hotel Pontal Norte", "hoteis", "Pioneiros", -26.9779, -48.6352, "Hotel de 60 apartamentos com piscina aquecida e sala de eventos para 120 pessoas.", "Agências de turismo, restaurantes e produtores de eventos corporativos.", "Tarifa corporativa para parceiros e indicação ativa no concierge.", "Recepção 24h", "Av. Atlântica, 600", "active"],
  ["Ateliê Concha Rosa", "varejo", "Centro", -26.9921, -48.6384, "Biquínis e saídas de praia produzidos em BC, com tecidos reciclados.", "Pousadas, salões de beleza e fotógrafos.", "Vale-desconto de 10% para clientes de parceiros e vitrine compartilhada.", "Seg a sáb, 9h às 20h", "Rua 1600, 312", "trialing"],
  ["Barbearia Capitão", "beleza", "Nações", -26.9988, -48.6402, "Barbearia clássica com cerveja gelada e sinuca. Corte, barba e toalha quente.", "Bares, lojas masculinas e academias.", "Corte com 15% de desconto para quem chega por indicação.", "Ter a sáb, 9h às 20h", "Rua Peru, 120", "none"],
  ["Mercado Raízes Orgânicos", "varejo", "Estados", -26.9912, -48.6489, "Hortifrúti orgânico de pequenos produtores do Vale do Itajaí, com cesta semanal por assinatura.", "Restaurantes e cafés que valorizam ingrediente local.", "Preço especial e entrega programada para restaurantes parceiros.", "Seg a sáb, 8h às 19h", "Rua Rio Grande do Sul, 560", "active"],
  ["Bistrô Pé na Areia", "restaurantes", "Barra Sul", -27.0009, -48.6276, "Frutos do mar grelhados e moqueca para dividir, com mesas no deck.", "Pousadas, escunas e agências de passeio.", "Caipirinha cortesia para grupos indicados por parceiros.", "Todos os dias, 11h30 às 23h", "Av. Atlântica, 5100", "active"],
  ["Agência Rota Catarina", "turismo", "Centro", -26.9876, -48.6368, "Receptivo turístico: Beto Carrero, Unipraias, city tour e transfer do aeroporto.", "Hotéis, pousadas e restaurantes que recebem turistas.", "Comissão por indicação e roteiros que incluem parceiros.", "Seg a dom, 8h às 20h", "Av. Brasil, 980", "active"],
  ["Academia Movimento BC", "esporte", "Estados", -26.9935, -48.6472, "Musculação, funcional e cross training com plano diário para turistas.", "Hotéis sem academia, estúdios e lojas de suplementos.", "Diária a preço de custo para hóspedes de parceiros.", "Seg a sex, 5h30 às 23h", "Rua Minas Gerais, 1020", "trialing"],
  ["Pizzaria Forno de Pedra", "restaurantes", "Nações", -26.9952, -48.6431, "Pizza napolitana em forno a lenha, massa com 48 horas de fermentação.", "Pousadas e hotéis para delivery aos hóspedes.", "Entrega sem taxa para hotéis parceiros.", "Todos os dias, 18h às 0h", "Rua Argentina, 330", "none"],
  ["Spa Brisa Marinha", "beleza", "Barra Sul", -27.0031, -48.6284, "Massagens, banho de ofurô e tratamentos com sal marinho.", "Hotéis, pousadas e organizadores de despedidas e eventos.", "Pacote casal com 20% de desconto para hóspedes de parceiros.", "Todos os dias, 10h às 21h", "Rua 4500, 90", "active"],
  ["Livraria Farol", "varejo", "Centro", -26.9898, -48.6347, "Livraria independente com café, clube do livro e lançamentos de autores do litoral.", "Cafés, escolas e produtores culturais.", "Espaço gratuito para eventos de parceiros.", "Seg a sáb, 10h às 21h", "Rua 1400, 255", "active"],
  ["Pub Âncora", "bares", "Centro", -26.9944, -48.6366, "Pub com 20 torneiras de chope artesanal catarinense e jogos ao vivo.", "Hostels, hotéis e cervejarias locais.", "Primeiro chope cortesia para grupos de parceiros.", "Ter a dom, 18h às 2h", "Rua 2300, 410", "none"],
  ["Pousada Morro do Careca", "hoteis", "Praia dos Amores", -26.9655, -48.6178, "Pousada com 9 chalés no verde, perto da Praia dos Amores. Café colonial incluso.", "Passeios, restaurantes e escolas de surf.", "Indicação no café da manhã e mural de parceiros na recepção.", "Recepção das 7h às 22h", "Rua das Gaivotas, 45", "trialing"],
  ["Escola de Surf Crista", "esporte", "Praia dos Amores", -26.9641, -48.6169, "Aulas de surf e stand up paddle para todas as idades na Praia dos Amores.", "Pousadas, hotéis e lojas de surf.", "Aula experimental com 30% de desconto.", "Todos os dias, 7h às 17h", "Praia dos Amores, posto 1", "active"],
  ["Lavanderia Bolha", "servicos", "Nações", -26.9979, -48.6447, "Lavanderia self-service e coleta para pousadas e restaurantes.", "Pousadas, hotéis, restaurantes e academias.", "Coleta gratuita para parceiros a partir de 20 kg por semana.", "Todos os dias, 7h às 22h", "Rua Chile, 515", "active"],
  ["Restaurante Sabor da Barra", "restaurantes", "Barra", -27.0078, -48.6336, "Comida caseira de pescador, sequência de camarão e vista para o rio Camboriú.", "Agências e escunas que terminam o passeio na Barra.", "Sequência com 10% de desconto para grupos indicados.", "Ter a dom, 11h às 22h", "Rua Ver. Luiz Cordeiro, 88", "active"],
  ["Floricultura Jardim BC", "varejo", "Estados", -26.9894, -48.6505, "Arranjos, decoração de eventos e paisagismo para estabelecimentos.", "Hotéis, restaurantes e organizadores de casamento.", "Arranjo de recepção mensal com preço especial.", "Seg a sáb, 8h às 19h", "Rua Paraná, 280", "none"],
  ["Fotógrafo Ricardo Lente", "servicos", "Centro", -26.9929, -48.6395, "Fotografia de produto, gastronomia e ensaios na praia.", "Restaurantes, lojas e pousadas que precisam de fotos profissionais.", "Primeira sessão de cardápio com 25% de desconto.", "Com hora marcada", "Rua 1800, 60", "trialing"],
  ["Doceria Brigadeiro & Mar", "cafes", "Pioneiros", -26.9817, -48.6378, "Brigadeiros gourmet, bolos de festa e mesa de doces.", "Hotéis, salões de festa e floriculturas.", "Caixa degustação cortesia para cada evento indicado.", "Ter a sáb, 10h às 19h", "Rua 3300, 150", "active"],
  ["Cervejaria Maré Cheia", "bares", "Vila Real", -26.9963, -48.6522, "Cervejaria artesanal com tour de fábrica e taproom.", "Bares, restaurantes e agências de passeio.", "Barril com preço de fábrica para bares parceiros.", "Qui a dom, 16h às 23h", "Rua Itália, 900", "active"],
  ["Clínica Sorriso Atlântico", "servicos", "Centro", -26.9884, -48.6389, "Odontologia estética e atendimento de urgência para turistas.", "Hotéis, pousadas e agências de turismo.", "Avaliação gratuita para clientes indicados.", "Seg a sex, 8h às 20h; sáb até 13h", "Av. Brasil, 1700, sala 12", "none"],
  ["Hostel Ilha das Cabras", "hoteis", "Centro", -26.9947, -48.6352, "Hostel com quartos compartilhados e privativos, a uma quadra da praia.", "Bares, passeios e lavanderias.", "Mural de parceiros e indicação ativa no grupo de hóspedes.", "Recepção 24h", "Rua 2100, 330", "active"],
  ["Ótica Horizonte", "varejo", "Nações", -26.9965, -48.6395, "Óculos de sol com proteção certificada e exames de vista.", "Lojas de praia, escolas de surf e clínicas.", "10% de desconto para membros da rede.", "Seg a sáb, 9h às 19h", "Av. do Estado, 2200", "none"],
  ["Restaurante Japonês Kaigan", "restaurantes", "Pioneiros", -26.9796, -48.6382, "Culinária japonesa com peixe do dia comprado na Barra.", "Hotéis, adegas e organizadores de eventos.", "Combinado cortesia em eventos de parceiros acima de 30 pessoas.", "Ter a dom, 18h30 às 23h30", "Rua 3200, 70", "active"],
  ["Pet Shop Patinhas na Praia", "outros", "Estados", -26.9923, -48.6461, "Banho e tosa, hotelzinho e passeio para cães de turistas.", "Pousadas pet friendly e hotéis.", "Diária de hotelzinho com 15% de desconto para hóspedes parceiros.", "Seg a sáb, 8h às 19h", "Rua Santa Catarina, 340", "trialing"],
  ["Gráfica Rápida Litoral", "servicos", "Vila Real", -27.0002, -48.6488, "Cardápios, cartões, banners e adesivos com entrega em 24h.", "Restaurantes, bares, lojas e eventos.", "Arte de cardápio grátis no primeiro pedido.", "Seg a sex, 8h às 18h", "Rua Áustria, 120", "active"],
  ["Adega Vinho & Vento", "bares", "Barra Sul", -27.0014, -48.6299, "Adega com degustações guiadas de vinhos do sul do Brasil.", "Restaurantes, hotéis e organizadores de eventos.", "Degustação cortesia para clientes de parceiros.", "Ter a sáb, 16h às 23h", "Rua 4100, 210", "active"],
  ["Bike Tour BC", "turismo", "Ariribá", -26.9724, -48.6309, "Aluguel de bicicletas elétricas e tour guiado pela orla e Interpraias.", "Hotéis, hostels e cafés.", "Hora extra grátis para hóspedes indicados.", "Todos os dias, 8h às 18h", "Av. Atlântica, 100", "active"],
  ["Armazém do Chef", "outros", "Barra", -27.0089, -48.6362, "Distribuidora de insumos para restaurantes: frutos do mar, laticínios e secos.", "Restaurantes, bares e padarias.", "Frete grátis para parceiros acima de R$ 500.", "Seg a sáb, 6h às 16h", "Rua Antônio Neto, 400", "none"],
  ["Coworking Orla", "servicos", "Centro", null, null, "Espaço de coworking com sala de reunião e endereço fiscal. Ainda definindo o ponto exato no mapa.", "Contadores, agências e profissionais autônomos.", "Diária cortesia para membros da rede.", "Seg a sex, 8h às 20h", "Endereço em atualização", "active"],
  ["Food Truck Taco Litoral", "restaurantes", "Estados", null, null, "Tacos e burritos em pontos que mudam a cada semana. Por isso, sem pin fixo.", "Cervejarias, eventos e festas de praia.", "Participação em eventos de parceiros com cardápio especial.", "Qui a dom, 18h às 0h", "Itinerante", "trialing"],
];

function iso(daysAgo: number, hours = 0, base = Date.now()): string {
  return new Date(base - daysAgo * 86400000 - hours * 3600000).toISOString();
}

export interface DemoDb {
  version: number;
  users: { id: string; email: string; name: string; isAdmin: boolean }[];
  businesses: Business[];
  messages: Message[];
  partnerships: Partnership[];
  subscriptions: Subscription[];
  billingEvents: string[];
  memberships: Membership[];
  foundersUsed: number;
  pendingCodes: Record<string, string>;
  seededAt: number;
}

export const DEMO_DB_VERSION = 4;

export function buildSeed(base = Date.now()): DemoDb {
  const users = [DEMO_USER, DEMO_ADMIN];
  const subscriptions: Subscription[] = [];
  const businesses: Business[] = ROWS.map((r, i) => {
    const [name, category, neighborhood, lat, lng, description, idealPartners, partnerOffer, hours, address, sub] = r;
    const ownerId = i === 0 ? DEMO_USER.id : `u-${i}`;
    if (i !== 0) users.push({ id: ownerId, email: `dono${i}@demo.conectabc`, name: `Dono(a) de ${name}`, isAdmin: false });
    if (sub !== "none") {
      subscriptions.push({
        userId: ownerId,
        status: sub,
        currentPeriodEnd: sub === "active" ? new Date(base + 20 * 86400000).toISOString() : null,
        trialEnd: sub === "trialing" ? new Date(base + 18 * 86400000).toISOString() : null,
        amount: PRICE_CENTS,
        currency: "brl",
      });
    }
    return {
      id: `b-${String(i + 1).padStart(2, "0")}`,
      ownerId,
      name,
      category,
      description,
      neighborhood,
      city: "Balneário Camboriú",
      address,
      state: "SC",
      hours,
      phone: `(47) 0000-${String(1000 + i * 37).slice(-4)}`,
      whatsapp: `(47) 90000-${String(2000 + i * 53).slice(-4)}`,
      instagram: "@" + name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 22),
      website: i % 3 === 0 ? "" : "exemplo.com.br",
      coverUrl: null,
      idealPartners,
      partnerOffer,
      lat,
      lng,
      isVisible: true,
      // O primeiro é o negócio do usuário demo; depois, datas espalhadas.
      createdAt: iso(i === 0 ? 40 : (i * 7) % 58, i, base),
    };
  });

  // Todos entraram como fundadores; alguns por indicação do Café Maré Alta.
  const memberships: Membership[] = businesses.map((b, i) => ({
    userId: b.ownerId,
    founderNumber: i + 1,
    freeUntil: new Date(base + 18 * 86400000).toISOString(),
    referralCode: i === 0 ? "MARE10" : `BC${String(1000 + i)}`,
    referredCode: [4, 9, 15].includes(i) ? "MARE10" : null,
  }));

  const B = (n: number) => businesses[n - 1];
  const me = B(1);
  const msg = (from: Business, to: Business, body: string, daysAgo: number, h: number, read = true): Message => ({
    id: `m-${from.id}-${to.id}-${daysAgo}-${h}`,
    senderId: from.ownerId,
    recipientId: to.ownerId,
    senderBusinessId: from.id,
    recipientBusinessId: to.id,
    body,
    readAt: read ? iso(daysAgo, h - 0.1, base) : null,
    createdAt: iso(daysAgo, h, base),
  });

  const messages: Message[] = [
    msg(B(2), me, "Oi, Marina! Aqui é da Pousada Vento Sul. Nossos hóspedes sempre perguntam onde tomar um bom café perto da praia.", 3, 6),
    msg(me, B(2), "Que ótimo! A gente adoraria receber. Posso deixar uns cartões com 10% de desconto na recepção de vocês?", 3, 5),
    msg(B(2), me, "Pode sim! Manda uns 50. E se quiser, colocamos vocês no grupo de boas-vindas.", 3, 4.5),
    msg(me, B(2), "Fechado. Passo aí amanhã de manhã com os cartões e uns pães de cortesia ☕", 3, 4),
    msg(B(2), me, "Perfeito, até amanhã!", 2, 20),
    msg(B(8), me, "Bom dia! Vi que vocês fazem pão de fermentação natural. Topa trocar indicações? A gente não faz.", 1, 9),
    msg(me, B(8), "Bom dia! Topo sim. E vocês têm sonho? Muita gente pede aqui.", 1, 8),
    msg(B(8), me, "Temos! Sai fornada às 15h. Vou te mandar uma proposta de parceria pelo app.", 0, 3, false),
    msg(B(4), me, "Olá! Somos da Escuna Horizonte Azul. Podemos deixar folhetos no café?", 6, 2),
    msg(me, B(4), "Claro! Só preciso de um expositor pequeno.", 6, 1),
  ];

  const p = (id: string, from: Business, to: Business, type: Partnership["type"], intro: string, status: Partnership["status"], daysAgo: number): Partnership => ({
    id,
    requesterId: from.ownerId,
    recipientId: to.ownerId,
    requesterBusinessId: from.id,
    recipientBusinessId: to.id,
    type,
    intro,
    status,
    createdAt: iso(daysAgo, 2, base),
    respondedAt: status === "pending" ? null : iso(daysAgo - 0.5, 0, base),
  });

  const partnerships: Partnership[] = [
    p("p-1", B(8), me, "indicacao", "A gente indica o Café Maré Alta para quem procura café especial e vocês indicam nossa padaria para pão do dia. Simples assim, sem burocracia.", "pending", 0.2),
    p("p-2", B(4), me, "desconto", "Proposta: 15% no passeio de escuna para clientes do café e 10% no café para nossos passageiros. Deixamos folhetos dos dois lados.", "pending", 2),
    p("p-3", B(2), me, "indicacao", "Indicar o café aos hóspedes no check-in em troca de cartões de desconto na recepção.", "accepted", 3),
    p("p-4", me, B(20), "evento", "Que tal um clube do livro com café na Livraria Farol? Levamos os quitutes e dividimos a divulgação.", "pending", 1),
    p("p-5", me, B(14), "outro", "Gostaríamos de comprar frutas orgânicas toda semana para os sucos do café.", "accepted", 9),
    p("p-6", B(3), B(16), "indicacao", "Indicação mútua de turistas.", "accepted", 12),
    p("p-7", B(11), B(36), "promocao", "Noite de vinhos no hotel.", "accepted", 7),
  ];

  return { version: DEMO_DB_VERSION, users, businesses, messages, partnerships, subscriptions, billingEvents: [],
    memberships, foundersUsed: memberships.length, pendingCodes: {}, seededAt: base };
}
