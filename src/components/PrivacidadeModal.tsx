"use client";

import Modal from "./Modal";
import { site } from "@/lib/site";

/**
 * Contexto em que a política é aberta — a modal é o documento legal que
 * sustenta o consentimento dado em cada formulário, por isso a finalidade e
 * os dados recolhidos têm de bater certo com o formulário que a abriu
 * (Lucas, 11/08): a lista de espera, a inscrição e o patrocínio recolhem
 * coisas diferentes.
 */
export type ContextoPrivacidade = "geral" | "lista" | "inscricao" | "patrocinio";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Ajusta a finalidade e os dados recolhidos ao formulário que abriu a modal. */
  contexto?: ContextoPrivacidade;
};

const porContexto: Record<ContextoPrivacidade, { dados: string; finalidade: string }> = {
  // Footer / visitante sem formulário: visão geral.
  geral: {
    dados: "Os dados que forneceres num formulário (nome, email e telemóvel) e metadados técnicos mínimos (idioma, origem do acesso).",
    finalidade:
      "Gerir a tua participação no Além do Espelho2026 — inscrição, patrocínio ou lista de espera — e comunicar contigo sobre o evento. Nada além disso.",
  },
  lista: {
    dados: "Nome, email e telemóvel, e metadados técnicos mínimos (idioma, origem do acesso).",
    finalidade: "Comunicação sobre a lista de espera e o evento. Nada além disso.",
  },
  inscricao: {
    dados: "Nome, email e telemóvel, e metadados técnicos mínimos (idioma, origem do acesso).",
    finalidade:
      "Gerir a tua inscrição no Além do Espelho2026 (lugar garantido após a confirmação do pagamento) e comunicar contigo sobre o evento. Nada além disso.",
  },
  patrocinio: {
    dados: "Nome, email, telemóvel e, se indicares, o nome da tua empresa ou marca. Metadados técnicos mínimos (idioma, origem do acesso).",
    finalidade:
      "Gerir a tua proposta de patrocínio do Além do Espelho2026 e comunicar contigo sobre a parceria. Nada além disso.",
  },
};

const RETENCAO =
  "Os dados são eliminados até 6 meses após o evento — ou mais cedo se pedires a eliminação.";

/** Modal "Política de Privacidade", curto e alinhado ao RGPD. */
export default function PrivacidadeModal({ aberto, fechar, contexto = "geral" }: Props) {
  const { dados, finalidade } = porContexto[contexto];

  const itens = [
    { rotulo: "Dados recolhidos", texto: dados },
    { rotulo: "Finalidade", texto: finalidade },
    {
      rotulo: "Base legal",
      texto: "O teu consentimento, dado ao marcar a caixa no formulário.",
    },
    { rotulo: "Retenção", texto: RETENCAO },
    {
      rotulo: "Os teus direitos",
      texto:
        "Podes pedir acesso, correção ou eliminação dos teus dados a qualquer momento através dos contactos abaixo.",
    },
  ];

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo="Política de Privacidade"
      tom="claro"
      larguraMax="32rem"
    >
      <ul className="mt-5 space-y-4">
        {itens.map((item) => (
          <li key={item.rotulo} className="text-[0.9375rem] leading-relaxed">
            <span className="eyebrow block text-rosa">{item.rotulo}</span>
            <p className="mt-1">{item.texto}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-vinho/10 pt-5 text-[0.875rem] leading-relaxed">
        <p className="text-carvao/60">
          Para exercer os teus direitos, contacta{" "}
          <a
            href={`mailto:${site.contacto.email}`}
            className="break-all text-vinho underline decoration-rosa/40 underline-offset-2 hover:decoration-rosa"
          >
            {site.contacto.email}
          </a>
          .
        </p>
      </div>

      <button
        onClick={fechar}
        className="mt-8 w-full rounded-full bg-vinho px-8 py-3.5 text-sm font-medium text-creme transition-colors duration-300 hover:bg-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        Fechar
      </button>
    </Modal>
  );
}
