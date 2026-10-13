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
export function vaquinhaIniciada(inicioIso: string, agora: Date = new Date()): boolean {
  const f = vaquinhaForcada();
  if (f) return f === "aberta";
  return agora.getTime() >= new Date(inicioIso).getTime();
}
