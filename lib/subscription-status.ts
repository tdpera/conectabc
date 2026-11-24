import type { SubscriptionStatus } from "./types";

export const STATUS_INFO: Record<SubscriptionStatus, { label: string; tone: "success" | "warn" | "danger" | "info" | "default"; body: string }> = {
  none: { label: "Sem assinatura", tone: "default", body: "Você ainda não cadastrou um cartão." },
  incomplete: { label: "Pagamento incompleto", tone: "warn", body: "O checkout não foi concluído. Tente novamente." },
  trialing: { label: "Cadastro antecipado", tone: "info", body: "Cartão cadastrado. A primeira cobrança acontece em 15/01/2027 — nada é cobrado antes disso." },
  active: { label: "Ativa", tone: "success", body: "Sua assinatura está em dia. Obrigado por fazer parte da rede!" },
  past_due: { label: "Pagamento atrasado", tone: "warn", body: "Não conseguimos cobrar seu cartão. Atualize a forma de pagamento para manter o acesso." },
  unpaid: { label: "Não paga", tone: "danger", body: "As tentativas de cobrança falharam. Atualize o cartão para reativar o acesso." },
  canceled: { label: "Cancelada", tone: "default", body: "Sua assinatura foi cancelada. Seus dados continuam guardados — é só assinar de novo." },
  paused: { label: "Pausada", tone: "warn", body: "Sua assinatura está pausada." },
};
