"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";

type Tempo = { dias: number; horas: number; minutos: number; segundos: number };

function calcular(alvo: number): Tempo {
  const restante = Math.max(0, alvo - Date.now());
  const segundosTotais = Math.floor(restante / 1000);
  return {
    dias: Math.floor(segundosTotais / 86400),
    horas: Math.floor((segundosTotais % 86400) / 3600),
    minutos: Math.floor((segundosTotais % 3600) / 60),
    segundos: segundosTotais % 60,
  };
}

const ALVO = new Date(site.data.iso).getTime();

export default function Countdown({ tom = "claro" }: { tom?: "claro" | "escuro" }) {
  // Começa nulo para que servidor e cliente rendam o mesmo HTML.
  const [tempo, setTempo] = useState<Tempo | null>(null);

  useEffect(() => {
    setTempo(calcular(ALVO));
    const id = setInterval(() => setTempo(calcular(ALVO)), 1000);
    return () => clearInterval(id);
  }, []);

  const unidades = [
    { valor: tempo?.dias, rotulo: "dias" },
    { valor: tempo?.horas, rotulo: "horas" },
    { valor: tempo?.minutos, rotulo: "min" },
    { valor: tempo?.segundos, rotulo: "seg" },
  ];

  const corValor = tom === "claro" ? "text-creme" : "text-vinho";
  const corRotulo = tom === "claro" ? "text-creme/55" : "text-sage";
  const corFio = tom === "claro" ? "bg-creme/20" : "bg-vinho/15";

  return (
    <div
      className="flex items-stretch gap-4 sm:gap-6"
      role="timer"
      aria-label={`Contagem decrescente para ${site.data.extenso}`}
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
  );
}
