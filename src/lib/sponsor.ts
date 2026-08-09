import { linkWhatsApp } from "@/lib/site";
import { SALON_WHATSAPP } from "@/lib/campanha";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

// ═══════════════════════════════════════════════════════════════
// NÍVEIS DE PARCERIA — copy de exibição da modal (CORREÇÃO nº4).
// ═══════════════════════════════════════════════════════════════
// NOMES = versão da cliente (Apoio / Parceiro / Parceiro Principal).
// A versão do ecrã anterior (Apoio / Parceria / Patrocínio) foi descartada;
// usamos a da cliente até resposta — ASSINALADO NO GATE.
//
// ⚠️ BENEFÍCIOS E VAGAS SÃO PLACEHOLDER (conteúdo do "anexo2" não está no
// repo nem extraível do PDF do dossiê). A confirmar por escrito com a
// Vitória antes de publicar — ver RELATORIO/GATE. Os valores 75/150/200€
// e o badge "MAIS PROCURADO" no nível mais alto são definitivos.
export type NivelParceriaCopy = {
  /** Nome do nível — versão da cliente. */
  titulo: string;
  descricao: string;
  /** Nº de vagas disponíveis; null = por confirmar (não mostra a linha). */
  vagas: number | null;
  /** Lista de benefícios — PLACEHOLDER a confirmar. */
  beneficios: string[];
  /** Badge "MAIS PROCURADO" — só no nível mais alto (200€). */
  maisProcurado: boolean;
};

export const NIVEIS_PARCERIA_COPY: Record<NivelParceria, NivelParceriaCopy> = {
  75: {
    titulo: "Apoio",
    descricao:
      "Faz parte desta história com um contributo que ajuda a levar o Além do Espelho a mais mulheres.",
    vagas: null,
    beneficios: [
      "O teu nome entre as apoiantes do evento.",
      "Associação à campanha Além de Mim e à sua missão.",
    ],
    maisProcurado: false,
  },
  150: {
    titulo: "Parceiro",
    descricao:
      "Associa a tua marca a um dia de transformação e impacto social.",
    vagas: null,
    beneficios: [
      "Tudo o que o nível Apoio inclui.",
      "Destaque do teu logótipo como marca parceira.",
    ],
    maisProcurado: false,
  },
  200: {
    titulo: "Parceiro Principal",
    descricao:
      "Dá a máxima visibilidade ao teu negócio como patrocinador oficial do evento.",
    vagas: null,
    beneficios: [
      "Tudo o que o nível Parceiro inclui.",
      "Destaque principal entre as marcas apoiantes.",
      "Associação direta à campanha Além de Mim.",
    ],
    maisProcurado: true,
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
