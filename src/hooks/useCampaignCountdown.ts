"use client";

import { useEffect, useState } from "react";
import { FIM_CAMPANHA_ISO } from "@/lib/campanha";

/**
 * Cronómetro da campanha — singleton de módulo.
 *
 * Um único setInterval(1000) é partilhado por todos os consumidores
 * (CausaSocial e EcobagModal), que subscrevem e recebem o mesmo valor —
 * dois visores, uma fonte de verdade.  O timer começa no primeiro
 * subscriber e pára no último.
 *
 * Hydration-safe: devolve `null` nos valores até à primeira atualização
 * após o mount (o Countdown mostra "––").
 */
const ALVO_MS = new Date(FIM_CAMPANHA_ISO).getTime();

type Tempo = { dias: number; horas: number; minutos: number; segundos: number };

function calcular(restanteMs: number): Tempo {
  const s = Math.max(0, Math.floor(restanteMs / 1000));
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  };
}

/* ── Singleton de módulo ── */
let agoraMs: number | null = null;
let timerId: ReturnType<typeof setInterval> | null = null;
let ativo = false;
const assinantes = new Set<() => void>();

function notificar() {
  agoraMs = Date.now();
  assinantes.forEach((fn) => fn());
}

function iniciar() {
  if (ativo) return;
  ativo = true;
  agoraMs = Date.now();
  notificar();
  timerId = setInterval(notificar, 1000);
}

function parar() {
  if (assinantes.size === 0 && timerId !== null) {
    clearInterval(timerId);
    timerId = null;
    ativo = false;
  }
}

function subscrever(fn: () => void) {
  assinantes.add(fn);
  iniciar();
  return () => {
    assinantes.delete(fn);
    parar();
  };
}

/* ── Hook público ── */

export type ContagemCampanha = {
  dias: number | null;
  horas: number | null;
  minutos: number | null;
  segundos: number | null;
  encerrado: boolean;
};

export function useCampaignCountdown(): ContagemCampanha {
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => subscrever(() => setAgora(agoraMs)), []);

  const encerrado = agora !== null && agora >= ALVO_MS;
  const t = agora !== null ? calcular(ALVO_MS - agora) : null;

  return {
    dias: t?.dias ?? null,
    horas: t?.horas ?? null,
    minutos: t?.minutos ?? null,
    segundos: t?.segundos ?? null,
    encerrado,
  };
}
