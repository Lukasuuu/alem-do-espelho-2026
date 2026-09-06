"use client";

import { ExternalLink, MessageCircle, PartyPopper } from "lucide-react";
import { SALON_WHATSAPP } from "@/lib/campanha";
import { googleMapsUrl, pontosRecolha } from "@/lib/pontos-recolha";
import { site } from "@/lib/site";
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
            {/* Aviso do email no topo (Bloco D): o EventoPage dispara o
                EmailJS (fire-and-forget) exatamente neste momento — dize-lo
                ANTES de qualquer instrução. */}
            <div className="rounded-sm border border-dourado-claro/30 bg-dourado-claro/[0.07] p-4">
              <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-creme/85">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-dourado-claro" aria-hidden />
                <span>
                  Vais receber um email com o comprovativo da tua inscrição. Se não aparecer em
                  minutos, verifica o spam — e fala connosco pelo WhatsApp em baixo.
                </span>
              </p>
            </div>

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

            {/* Data do evento + onde entregar o kit (Bloco D) — moradas em
                texto legível (as de 6px da modal de pontos eram ilegíveis a
                360px). Sem logos: numa modal escura, os webp claros ganham
                halo; a morada com link Maps é o que aqui importa. Dados da
                fonte única lib/pontos-recolha.ts — idênticos aos da modal. */}
            <div>
              <p className="text-[0.9375rem] font-medium text-creme">
                {site.data.extenso} · {site.local.nome}, {site.local.cidade}
              </p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-creme/65">
                Podes deixar o teu kit a partir de já num dos pontos de recolha:
              </p>
              <ul className="mt-3 divide-y divide-creme/10">
                {pontosRecolha.map((ponto) => (
                  <li key={ponto.nome} className="py-2.5 first:pt-0 last:pb-0">
                    <a
                      href={googleMapsUrl(ponto.morada)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-creme"
                    >
                      <span className="flex items-center gap-2 text-[0.875rem] font-medium text-creme/90 transition-colors group-hover:text-creme">
                        {ponto.nome}
                        <ExternalLink
                          className="h-3.5 w-3.5 shrink-0 text-creme/40 transition-colors group-hover:text-creme/80"
                          aria-hidden
                        />
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-creme/55">
                        {ponto.morada}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
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
          className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-whatsapp px-7 py-4 text-[0.9375rem] font-medium text-white transition-all duration-300 hover:brightness-105"
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
