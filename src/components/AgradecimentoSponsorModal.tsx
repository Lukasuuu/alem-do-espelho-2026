"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import Modal from "./Modal";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import BotaoCopiar from "./BotaoCopiar";
import { WhatsAppIcon } from "./icons";
import { MBWAY_NUMERO, MBWAY_NUMERO_COPIAR, TRANSFERENCIA, formatarIban } from "@/lib/pagamento";
import { linkWhatsAppPatrocinio, nomeMetodoSponsor, NIVEIS_PARCERIA_COPY } from "@/lib/sponsor";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Método marcado na modal de pagamento (definir_metodo_sponsor). */
  metodo: MetodoSponsor;
  /** Nível de parceria escolhido (75 / 150 / 200€). */
  nivel: NivelParceria;
  /** Nome completo — entra na mensagem pré-preenchida do WhatsApp. */
  nome: string;
  /** Empresa/marca, opcional — entra na mensagem do WhatsApp. */
  empresa?: string | null;
};

/**
 * Modal de AGRADECIMENTO do patrocínio — abre quando a pessoa marca
 * "Já fiz a transferência/pagamento" (fim do fluxo simples de 3 passos).
 *
 * Espelha o pós-pagamento da inscrição (ParabensModal) no mesmo tom, ADAPTADO
 * ao patrocínio:
 *  - 🔴 NUNCA afirma pagamento confirmado — a Vitória confirma ao receber o
 *    comprovativo (que vai por WhatsApp, como na inscrição);
 *  - RECAP dos dados de depósito (nº MB Way ou IBAN, valor, titular) com
 *    Copiar — os MESMOS da fonte única lib/pagamento, por isso nunca divergem
 *    dos ecrãs de pagamento;
 *  - CTA WhatsApp VERDE (#25d366) com mensagem pré-preenchida (nome, empresa,
 *    nível, valor, método) — sem ids nem tokens técnicos;
 *  - Fecho SÓ pelo X (sem clique fora) e, com o recap à vista, X/ESC pedem
 *    confirmação em vez de descartar o ecrã de golpe.
 */
export default function AgradecimentoSponsorModal({
  aberto,
  fechar,
  metodo,
  nivel,
  nome,
  empresa,
}: Props) {
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const nivelTitulo = NIVEIS_PARCERIA_COPY[nivel].titulo;
  const valorText = `${nivel.toFixed(2).replace(".", ",")} €`;
  const referencia = `${nome.trim().split(/\s+/)[0] ?? ""} · Patrocínio Além do Espelho 2026`;
  const whatsappHref = linkWhatsAppPatrocinio(metodo, nivel, nome, empresa);

  /** X/ESC: com o recap de pagamento à vista, pedem confirmação primeiro. */
  function pedirFechar() {
    if (confirmarSaida) return;
    setConfirmarSaida(true);
  }

  return (
    <>
      <Modal
        aberto={aberto}
        fechar={pedirFechar}
        titulo="Obrigado por te juntares a esta causa!"
        eyebrow="Patrocínio recebido"
        larguraMax="34rem"
        fecharAoClicarFora={false}
      >
        <div className="mt-2 space-y-5">
          <p className="text-[0.9375rem] leading-relaxed text-creme/75">
            Recebemos o teu patrocínio de{" "}
            <strong className="font-medium text-creme">
              {nivelTitulo} · {nivel}€
            </strong>{" "}
            por {nomeMetodoSponsor(metodo)}. A Vitória confirma o pagamento
            assim que receber o comprovativo — e a tua marca entra nos
            materiais do evento.
          </p>

          {/* RECAP dos dados de depósito — MESMOS dados da fonte única
              lib/pagamento que os ecrãs de pagamento mostram. O Copiar fica
              à mão porque é aqui que a pessoa paga na verdade. */}
          <div>
            <p className="eyebrow text-creme/45">
              Dados de {metodo === "mbway" ? "MB Way" : "transferência"}
            </p>
            <div className="mt-3 space-y-3">
              {metodo === "mbway" ? (
                <>
                  <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                    <p className="eyebrow text-creme/60">Número</p>
                    <p className="mt-1 flex items-center justify-between gap-3 font-medium tabular-nums tracking-wide text-creme/85">
                      <span>{MBWAY_NUMERO}</span>
                      <BotaoCopiar texto={MBWAY_NUMERO_COPIAR} />
                    </p>
                  </div>
                  <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                    <p className="eyebrow text-creme/60">Titular</p>
                    <p className="mt-1 font-medium text-creme/85">{TRANSFERENCIA.beneficiario}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                    <p className="eyebrow text-creme/60">IBAN</p>
                    <p className="mt-1 flex items-center justify-between gap-3 font-medium tabular-nums tracking-wide text-creme/85">
                      <span>{formatarIban(TRANSFERENCIA.iban)}</span>
                      <BotaoCopiar texto={TRANSFERENCIA.iban} />
                    </p>
                  </div>
                  <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                    <p className="eyebrow text-creme/60">Beneficiário</p>
                    <p className="mt-1 font-medium text-creme/85">{TRANSFERENCIA.beneficiario}</p>
                  </div>
                  <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                    <p className="eyebrow text-creme/60">BIC / SWIFT</p>
                    <p className="mt-1 font-medium tabular-nums text-creme/85">{TRANSFERENCIA.bic}</p>
                  </div>
                </>
              )}
              <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                <p className="eyebrow text-creme/60">Valor</p>
                <p className="mt-1 flex items-center justify-between gap-3 font-medium tabular-nums text-creme/85">
                  <span>{valorText}</span>
                  <BotaoCopiar texto={String(nivel)} />
                </p>
              </div>
              {metodo === "transferencia" && (
                <div className="rounded-sm border border-creme/20 bg-creme/5 px-4 py-3">
                  <p className="eyebrow text-creme/60">Referência</p>
                  <p className="mt-1 font-medium text-creme/85">{referencia}</p>
                </div>
              )}
            </div>
          </div>

          {/* O comprovativo vai à Vitória por WhatsApp (como na inscrição) —
              a mensagem pré-preenchida já diz quem é, o nível e o método. */}
          <div className="rounded-sm border border-dourado-claro/30 bg-dourado-claro/[0.07] p-4">
            <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-creme/85">
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-dourado-claro" aria-hidden />
              <span>
                Envia o comprovativo do pagamento pelo WhatsApp — a Vitória
                confirma à receção.
              </span>
            </p>
          </div>

          {/* CTA WhatsApp — verde #25d366, o mesmo token das inscrições */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-whatsapp px-7 py-4 text-[0.9375rem] font-medium text-white transition-all duration-300 hover:brightness-105"
          >
            <WhatsAppIcon className="h-4.5 w-4.5" />
            Enviar comprovativo por WhatsApp
          </a>

          <p className="text-center text-[0.75rem] leading-relaxed text-creme/45">
            A mensagem abre pré-preenchida com os teus dados de patrocínio —
            basta anexar o comprovativo.
          </p>
        </div>
      </Modal>

      {/* Fecho do recap por cima — mesmo padrão do resto do fluxo. */}
      <ConfirmacaoSaidaModal
        aberto={aberto && confirmarSaida}
        manter={() => setConfirmarSaida(false)}
        sair={() => {
          setConfirmarSaida(false);
          fechar();
        }}
        texto="Este ecrã tem os dados de pagamento — se saíres agora, perde o resumo. Podes reabrir o fluxo sempre que precisares."
      />
    </>
  );
}