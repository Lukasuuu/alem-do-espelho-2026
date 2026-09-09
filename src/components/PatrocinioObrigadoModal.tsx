"use client";

import { CheckCircle2, ExternalLink, PartyPopper, Sparkles, UploadCloud } from "lucide-react";
import { googleMapsUrl, pontosRecolha } from "@/lib/pontos-recolha";
import Modal from "./Modal";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Nome completo — o 1.º nome entra no título. */
  nome: string;
  /** Empresa/marca, opcional — entra na linha do patrocínio. */
  empresa?: string | null;
  /** Nome do nível escolhido (Apoio / Parceiro / Parceiro Principal). */
  nivelLabel: string;
  /** false = upload falhou / foi pelo WhatsApp → linha de fallback. */
  comprovativoOk: boolean;
};

/**
 * Modal OBRIGADO do patrocínio — ecrã DEDICADO do fluxo (Bloco J r2), NÃO
 * reutiliza a ParabensModal: os textos são os definidos no prompt de revisão
 * e o ecrã fala de comprovativo/envio à Vitória, não de inscrição.
 *
 * 🔴 INVARIANTE: este ecrã NUNCA afirma que o pagamento está confirmado — não
 * há webhook; quem valida é a Vitória. O que se diz é "recebemos /
 * registámos". O upload recebe o comprovativo (validação pendente); o
 * WhatsApp apenas regista a intenção de envio.
 */
export default function PatrocinioObrigadoModal({
  aberto,
  fechar,
  nome,
  empresa,
  nivelLabel,
  comprovativoOk,
}: Props) {
  const primeiroNome = nome.trim().split(/\s+/)[0] || "";

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo={`Obrigado${primeiroNome ? `, ${primeiroNome}` : ""}!`}
      eyebrow="Patrocínio registado"
      larguraMax="34rem"
    >
      <div className="mt-2 space-y-5">
        {/* Texto obrigatório do prompt — sem variações, sem "confirmado". */}
        <div className="rounded-sm border border-dourado-claro/30 bg-dourado-claro/[0.07] p-4">
          <p className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-creme/90">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-dourado-claro" aria-hidden />
            <span>
              Obrigado por fazer parte desse evento e dessa obra de arrecadação que
              vai ajudar muitas famílias em Angola.
            </span>
          </p>
        </div>

        <p className="text-[0.9375rem] leading-relaxed text-creme/75">
          Registo do patrocínio:{" "}
          <strong className="font-medium text-creme">
            {empresa && empresa.trim() !== "" ? `${empresa.trim()} · ` : ""}
            {nivelLabel}
          </strong>
          . Segue a mensagem de acordo com o envio do comprovativo.
        </p>

        {/* Upload OK → comprovativo recebido, validação PENDENTE (nunca
            "confirmado" — quem valida é a Vitória). */}
        {comprovativoOk ? (
          <div className="rounded-sm border border-[#8bd4a0]/30 bg-[#8bd4a0]/[0.08] p-4">
            <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-creme/85">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8bd4a0]" aria-hidden />
              <span>
                Recebemos o teu comprovativo e a equipa irá validar o pagamento.
              </span>
            </p>
          </div>
        ) : (
          /* Handoff WhatsApp registado (ou upload falhou) → a Vitória recebe
             o comprovativo na conversa. */
          <div className="rounded-sm border border-dourado-claro/30 bg-dourado-claro/[0.07] p-4">
            <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-creme/85">
              <UploadCloud className="mt-0.5 h-5 w-5 shrink-0 text-dourado-claro" aria-hidden />
              <span>
                Registámos que enviarás o comprovativo à Vitória pelo WhatsApp.
              </span>
            </p>
          </div>
        )}

        {/* Locais de entrega do kit — fonte única lib/pontos-recolha.ts
            (mesmos dados da modal de pontos e da ParabensModal da inscrição). */}
        <div>
          <p className="text-[0.9375rem] font-medium text-creme">
            Locais onde podes entregar o kit de higiene pessoal
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

        <button
          onClick={fechar}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(186,121,132,0.7)]"
        >
          <PartyPopper className="h-4 w-4" aria-hidden />
          Concluir
        </button>
      </div>
    </Modal>
  );
}