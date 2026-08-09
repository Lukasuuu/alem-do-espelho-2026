import AzulejoLogo from "./AzulejoLogo";
import MarqueeLogos from "./MarqueeLogos";
import { patrocinadores } from "@/lib/patrocinadores";

/**
 * Vitrine de patrocinadores (REESCRITA) — faixa de LOGOS apenas.
 *
 * Substitui os cartões (foto + nome + título) da landing por azulejos de marca:
 * logo com o seu fundo próprio, altura fixa 72px, cantos arredondados, padding
 * uniforme, object-fit contain. Sem fotos, sem nomes, sem títulos — a identidade
 * fica toda no logo. (O Modal "Quero Patrocinar" mantém os cartões com foto.)
 *
 * Animação condicional lida a partir de PATROCINADORES em lib/patrocinadores.ts:
 *   - < 5 patrocinadores → fila estática centrada, sem animação;
 *   - >= 5              → marquee CSS contínuo (MarqueeLogos).
 */
const LIMITE_MARQUEE = 5;

function FilaEstatica() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {patrocinadores.map((p) => (
        <AzulejoLogo key={p.id} logo={p.logo} flexivel />
      ))}
    </div>
  );
}

export default function VitrinePatrocinadoras() {
  return (
    <div className="mx-auto mt-10 max-w-[42rem]">
      {/* Rótulo do grupo, centrado, entre dois traços dourados */}
      <div className="mb-7 flex items-center justify-center gap-4">
        <span className="h-px w-10 bg-dourado/40" aria-hidden />
        <span className="eyebrow text-musgo">Patrocinadores</span>
        <span className="h-px w-10 bg-dourado/40" aria-hidden />
      </div>

      {patrocinadores.length >= LIMITE_MARQUEE ? <MarqueeLogos /> : <FilaEstatica />}
    </div>
  );
}
