"use client";

import Modal from "./Modal";
import { site } from "@/lib/site";

type Props = {
  aberto: boolean;
  fechar: () => void;
};

const itens = [
  {
    rotulo: "Dados recolhidos",
    texto: "Nome, email, telemóvel e metadados técnicos mínimos (idioma, origem do acesso).",
  },
  {
    rotulo: "Finalidade",
    texto: "Comunicação sobre a lista de espera e o evento. Nada além disso.",
  },
  {
    rotulo: "Base legal",
    texto: "O teu consentimento, dado ao marcar a caixa no formulário.",
  },
  {
    rotulo: "Retenção",
    texto: "Os dados são conservados apenas enquanto forem necessários e eliminados mediante pedido.",
  },
  {
    rotulo: "Os teus direitos",
    texto:
      "Podes pedir acesso, correção ou eliminação dos teus dados a qualquer momento através dos contactos abaixo.",
  },
];

/** Modal "Política de Privacidade", curto e alinhado ao RGPD. */
export default function PrivacidadeModal({ aberto, fechar }: Props) {
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
