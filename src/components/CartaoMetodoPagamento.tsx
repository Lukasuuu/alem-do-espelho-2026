"use client";

import { ChevronRight } from "lucide-react";
import LocalImage from "./LocalImage";

type Props = {
  titulo: string;
  descricao: string;
  /** Caminho do ícone em /public/icone (webp 256×256). */
  iconeSrc: string;
  onClick: () => void;
  /** Enquanto o PATCH do método está em curso (evita duplo clique). */
  disabled?: boolean;
  /**
   * Quando o cartão funciona como revelador (ex.: "Código QR" no passo de
   * recuperação do Bloco C), expõe o estado do painel a leitores de ecrã.
   * Omitido → não renderiza (comportamento anterior preservado).
   */
  ariaExpanded?: boolean;
};

/**
 * Cartão clicável de método de pagamento (briefing 05/09, Bloco B.3).
 *
 * Layout responsivo decidido ANTES de codificar (nota do Lucas) e refinado
 * no feedback do Bloco B (~90% das inscrições são no telemóvel):
 *  - Telemóvel (até md): linha horizontal de 64px de altura (mínimo — cresce
 *    com o texto do sistema ampliado em vez de cortar), ícone à esquerda,
 *    título e subtítulo numa linha cada com truncate; a 360px o interior tem
 *    ~280px e 3 colunas deixariam ~85px por cartão — ilegível.
 *  - Tablet e acima (md, 768px — "tablet e acima" no briefing): 3 colunas em
 *    pé, ícone no topo do cartão.
 *
 * Tile do ícone em bg-creme-neon (token #FFF7E9): 40px no telemóvel, 48px a
 * partir de md, com o logo a ~75% da largura do tile (era pequeno de mais e
 * o "MB Way" não se lia). Alvo de toque: a linha inteira (≥64px).
 */
export default function CartaoMetodoPagamento({
  titulo,
  descricao,
  iconeSrc,
  onClick,
  disabled,
  ariaExpanded,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={ariaExpanded}
      className="group flex min-h-16 w-full flex-row items-center gap-3 rounded-sm border border-creme/20 bg-creme/5 p-3 text-left transition-all duration-300 hover:border-creme/40 hover:bg-creme/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2 focus-visible:ring-offset-vinho active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 md:min-h-0 md:flex-col md:items-start md:p-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-creme-neon md:h-12 md:w-12">
        <LocalImage
          src={iconeSrc}
          alt=""
          width={256}
          height={256}
          className="h-[30px] w-[30px] object-contain md:h-9 md:w-9"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium leading-[1.3] text-creme md:text-[1rem]">
          {titulo}
        </span>
        <span className="mt-0.5 block truncate text-[0.8125rem] leading-[1.3] text-creme/70">
          {descricao}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-creme/40 transition-transform duration-300 group-hover:translate-x-0.5 md:hidden"
      />
    </button>
  );
}