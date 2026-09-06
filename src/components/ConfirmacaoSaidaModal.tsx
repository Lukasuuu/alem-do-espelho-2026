"use client";

import Modal from "./Modal";

type Props = {
  aberto: boolean;
  /** Fecha só esta confirmação — a pessoa continua o pagamento. */
  manter: () => void;
  /** Fecho real da modal pai (a reserva fica pendente de pagamento). */
  sair: () => void;
  /** Linha de contexto. Por omissão, a copy do fluxo de pagamento. */
  texto?: string;
};

/**
 * Confirmação ao fechar a meio do pagamento (briefing 05/09, Bloco A): o X e o
 * ESC já não fecham a modal diretamente quando há progresso a perder — mostram
 * esta confirmação em vez de fechar. O fecho por clique fora e o ESC desta
 * própria confirmação são "cancelar saída" (a via sempre segura).
 */
export default function ConfirmacaoSaidaModal({ aberto, manter, sair, texto }: Props) {
  return (
    <Modal
      aberto={aberto}
      fechar={manter}
      titulo="Queres mesmo sair?"
      tom="claro"
      larguraMax="26rem"
      focoInicial="button[data-foco]"
    >
      <p className="text-[0.9375rem] leading-relaxed">
        {texto ?? "A tua reserva fica pendente de pagamento."}
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="button"
          data-foco
          onClick={manter}
          className="flex min-h-11 w-full items-center justify-center rounded-full bg-rosa px-6 py-3 text-[0.9375rem] font-medium text-creme transition-colors duration-300 hover:bg-rosa-escuro"
        >
          Continuar o pagamento
        </button>
        <button
          type="button"
          onClick={sair}
          className="flex min-h-11 w-full items-center justify-center rounded-full border border-vinho/25 px-6 py-3 text-[0.9375rem] font-medium text-vinho/80 transition-colors duration-300 hover:border-vinho/50 hover:text-vinho"
        >
          Sair
        </button>
      </div>
    </Modal>
  );
}