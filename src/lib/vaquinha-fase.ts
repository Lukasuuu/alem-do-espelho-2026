/**
 * Fase da vaquinha — SÓ SERVIDOR (lê VERCEL_ENV, que não existe no browser).
 *
 * Override de teste PRÓPRIO e ISOLADO da vaquinha:
 *   NEXT_PUBLIC_VAQUINHA_OVERRIDE=aberta   → o cartão aparece já (testar o V3/V4
 *                                            antes de 17/10 09h30)
 *   NEXT_PUBLIC_VAQUINHA_OVERRIDE=fechada  → força o cronómetro
 *   Sem variável (ou valor inválido)       → decisão pelo relógio do servidor
 *
 * Porque NÃO se mete a vaquinha no NEXT_PUBLIC_FASE_OVERRIDE (que existe para
 * lista|inscricao): aquele valor é lido por lib/cutover.ts, cujas listaAtiva()/
 * inscricaoAtiva() tratam QUALQUER valor forçado como decisão definitiva — com
 * `vaquinha` lá dentro, as duas passavam a false e a INSCRIÇÃO PAGA fechava-se
 * (410 em /api/inscricao) a quatro dias do evento. Isolar evita isso sem tocar
 * no gate da inscrição.
 *
 * Em produção o override é ignorado (VERCEL_ENV === "production"), como o
 * header x-cutover-test: não pode haver forma pública de forçar a fase.
 *
 * NOTA DE SEGURANÇA: este módulo só pode ser importado do SERVIDOR (page.tsx).
 * Num componente de cliente o VERCEL_ENV seria undefined e o override passaria
 * a valer em produção. O nome do ficheiro segue a convenção de lib/cutover.ts
 * (módulo de fase, server-first) para o sinal ficar explícito.
 */

import { EVENTO_ISO } from "../../supabase/functions/_shared/config";
import { VAQUINHA_INICIO_ISO } from "@/lib/vaquinha";

export type FaseVaquinha = "aberta" | "fechada" | null;

/** Valor do override, ou null quando não há (ou quando é inválido/ignorado). */
export function vaquinhaForcada(): FaseVaquinha {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (env === "production") return null;
  const f = process.env.NEXT_PUBLIC_VAQUINHA_OVERRIDE;
  return f === "aberta" || f === "fechada" ? f : null;
}

/**
 * true quando o bloco do hero já deve mostrar o cartão da vaquinha (e não o
 * cronómetro). O relógio é o do SERVIDOR — o cliente não recalcula com Date.now()
 * no render, seria repetir o hydration mismatch já corrigido nas outras fases.
 *
 * Não confundir com o kill switch: vaquinha_config.ativa (vaquinha_totais),
 * que é outra coisa e é aplicado no cliente, mostrando a linha simples.
 */
export function vaquinhaIniciada(inicioIso: string, quando: Date = agora()): boolean {
  const f = vaquinhaForcada();
  if (f) return f === "aberta";
  return quando.getTime() >= new Date(inicioIso).getTime();
}

/**
 * D7 (13/10/2026) — as inscrições pagas FECHAM no mesmo instante em que a
 * vaquinha abre (17/10 09:30): o fecho é uma porta NOVA, por cima, e não se toca
 * em lib/fase.ts nem em lib/cutover.ts (inscricaoAtiva() fica como está).
 *
 * Uma só fonte, no servidor: é a mesma função que decide a vaquinha, portanto é
 * o MESMO instante e o MESMO override (NEXT_PUBLIC_VAQUINHA_OVERRIDE=aberta, só
 * no Preview, mostra a página pós-evento completa: cartão + inscrições
 * fechadas). Em produção, só o relógio.
 *
 * Amarra-se ao INÍCIO DA VAQUINHA (VAQUINHA_INICIO_ISO, que hoje é o início do
 * evento) e não ao início do evento por outra via: se um dia a vaquinha abrir a
 * outra hora, as inscrições fecham com ela — é a regra do D7.
 *
 * O que fecha: inscrições NOVAS (POST /api/inscricao) e patrocínio NOVO
 * (POST /api/sponsor). O que FICA aberto: o PATCH /api/inscricao/metodo, o
 * /api/comprovativo, o /api/inscricao/declarar-pagamento e o /api/sponsor/metodo
 * — há inscrições pendentes que ainda podem pagar e enviar comprovativo depois
 * de sábado, e patrocinadoras já inscritas que ainda têm passos a dar.
 */
export function inscricoesEncerradas(): boolean {
  return vaquinhaIniciada(VAQUINHA_INICIO_ISO);
}

/**
 * Relógio do servidor, com um deslocamento de TESTE fora de produção.
 *
 * `VAQUINHA_RELOGIO_ISO` fixa o «agora» num instante, para poder capturar os
 * estados do hero (a decorrer / depois) sem esperar pelo calendário. É ignorado
 * em produção, exatamente como o override de fase — não há forma pública de o
 * forçar lá. Sem esta variável, é o relógio real.
 */
function agora(): Date {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (env === "production") return new Date();
  const f = process.env.VAQUINHA_RELOGIO_ISO;
  if (f) {
    const d = new Date(f);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export type EstadoEvento = "antes" | "durante" | "depois";

/**
 * Em que momento do evento estamos — decide o texto do hero (o parágrafo por
 * baixo do título). D7: o «durante» abre no mesmo instante em que a vaquinha
 * abre; o «depois» no fim do evento (EVENTO_ISO.fim, 18:00).
 *
 * Decidido no SERVIDOR e descido como prop: o cliente não pode decidir isto com
 * o seu próprio relógio (seria a repetição do hydration mismatch já corrigido
 * nas outras fases).
 */
export function estadoEvento(): EstadoEvento {
  // O override de teste vale para a página INTEIRA, como o próprio Lucas
  // descreveu («o Preview com o override mostra a página pós-evento completa:
  // cartão + inscrições fechadas»). Sem isto, o override abria a vaquinha e
  // fechava as inscrições mas o texto do hero continuava a dizer «inscrições
  // abertas» — três sinais contraditórios no mesmo ecrã.
  const f = vaquinhaForcada();
  if (f === "aberta") return "durante";
  if (f === "fechada") return "antes";

  const t = agora().getTime();
  if (t >= new Date(EVENTO_ISO.fim).getTime()) return "depois";
  if (t >= new Date(VAQUINHA_INICIO_ISO).getTime()) return "durante";
  return "antes";
}
