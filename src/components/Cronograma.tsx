import { Calendar, Clock, MapPin } from "lucide-react";
import { horarioEvento, site } from "@/lib/site";

/**
 * G.1 — Bloco de cronograma (Dia · Local · Horário), logo abaixo do Hero.
 *
 * Padrão visual: fundo bg-musgo contínuo com o Hero (sem emenda), cartão
 * .vidro (glass já usada sobre fundo escuro), eyebrow + .display — mesmos
 * tokens da paleta AdE, zero cor nova. Três colunas em ≥sm que empilham
 * em telemóvel (com divisórias horizontais em vez das verticais).
 *
 * Os valores vêm SEMPRE de lib/site.ts (fonte única): data.extenso,
 * local.nome/cidade e o horário derivado por horarioEvento() dos ISO
 * data.iso/data.fim (09:30–18:00, início atualizado pelo Lucas a 09/09/2026).
 *
 * Só leitura — sem interacção. id="o-evento" é a âncora da Navegação
 * do footer (existe só nesta página, pelo que o footer do evento a usa
 * e as outras páginas recebem a sua lista de navegação por prop).
 */
export default function Cronograma() {
  const itens = [
    {
      icon: Calendar,
      rotulo: "Dia",
      valor: site.data.extenso,
      sub: site.edicao,
    },
    {
      icon: MapPin,
      rotulo: "Local",
      valor: site.local.nome,
      sub: `${site.local.cidade}, ${site.local.pais}`,
    },
    {
      icon: Clock,
      rotulo: "Horário",
      valor: horarioEvento(),
      sub: "Dia completo",
    },
  ] as const;

  return (
    <section
      id="o-evento"
      aria-label="Dia, local e horário do evento"
      className="relative bg-musgo pb-16 sm:pb-20"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="vidro rounded-sm px-6 py-8 sm:px-10 sm:py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-0">
            {itens.map((item, i) => (
              <div
                key={item.rotulo}
                className={`flex flex-col items-center text-center sm:px-6 ${
                  i > 0 ? "border-t border-creme/12 pt-8 sm:border-l sm:border-t-0 sm:pt-0" : ""
                }`}
              >
                {/* Medalhão do ícone — padrão circular usado no Header/CausaSocial */}
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-creme/8 ring-1 ring-creme/20">
                  <item.icon className="h-4.5 w-4.5 text-dourado-claro" aria-hidden />
                </span>
                <span className="eyebrow mt-3 text-creme/45">{item.rotulo}</span>
                <span className="display mt-1.5 text-[1.375rem] leading-snug text-creme sm:text-[1.5rem]">
                  {item.valor}
                </span>
                <span className="mt-1 text-[0.8125rem] leading-relaxed text-creme/50">
                  {item.sub}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}