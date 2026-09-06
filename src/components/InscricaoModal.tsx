"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import InscricaoForm from "./InscricaoForm";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Chamado com id, nome, email e token de posse da inscrição, para o pai abrir a modal de pagamento. */
  onSucesso: (inscricaoId: string, nome: string, email: string, posseToken: string) => void;
};

/**
 * Modal de inscrição paga: o formulário num painel da página, com o mesmo
 * padrão de acessibilidade do restante (trap de foco, ESC, clique fora).
 * Briefing 05/09 (Bloco A): o clique fora não fecha e, com o formulário já
 * preenchido, o X e o ESC pedem confirmação em vez de descartar dados.
 */
export default function InscricaoModal({ aberto, fechar, onSucesso }: Props) {
  const [sujo, setSujo] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  // Cada abertura começa limpa (o formulário desmonta com a modal, mas o
  // estado daqui fica — repor para não confirmar saída com o form vazio).
  useEffect(() => {
    if (aberto) {
      setSujo(false);
      setConfirmarSaida(false);
    }
  }, [aberto]);

  function pedirFechar() {
    // Confirmação aberta → o ESC do fundo não faz nada: quem reage é a
    // confirmação (o ESC aí é "cancelar saída").
    if (confirmarSaida) return;
    if (sujo) {
      setConfirmarSaida(true);
      return;
    }
    fechar();
  }

  return (
    <>
      <Modal
        aberto={aberto}
        fechar={pedirFechar}
        titulo="Reserva o teu lugar"
        tom="vinho"
        focoInicial="input:not([disabled]), select:not([disabled])"
        fecharAoClicarFora={false}
      >
        <div className="mt-7">
          <InscricaoForm onSucesso={onSucesso} onSujoChange={setSujo} />
        </div>
      </Modal>
      <ConfirmacaoSaidaModal
        aberto={aberto && confirmarSaida}
        manter={() => setConfirmarSaida(false)}
        sair={() => {
          setConfirmarSaida(false);
          fechar();
        }}
        texto="Os dados da inscrição ainda não foram guardados e perdem-se ao sair."
      />
    </>
  );
}