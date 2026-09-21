import Image from "next/image";
import { Clock } from "lucide-react";
import Reveal from "./Reveal";

/**
 * R6 — Banner oficial (faixa horizontal) + barra de horário, entre a hero
 * verde e a secção vinho "O que vais viver?".
 *
 * Desktop/tablet (≥md): a arte horizontal 2400×700 (rácio 24:7) a 100% do
 * contentor. Mobile (<md): o retrato 3:4 (1200×1600) que já existia. A troca
 * é SÓ por classes (hidden md:block / block md:hidden) — nenhum JS mede a
 * janela, que causaria salto na hidratação. Nenhuma das duas artes é cortada
 * nem deformada: width/height reais + h-auto w-full, sem fill e sem
 * object-cover; o rounded-[18px] vive no contentor com overflow-hidden.
 *
 * A data e o local vivem DENTRO da arte; o horário passa para a barra nova
 * (Clock + 09h30 – 18h00 + "Um dia para se conectar, aprender e transformar").
 * Substitui a faixa dos três chips (G.1, componente Cronograma) — e herda o
 * id="o-evento" dela, para o link EVENTO da navbar e a navegação do rodapé
 * continuarem a ter destino. Sem entrada nova na navbar: é peça visual, não
 * destino de navegação novo. O scroll-margin-top global (section[id]) aplica-se
 * sozinho.
 *
 * Fundo = o mesmo musgo da hero (sem costura); a transição verde → vinho dá-se
 * uma única vez, depois da barra. Animação de entrada: o Reveal partilhado
 * (fade + deslocamento vertical, viewport once) — a mesma das outras secções.
 */
export default function BannerOficial() {
  return (
    <section
      id="o-evento"
      aria-label="Data, local e horário do evento"
      className="bg-musgo pt-16 pb-16 md:pt-20 md:pb-20"
    >
      <div className="mx-auto w-full max-w-[1180px] px-6 md:px-8">
        <Reveal>
          {/* Faixa do banner — desktop/tablet (horizontal) + mobile (retrato) */}
          <div className="overflow-hidden rounded-[18px] border border-blush/20 shadow-[0_26px_64px_-28px_rgba(0,0,0,0.60)]">
            {/* desktop + tablet */}
            <Image
              src="/palestrantes/banner-oficial-wide.webp"
              alt="Além do Espelho 2026 — 2ª edição · 17 de outubro de 2026 · INNSIDE by Meliá, Braga"
              width={2400}
              height={700}
              quality={95}
              priority={false}
              sizes="(max-width: 767px) 1px, (max-width: 1279px) 94vw, 1132px"
              className="hidden h-auto w-full md:block"
            />
            {/* mobile */}
            <Image
              src="/palestrantes/BannerAlemdoEspelho.jpeg"
              alt="Além do Espelho 2026 — 2ª edição · 17 de outubro de 2026 · INNSIDE by Meliá, Braga"
              width={1200}
              height={1600}
              quality={95}
              sizes="(max-width: 767px) 92vw, 1px"
              className="block h-auto w-full md:hidden"
            />
          </div>

          {/* Barra de horário — ainda na faixa verde */}
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-blush/20 bg-creme/5 px-6 py-5 text-center md:mt-7 md:flex-row md:gap-6 md:px-7 md:text-left">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border border-blush/20 bg-blush/14">
              <Clock className="h-[19px] w-[19px] text-blush" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="whitespace-nowrap text-[21px] text-creme">09h30 – 18h00</span>
            <span aria-hidden className="hidden h-[30px] w-px bg-blush/20 md:block" />
            <span className="text-[12.5px] uppercase tracking-[0.2em] text-creme/70">
              Um dia para se conectar, aprender e transformar
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}