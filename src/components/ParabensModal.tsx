"use client";

import { Check, Gift, PartyPopper } from "lucide-react";
import { linkWhatsApp } from "@/lib/site";
import { KIT_ITENS, MENSAGEM_ECOBAG, SALON_WHATSAPP } from "@/lib/campanha";
import Modal from "./Modal";

type Props = {
  aberto: boolean;
  fechar: () => void;
  nome: string;
  /**
   * A ecobag bónus SÓ aparece quando is_bonus === true — valor que vem da DB
   * (estado_inscricao). Nunca calcular o bónus no frontend.
   */
  isBonus: boolean;
};

/**
 * Modal de parabéns — abre ÚNICAMENTE quando estado_inscricao reporta
 * pagamento_estado === "confirmed". Nunca a partir de proof_uploaded,
 * under_review ou payment_started. Contém: agradecimento, confirmação do
 * pagamento, causa social, kit de higiene e (se is_bonus) a ecobag.
 */
export default function ParabensModal({ aberto, fechar, nome, isBonus }: Props) {
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo="Faz parte deste dia!"
      eyebrow="Pagamento confirmado"
      larguraMax="34rem"
    >
      <div className="mt-2 space-y-5">
        <p className="text-[0.9375rem] leading-relaxed text-creme/75">
          Obrigada{primeiroNome ? `, ${primeiroNome}` : ""}. A tua inscrição está{" "}
          <strong className="font-medium text-creme">confirmada</strong> e o teu lugar
          no {`Além do Espelho 2026`} está garantido.
        </p>

        {/* Causa social */}
        <p className="text-[0.875rem] leading-relaxed text-creme/65">
          E o melhor: a tua inscrição já está a transformar vidas. Ao inscreveres-te,
          apoias a criação de{" "}
          <strong className="font-medium text-creme/85">kits de solidariedade</strong>{" "}
          (higiene feminina) para mulheres em vulnerabilidade em Angola, em parceria
          com a ONG Atos.
        </p>

        {/* Kit de higiene */}
        <div className="rounded-sm border border-creme/15 bg-creme/[0.04] p-4">
          <p className="eyebrow mb-3 text-dourado-claro/80">Cada kit inclui</p>
          <ul className="space-y-2.5">
            {KIT_ITENS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[0.875rem] text-creme/80">
                <Check className="h-4 w-4 shrink-0 text-dourado-claro" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Ecobag — só com is_bonus verdadeiro vindo da DB */}
        {isBonus && (
          <div className="rounded-sm border border-dourado-claro/30 bg-dourado-claro/[0.07] p-4">
            <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-creme/85">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-dourado-claro" aria-hidden />
              <span>
                Recebes também a <strong className="font-medium text-creme">Ecobag exclusiva</strong>{" "}
                Além do Espelho + kit de solidariedade.{" "}
                <a
                  href={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_ECOBAG)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blush underline decoration-dotted underline-offset-4 transition-colors hover:text-creme"
                >
                  Fala connosco no WhatsApp
                </a>{" "}
                para a levantares.
              </span>
            </p>
          </div>
        )}

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
