/**
 * Override de fase para testes locais/preview — NUNCA em produção.
 * NEXT_PUBLIC_FASE_OVERRIDE=lista      → força a lista gratuita a aberta
 * NEXT_PUBLIC_FASE_OVERRIDE=inscricao  → força a inscrição paga a aberta
 * Sem variável (ou valor inválido)      → decisão pelo relógio do servidor.
 *
 * Vive num módulo SEM imports de servidor (next/headers) de propósito: tanto
 * lib/cutover.ts (server-first, APIs, gate de rota) como os componentes client
 * (decisão de UI, ex.: qual modal abre) precisam de ler o MESMO override.
 * Se crescer para mais lógica, extrair para aqui sem partir o client bundle.
 */
export function faseForcada(): "lista" | "inscricao" | null {
  const f = process.env.NEXT_PUBLIC_FASE_OVERRIDE;
  return f === "lista" || f === "inscricao" ? f : null;
}
