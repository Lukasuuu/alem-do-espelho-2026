"use client";

import Modal from "./Modal";
import InscricaoForm from "./InscricaoForm";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Chamado com id, nome e email da inscrição, para o pai abrir a modal de pagamento. */
  onSucesso: (inscricaoId: string, nome: string, email: string) => void;
};

/**
 * Modal de inscrição paga: o formulário num painel da página, com o mesmo
 * padrão de acessibilidade do restante (trap de foco, ESC, clique fora).
 */
export default function InscricaoModal({ aberto, fechar, onSucesso }: Props) {
  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo="Reserva o teu lugar"
      tom="vinho"
      focoInicial="input:not([disabled]), select:not([disabled])"
    >
      <div className="mt-7">
        <InscricaoForm onSucesso={onSucesso} />
      </div>
    </Modal>
  );
}
