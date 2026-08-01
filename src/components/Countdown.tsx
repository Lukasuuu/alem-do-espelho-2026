"use client";

import { useEffect, useMemo, useState } from "react";
import { site } from "@/lib/site";

type Tempo = { dias: number; horas: number; minutos: number; segundos: number };

function calcular(restanteMs: number): Tempo {
  const restante = Math.max(0, restanteMs);
  const segundosTotais = Math.floor(restante / 1000);
  return {
    dias: Math.floor(segundosTotais / 86400),
    horas: Math.floor((segundosTotais % 86400) / 3600),
    minutos: Math.floor((segundosTotais % 3600) / 60),
    segundos: segundosTotais % 60,
  };
}

type Props = {
  tom?: "claro" | "escuro";
  /** Data ISO para a qual se conta — por omissão, o fecho da lista de espera. */
  alvo?: string;
  /** Rótulo acima dos números — por omissão, "A lista fecha em". */
  rotulo?: string;
};

export default function Countdown({
  tom = "claro",
  alvo,
  rotulo = "A lista fecha em",
}: Props) {
  const alvoMs = useMemo(
    () => new Date(alvo ?? site.listaEspera.fecha).getTime(),
    [alvo]
  );

  // Começa nulo: a decisão aberto/encerrado acontece só após o mount,
  // para que servidor e cliente rendam o mesmo HTML (sem warnings de hidratação).
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const encerrado = agora !== null && agora >= alvoMs;
  const tempo = agora !== null ? calcular(alvoMs - agora) : null;

  const unidades = [
    { valor: tempo?.dias, rotulo: "dias" },
    { valor: tempo?.horas, rotulo: "horas" },
    { valor: tempo?.minutos, rotulo: "min" },
    { valor: tempo?.segundos, rotulo: "seg" },
  ];

  const corValor = tom === "claro" ? "text-creme" : "text-vinho";
  const corRotulo = tom === "claro" ? "text-creme/55" : "text-sage";
  const corFio = tom === "claro" ? "bg-creme/20" : "bg-vinho/15";
  const corLabel = tom === "claro" ? "text-creme/35" : "text-sage/70";
  const corSuporte = tom === "claro" ? "text-creme/50" : "text-carvao/55";

  // Lista fechada: nada de contagem, só o aviso.
  if (encerrado) {
    return (
      <p className={`text-[0.9375rem] font-medium leading-relaxed ${corValor}`}>
        As inscrições na lista fecharam.
      </p>
    );
  }

  return (
    <div>
      <span className={`eyebrow ${corLabel}`}>{rotulo}</span>
      <div
        className="mt-3 flex items-stretch gap-4 sm:gap-6"
        role="timer"
        aria-label={`${rotulo} ${site.listaEspera.fechaExtenso}`}
      >
        {unidades.map((unidade, i) => (
          <div key={unidade.rotulo} className="flex items-stretch gap-4 sm:gap-6">
            <div className="flex flex-col items-center">
              <span
                className={`display text-3xl sm:text-4xl tabular-nums ${corValor}`}
                suppressHydrationWarning
              >
                {unidade.valor === undefined ? "––" : String(unidade.valor).padStart(2, "0")}
              </span>
              <span className={`eyebrow mt-1.5 text-[0.5625rem] sm:text-[0.625rem] ${corRotulo}`}>
                {unidade.rotulo}
              </span>
            </div>
            {i < unidades.length - 1 && <div className={`w-px self-stretch ${corFio}`} aria-hidden />}
          </div>
        ))}
      </div>
      <p className={`mt-3 text-[0.8125rem] leading-relaxed ${corSuporte}`}>
        Inscrições abertas até {site.listaEspera.fechaExtenso}.
      </p>
    </div>
  );
}
