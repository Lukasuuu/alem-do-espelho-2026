import MarqueeLogos from "./MarqueeLogos";

/**
 * Vitrine de patrocinadores (REESCRITA) — faixa de LOGOS apenas.
 *
 * Substitui os cartões (foto + nome + título) da landing por azulejos de marca:
 * logo com o seu fundo próprio, altura fixa 72px, cantos arredondados, padding
 * uniforme, object-fit contain. Sem fotos, sem nomes, sem títulos — a identidade
 * fica toda no logo. (O Modal "Quero Patrocinar" mantém os cartões com foto.)
 *
 * O marquee é o ÚNICO caminho de render — não há fila estática nem condicional
 * de contagem mínima. O número de blocos é calculado para a pista encher sempre
 * o contentor (ver "REPETIÇÕES CALCULADAS" em MarqueeLogos): funciona com 2 ou
 * com 20 patrocinadores, sem flag. O único render estático é o pré-hidratação
 * (antes do setMontado). Não há ramo prefers-reduced-motion no marquee (decisão
 * de produto: corre em todas as máquinas; pausa por hover/focus/IO cobre WCAG
 * 2.2.2).
 */
export default function VitrinePatrocinadoras() {
  return (
    <div className="mx-auto mt-10 max-w-[42rem]">
      {/* Rótulo do grupo, centrado, entre dois traços dourados */}
      <div className="mb-7 flex items-center justify-center gap-4">
        <span className="h-px w-10 bg-dourado/40" aria-hidden />
        <span className="eyebrow text-musgo">Patrocinadores</span>
        <span className="h-px w-10 bg-dourado/40" aria-hidden />
      </div>

      <MarqueeLogos />
    </div>
  );
}
