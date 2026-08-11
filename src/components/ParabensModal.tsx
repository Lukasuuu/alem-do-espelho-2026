"use client";

import { MessageCircle, PartyPopper } from "lucide-react";
import { SALON_WHATSAPP } from "@/lib/campanha";
import Modal from "./Modal";
import { WhatsAppIcon } from "./icons";

type PropsBase = {
  aberto: boolean;
  fechar: () => void;
  /** Link wa.me completo com a mensagem pré-preenchida (decidido pelo pai). */
  ctaWhatsApp: string;
};

type Props =
  | (PropsBase & {
      /** Fluxo de inscrição (40€): comprovativo + email no momento do Parabéns. */
      contexto: "inscricao";
      /** false = o upload falhou → linha de fallback (enviar pelo WhatsApp). */
      comprovativoOk: boolean;
    })
  | (PropsBase & {
      /** Fluxo de patrocínio: sem comprovativo e sem email (por agora). */
      contexto: "patrocinio";
      /** Nome do nível escolhido (Apoio / Parceiro / Parceiro Principal). */
      nivelLabel: string;
    });

/**
 * Modal de PARABÉNS — o ÚNICO ecrã de confirmação dos dois fluxos do evento
 * (inscrição 40€ e patrocínio). Reutilizado, nunca duplicado: muda só o texto
 * e o que o dispara.
 *
 * 🔴 INVARIANTE: este ecrã NUNCA afirma que o pagamento já está confirmado.
 * Não há webhook — MB Way e transferência são verificados à mão pela Vitória;
 * tudo o que este ecrã pode dizer é "recebemos". O pai decide quando o abre e
 * que link WhatsApp usa.
 *
 *  - inscrição: abre no momento em que o upload do comprovativo responde
 *    (OK → comprovativoOk=true, ou falha → comprovativoOk=false). Se falhou,
 *    uma linha pede o envio pelo WhatsApp. O pai dispara o EmailJS
 *    (fire-and-forget) só quando comprovativoOk=true.
 *  - patrocínio: abre no clique de "Já fiz o pagamento". Sem comprovativo e
 *    sem email por agora — o ponto de extensão fica marcado em comentário.
 */
export default function ParabensModal(props: Props) {
  const { aberto, fechar, ctaWhatsApp } = props;

  // "351928400069" → "928 400 069" — derivado da fonte de verdade
  // (SALON_WHATSAPP), nunca hardcoded no ecrã.
  const numeroVisivel = SALON_WHATSAPP.replace(/^351/, "").replace(
    /(\d{3})(\d{3})(\d{3})/,
    "$1 $2 $3"
  );

  const titulo =
    props.contexto === "inscricao"
      ? "Parabéns por fazeres parte desta campanha!"
      : "Obrigado por te juntares a esta causa!";

  const eyebrow =
    props.contexto === "inscricao" ? "Inscrição recebida" : "Patrocínio recebido";

  return (
    <Modal aberto={aberto} fechar={fechar} titulo={titulo} eyebrow={eyebrow} larguraMax="34rem">
      <div className="mt-2 space-y-5">
        {props.contexto === "inscricao" ? (
          <>
            <p className="text-[0.9375rem] leading-relaxed text-creme/75">
              Recebemos a tua inscrição e o teu comprovativo. A{" "}
              <strong className="font-medium text-creme">Essence of Beauty</strong> confirma o
              pagamento e o teu lugar fica garantido.
            </p>

            {/* Upload falhou → linha de fallback: enviar pelo WhatsApp. O CTA
                verde abaixo já leva à conversa. Uma pagante nunca fica sem
                confirmação por causa de um upload. */}
            {!props.comprovativoOk && (
              <div className="rounded-sm border border-dourado-claro/30 bg-dourado-claro/[0.07] p-4">
                <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-creme/85">
                  <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-dourado-claro" aria-hidden />
                  <span>
                    Não conseguimos receber o teu comprovativo aqui. Envia-o pelo WhatsApp{" "}
                    <strong className="font-medium text-creme">{numeroVisivel}</strong> e
                    confirmamos o teu pagamento.
                  </span>
                </p>
              </div>
            )}

            {/* Kit de higiene — texto exato do ecrã (spec Lucas, 11/08) */}
            <div className="rounded-sm border border-creme/15 bg-creme/[0.04] p-4">
              <p className="text-[0.875rem] leading-relaxed text-creme/80">
                No dia traz o teu kit de higiene — 1 sabonete, 1 escova de dentes, 1 pasta de
                dentes e 1 absorvente. Segue para Angola.
              </p>
            </div>
          </>
        ) : (
          <p className="text-[0.9375rem] leading-relaxed text-creme/75">
            Recebemos o teu patrocínio de{" "}
            <strong className="font-medium text-creme">{props.nivelLabel}</strong>. Assim que a
            Essence of Beauty confirmar o teu pagamento, a tua marca entra nos materiais do
            evento.
          </p>
        )}

        {/* CTA WhatsApp — o caminho humano está sempre à vista */}
        <a
          href={ctaWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#4fce5d] px-7 py-4 text-[0.9375rem] font-medium text-carvao transition-all duration-300 hover:brightness-105"
        >
          <WhatsAppIcon className="h-4.5 w-4.5" />
          WhatsApp {numeroVisivel}
        </a>

        <button
          onClick={fechar}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(186,121,132,0.7)]"
        >
          <PartyPopper className="h-4 w-4" aria-hidden />
          Concluir
        </button>

        {/* ── PONTO DE EXTENSÃO EMAILJS (patrocínio) ───────────────────────
            Sem email por agora (Lucas, 11/08). Quando a Vitória definir o
            template, disparar aqui enviarEmailNotificacao(...) com os dados do
            patrocínio — mesmo padrão do fluxo de inscrição: fire-and-forget,
            try/catch isolado e guard contra duplo envio por id. Nada a mudar
            neste ecrã. */}
      </div>
    </Modal>
  );
}
