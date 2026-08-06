"use client";

import { ExternalLink } from "lucide-react";
import Modal from "./Modal";
import LocalImage from "./LocalImage";

type Props = {
  aberto: boolean;
  fechar: () => void;
};

function googleMapsUrl(morada: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(morada)}`;
}

const pontos = [
  {
    nome: "Box RM",
    morada: "Rua da Quinta do Feital 44, 4700-154 Braga",
    logo: "/alem-do-espelho-2026/causa/ponto-boxrm.webp",
  },
  {
    nome: "100 Culpa",
    morada: "Rua da Alegria 145, 4000-042 Porto",
    logo: "/alem-do-espelho-2026/causa/ponto-100culpa.webp",
  },
  {
    nome: "New Flower Studio",
    morada: "R. Cândido de Oliveira 119, 4715-213 Braga",
    logo: "/alem-do-espelho-2026/causa/ponto-newflower.webp",
  },
  {
    nome: "Yeshua Care Center",
    morada: "R. Cruz de Pedra 94 Lj.47, 4700-213 Braga",
    logo: "/alem-do-espelho-2026/causa/ponto-yeshua.webp",
  },
  {
    nome: "Cadidja Araujo",
    morada: "R. Dom António Bento Martins Júnior 31, 4710-422 Braga",
    logo: "/alem-do-espelho-2026/causa/ponto-cadidja.webp",
  },
] as const;

/**
 * Modal com os 5 pontos de recolha do kit de solidariedade.
 * Reutiliza Modal.tsx (tom claro, focus trap, ESC, scroll-lock).
 * Cada linha: logotipo normalizado (48 px) + nome + morada + link Google Maps.
 * Separador hairline em causa-pessego a 40 %.
 */
export default function ModalPontosRecolha({ aberto, fechar }: Props) {
  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      tom="claro"
      eyebrow="Pontos de Recolha"
      titulo="Onde deixar o teu kit"
      larguraMax="36rem"
    >
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-carvao/65">
        Escolhe o ponto de recolha mais perto de ti. Leva o kit no dia do
        evento ou entrega diretamente num dos pontos parceiros.
      </p>

      <ul className="mt-6 divide-y divide-causa-pessego/40">
        {pontos.map((ponto) => (
          <li key={ponto.nome} className="py-4 first:pt-0 last:pb-0">
            <a
              href={googleMapsUrl(ponto.morada)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-causa-tinta"
            >
              {/* Logotipo normalizado em quadrado creme 48 px */}
              <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-causa-pessego/20 p-1.5">
                <LocalImage
                  src={ponto.logo}
                  alt={`Logotipo ${ponto.nome}`}
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium text-causa-tinta transition-colors group-hover:text-causa-verde-fundo">
                  {ponto.nome}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-[0.875rem] leading-snug text-causa-tinta-suave/70">
                  {ponto.morada}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
