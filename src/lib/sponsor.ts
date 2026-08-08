import { linkWhatsApp } from "@/lib/site";
import { SALON_WHATSAPP } from "@/lib/campanha";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

// ═══════════════════════════════════════════════════════════════
// NÍVEIS DE PARCERIA — copy de exibição da modal.
// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER: títulos e descrições a confirmar com a Vitória antes
// de publicar (sinalizado no GATE). Valores em si fechados: 75/150/200€.
export const NIVEIS_PARCERIA_COPY: Record<
  NivelParceria,
  { titulo: string; descricao: string }
> = {
  75: {
    titulo: "Apoio",
    descricao: "Faz parte desta história com um contributo que ajuda a levar o evento a mais mulheres.",
  },
  150: {
    titulo: "Parceria",
    descricao: "Associa a tua marca a um dia de transformação e impacto social.",
  },
  200: {
    titulo: "Patrocínio",
    descricao: "Dá mais visibilidade ao teu negócio como patrocinador oficial do evento.",
  },
};

const NOME_METODO_SPONSOR: Record<MetodoSponsor, string> = {
  mbway: "MB Way",
  transferencia: "Transferência Bancária",
};

export function nomeMetodoSponsor(metodo: MetodoSponsor): string {
  return NOME_METODO_SPONSOR[metodo];
}

/**
 * Mensagem pré-preenchida de confirmação do patrocínio — número ÚNICO do
 * projeto (SALON_WHATSAPP, o do salão). Mesma estrutura da confirmação de
 * pagamento da inscrição: neutra, sem nomear destinatário.
 */
export function mensagemConfirmacaoPatrocinio(
  metodo: MetodoSponsor,
  nivel: NivelParceria
): string {
  return `Olá! Acabei de fazer um patrocínio de ${nivel}€ no Além do Espelho por ${nomeMetodoSponsor(
    metodo
  )}. Como confirmo o pagamento?`;
}

/** Link wa.me com a mensagem de confirmação do patrocínio (MB Way/transferência). */
export function linkWhatsAppPatrocinio(
  metodo: MetodoSponsor,
  nivel: NivelParceria
): string {
  return linkWhatsApp(SALON_WHATSAPP, mensagemConfirmacaoPatrocinio(metodo, nivel));
}
