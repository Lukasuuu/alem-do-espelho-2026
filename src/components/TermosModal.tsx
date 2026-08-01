"use client";

import Modal from "./Modal";
import { site, linkWhatsApp } from "@/lib/site";

type Props = {
  aberto: boolean;
  fechar: () => void;
};

const pontos = [
  "Esta página serve para te registares na lista de espera do evento.",
  "Não existe qualquer pagamento nesta página — a inscrição é gratuita.",
  "O envio do formulário não garante participação no evento.",
  "Os dados são usados apenas para comunicação sobre o evento.",
  "Os teus dados não são vendidos nem cedidos a terceiros.",
  "Podes solicitar a remoção dos teus dados a qualquer momento.",
  "O tratamento segue o RGPD/GDPR e a legislação portuguesa aplicável.",
];

/** Modal "Termos de Serviço" — conformidade PT/RGPD. */
export default function TermosModal({ aberto, fechar }: Props) {
  return (
    <Modal aberto={aberto} fechar={fechar} titulo="Termos de Serviço" tom="claro" larguraMax="34rem">
      <ul className="mt-5 space-y-3">
        {pontos.map((ponto) => (
          <li key={ponto} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed">
            <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-rosa" />
            <span>{ponto}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7 border-t border-vinho/10 pt-5">
        <span className="eyebrow text-rosa">Contactos</span>
        <dl className="mt-3 space-y-2 text-[0.875rem] leading-relaxed">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-carvao/50">Organização</dt>
            <dd>Essence of Beauty</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-carvao/50">Email</dt>
            <dd>
              <a
                href={`mailto:${site.contacto.email}`}
                className="break-all text-vinho underline decoration-rosa/40 underline-offset-2 hover:decoration-rosa"
              >
                {site.contacto.email}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-carvao/50">WhatsApp</dt>
            <dd>
              <a
                href={linkWhatsApp(site.contacto.whatsapp.numero, "Olá Vitória! Gostaria de esclarecer uma dúvida sobre os termos de serviço.")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-vinho underline decoration-rosa/40 underline-offset-2 hover:decoration-rosa"
              >
                Vitória Gomes
              </a>
            </dd>
          </div>
        </dl>
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
