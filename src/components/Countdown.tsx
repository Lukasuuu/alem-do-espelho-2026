"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  /** Data ISO para a qual se conta, por omissão o fecho da lista de espera. */
  alvo?: string;
  /** Rótulo acima dos números, por omissão "A lista fecha em". */
  rotulo?: string;
  /** Linha de apoio por baixo dos números (por omissão, o fecho da lista). */
  suporte?: string;
  /** Mensagem quando o alvo já passou (por omissão, o fecho da lista). */
  mensagemEncerrado?: string;
  /** Callback que dispara uma vez quando a contagem chega a 0. */
  onEncerrado?: () => void;

  /* ── Modo externo (síncrono) ──
     Quando todos estes valores são fornecidos, o componente NÃO cria o seu
     próprio timer: espelha o estado partilhado (ex.: useCampaignCountdown).
     Dois visores, uma fonte de verdade. */
  dias?: number | null;
  horas?: number | null;
  minutos?: number | null;
  segundos?: number | null;
  encerrado?: boolean;

  /** A <640px apresenta os 4 blocos em grelha 2×2. Para cards estreitos
      (ex.: Causa Social) onde 4 colunas lado a lado não cabem com presença. */
  gradeMobile?: boolean;
};

export default function Countdown({
  tom = "claro",
  alvo,
  rotulo = "A lista fecha em",
  suporte,
  mensagemEncerrado = "As inscrições na lista fecharam.",
  onEncerrado,
  dias,
  horas,
  minutos,
  segundos,
  encerrado,
  gradeMobile = false,
}: Props) {
  const alvoMs = useMemo(
    () => new Date(alvo ?? site.listaEspera.fecha).getTime(),
    [alvo]
  );

  // Data do alvo em português, para o aria-label do contador (o padrão é o
  // fecho da lista; quando se conta para a data do evento, o rótulo acompanha).
  const dataAlvoExtenso = useMemo(() => {
    if (!alvo) return site.listaEspera.fechaExtenso;
    return new Intl.DateTimeFormat("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(alvo));
  }, [alvo]);

  // Começa nulo: a decisão aberto/encerrado acontece só após o mount,
  // para que servidor e cliente rendam o mesmo HTML (sem warnings de hidratação).
  const [agora, setAgora] = useState<number | null>(null);

  // Modo externo: quando o consumidor fornece todos os valores, o timer
  // interno é desativado e o componente apenas espelha o estado partilhado.
  const modoExterno =
    dias !== undefined &&
    horas !== undefined &&
    minutos !== undefined &&
    segundos !== undefined &&
    encerrado !== undefined;

  useEffect(() => {
    if (modoExterno) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [modoExterno]);

  const jaEncerrado = modoExterno
    ? (encerrado ?? false)
    : agora !== null && agora >= alvoMs;

  // Dispara o callback uma única vez quando a contagem chega a 0.
  const disparado = useRef(false);
  useEffect(() => {
    if (jaEncerrado && !disparado.current) {
      disparado.current = true;
      onEncerrado?.();
    }
  }, [jaEncerrado, onEncerrado]);

  const tempo = modoExterno
    ? dias !== null && horas !== null && minutos !== null && segundos !== null
      ? { dias, horas, minutos, segundos }
      : null
    : agora !== null
      ? calcular(alvoMs - agora)
      : null;

  const unidades = [
    { valor: tempo?.dias, rotulo: "dias" },
    { valor: tempo?.horas, rotulo: "horas" },
    { valor: tempo?.minutos, rotulo: "min" },
    { valor: tempo?.segundos, rotulo: "seg" },
  ];

  const corValor = tom === "claro" ? "text-creme" : "text-vinho";
  const corRotulo = tom === "claro" ? "text-creme/55" : "text-musgo/80";
  const corFio = tom === "claro" ? "bg-creme/20" : "bg-dourado/30";
  // Divisores do modo centrado (gradeMobile): mesma cor do fio, expressa como
  // borda (divide-x). As classes completas são literais aqui para o Tailwind
  // as gerar — nunca montar `sm:` + variável no className.
  const corDivisao = tom === "claro" ? "sm:divide-creme/20" : "sm:divide-dourado/30";
  const corLabel = tom === "claro" ? "text-creme/35" : "text-musgo";
  const corSuporte = tom === "claro" ? "text-creme/50" : "text-carvao/75";

  // Alvo ultrapassado: nada de contagem, só o aviso.
  if (jaEncerrado) {
    return (
      <p className={`text-[0.9375rem] font-medium leading-relaxed ${corValor}`}>
        {mensagemEncerrado}
      </p>
    );
  }

  return (
    <div className={gradeMobile ? "text-center" : undefined}>
      <span className={`eyebrow ${corLabel}`}>{rotulo}</span>
      <div
        className={
          gradeMobile
            ? `mt-3 grid w-full grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:gap-x-0 sm:gap-y-0 sm:divide-x ${corDivisao}`
            : "mt-3 flex items-stretch gap-4 sm:gap-6"
        }
        role="timer"
        aria-label={`${rotulo} ${dataAlvoExtenso}`}
      >
        {unidades.map((unidade, i) => (
          <div
            key={unidade.rotulo}
            className={
              gradeMobile
                ? "flex flex-col items-center justify-center px-1 sm:px-2"
                : "flex items-stretch justify-center gap-4 sm:gap-6"
            }
          >
            <div className="flex flex-col items-center">
              <span
                className={`display text-[clamp(1.75rem,5.5vw,2.5rem)] tabular-nums ${corValor}`}
                suppressHydrationWarning
              >
                {unidade.valor === undefined ? "––" : String(unidade.valor).padStart(2, "0")}
              </span>
              <span className={`eyebrow mt-1.5 text-[clamp(0.5rem,1.8vw,0.68rem)] ${corRotulo}`}>
                {unidade.rotulo}
              </span>
            </div>
            {!gradeMobile && i < unidades.length - 1 && (
              <div
                className={`w-px self-stretch ${corFio}`}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
      <p className={`mt-3 text-[0.8125rem] leading-relaxed ${corSuporte}`}>
        {suporte ?? `Inscrições abertas até ${site.listaEspera.fechaExtenso}.`}
      </p>
    </div>
  );
}
