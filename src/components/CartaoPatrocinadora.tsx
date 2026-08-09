import LocalImage from "./LocalImage";
import { type Patrocinador } from "@/lib/patrocinadores";

/** Altura da faixa do logo (px) — o logótipo e o nome partilham esta faixa. */
const ALTURA_LOGO = 72;
/** Largura da faixa do logo como fracção da coluna — um logo largo (Lígia,
 *  5.4:1) encolheria o nome para fora da coluna se fosse desenhado a 72px de
 *  altura. O cap mantém o logo ao lado do nome sem o esmagar. */
const LARGURA_LOGO_MAX = 0.55;

type Props = {
  patrocinador: Patrocinador;
  /**
   * claro = página clara (vidro-cartao, texto escuro);
   * escuro = dentro de modal de patrocínio (vidro sobre vinho, texto creme).
   */
  tom?: "claro" | "escuro";
};

/**
 * Cartão HORIZONTAL de patrocinadora (CORREÇÃO nº2):
 *
 *   desktop → [foto 4:5, ~170px] [coluna de conteúdo, ~400px]
 *   mobile  → empilhado, foto em cima
 *
 * Coluna de conteúdo, por ordem:
 *   1. faixa do logo (altura 72px, object-fit contain, ao lado do nome)
 *   2. nome
 *   3. título profissional
 *   4. história curta (2–3 linhas) — só quando aprovada
 *   5. frase em destaque — só quando aprovada
 *
 * Largura total do cartão é responsabilidade do pai (max-w no grid da página
 * ou a largura do modal) — aqui o cartão enche o que lhe derem e a coluna
 * flexa; só a foto mantém os ~170px fixos em desktop.
 */
export default function CartaoPatrocinadora({
  patrocinador,
  tom = "claro",
}: Props) {
  const claro = tom === "claro";
  const { foto, logo, nome, titulo, historia, citacao } = patrocinador;

  return (
    <article
      className={`w-full p-6 text-left sm:p-7 ${
        claro
          ? "vidro-cartao rounded-2xl"
          : "rounded-2xl border border-creme/20 bg-creme/5 backdrop-blur-sm"
      }`}
    >
      <div className="flex flex-col md:flex-row md:gap-6">
        {/* ── Foto 4:5 (~170px em desktop; centrada e mais pequena em mobile) ── */}
        <div
          className="relative mx-auto w-full max-w-[10rem] shrink-0 overflow-hidden rounded-sm bg-creme-profundo md:mx-0 md:w-[10.625rem] md:max-w-none"
          style={{ aspectRatio: "4 / 5" }}
        >
          <LocalImage
            src={foto.src}
            alt={foto.alt}
            width={foto.width}
            height={foto.height}
            className={`absolute inset-0 h-full w-full object-cover object-top ${
              claro ? "" : "opacity-90"
            }`}
          />
        </div>

        {/* ── Coluna de conteúdo ── */}
        <div className="mt-5 min-w-0 flex-1 md:mt-0">
          {/* 1. Faixa do logo (72px, contain) ao lado do nome */}
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-black/5"
              style={{
                backgroundColor: logo.fundoHex,
                maxWidth: `${LARGURA_LOGO_MAX * 100}%`,
                height: ALTURA_LOGO,
              }}
            >
              <LocalImage
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                className="max-h-full max-w-full object-contain"
              />
            </span>
            {/* 2. Nome, ao lado do logo */}
            <span
              className={`display min-w-0 text-[1.125rem] leading-tight ${
                claro ? "text-vinho" : "text-creme"
              }`}
            >
              {nome}
            </span>
          </div>

          {/* 3. Título profissional */}
          <p
            className={`mt-1.5 text-[0.8125rem] leading-snug ${
              claro ? "text-carvao/60" : "text-creme/60"
            }`}
          >
            {titulo}
          </p>

          {/* 4. História curta — só quando aprovada (placeholder vazio não renderiza) */}
          {historia && (
            <p
              className={`mt-3 text-[0.9375rem] leading-relaxed ${
                claro ? "text-carvao/75" : "text-creme/75"
              }`}
            >
              {historia}
            </p>
          )}

          {/* 5. Frase em destaque — só quando aprovada */}
          {citacao && (
            <blockquote
              className={`mt-4 border-l-2 border-dourado/50 pl-4 text-[0.9375rem] italic leading-relaxed ${
                claro ? "text-vinho/85" : "text-blush/90"
              }`}
            >
              “{citacao}”
            </blockquote>
          )}
        </div>
      </div>
    </article>
  );
}
