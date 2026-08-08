"use client";

import MolduraEspelho from "./MolduraEspelho";
import LocalImage from "./LocalImage";
import { patrocinadores, type Patrocinador } from "@/lib/patrocinadores";

/** Altura fixa do tile do logo (px) — o azulejo e o nome partilham esta altura. */
const ALTURA_LOGO = 40;

const grupos = [
  { categoria: "patrocinador", label: "Patrocinadores" },
  { categoria: "apoio_tecnico", label: "Apoio técnico" },
] as const;

/**
 * Vitrine de patrocinadoras e apoio técnico.
 *
 * Renderiza dois grupos separados (Patrocinadores / Apoio técnico) — nunca
 * misturados no mesmo grid. Cada cartão: foto 4:5 em moldura compacta,
 * azulejo do logo (altura fixa, fundo próprio) ao lado do nome, título
 * profissional, história curta e citação em destaque. História e citação só
 * são renderizadas quando aprovadas (vêm vazias em lib/patrocinadores.ts).
 */
export default function VitrinePatrocinadoras() {
  return (
    <div className="mt-10 space-y-14">
      {grupos.map((grupo) => {
        const lista = patrocinadores.filter(
          (p) => p.categoria === grupo.categoria
        );
        if (lista.length === 0) return null;

        return (
          <div key={grupo.categoria}>
            {/* Rótulo do grupo, centrado, entre dois traços dourados */}
            <div className="mb-7 flex items-center justify-center gap-4">
              <span className="h-px w-10 bg-dourado/40" aria-hidden />
              <span className="eyebrow text-musgo">{grupo.label}</span>
              <span className="h-px w-10 bg-dourado/40" aria-hidden />
            </div>

            <div className="grid justify-items-center gap-8 md:grid-cols-2">
              {lista.map((patrocinador) => (
                <Cartao key={patrocinador.id} patrocinador={patrocinador} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Cartao({ patrocinador }: { patrocinador: Patrocinador }) {
  const { foto, logo, nome, titulo, historia, citacao } = patrocinador;

  // Azulejo do logo: altura fixa (ALTURA_LOGO), largura proporcional ao
  // asset — assim um logótipo horizontal (Lígia) não encolhe dentro de um
  // quadrado e mantém-se legível, sempre com o fundo baked-in combinado.
  const larguraLogo = Math.round((ALTURA_LOGO * logo.width) / logo.height);

  return (
    <div className="vidro-cartao w-full max-w-md rounded-2xl p-6 text-left sm:p-7">
      {/* Foto 4:5 em moldura compacta — centro do cartão */}
      <MolduraEspelho variante="compact" className="mx-auto w-full max-w-[14rem] p-2">
        <div
          className="relative overflow-hidden rounded-sm bg-creme-profundo"
          style={{ aspectRatio: "4 / 5" }}
        >
          <LocalImage
            src={foto.src}
            alt={foto.alt}
            width={foto.width}
            height={foto.height}
            className="h-full w-full object-cover"
          />
        </div>
      </MolduraEspelho>

      {/* Azulejo do logo + nome — mesma altura (ALTURA_LOGO) */}
      <div className="mt-5 flex h-10 items-center gap-3">
        <span
          className="flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-black/5"
          style={{ backgroundColor: logo.fundoHex, width: larguraLogo }}
        >
          <LocalImage
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            className="h-full w-full object-contain"
          />
        </span>
        <span className="display min-w-0 text-[1.125rem] leading-tight text-vinho">
          {nome}
        </span>
      </div>

      <p className="mt-1.5 text-[0.8125rem] leading-snug text-carvao/60">
        {titulo}
      </p>

      {/* História curta — só quando aprovada (placeholder vazio não renderiza) */}
      {historia && (
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-carvao/75">
          {historia}
        </p>
      )}

      {/* Citação em destaque — só quando aprovada */}
      {citacao && (
        <blockquote className="mt-4 border-l-2 border-dourado/50 pl-4 text-[0.9375rem] italic leading-relaxed text-vinho/85">
          “{citacao}”
        </blockquote>
      )}
    </div>
  );
}
