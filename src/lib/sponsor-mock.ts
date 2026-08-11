/**
 * Mock de QA do fluxo de patrocínio — APENAS desenvolvimento (Lucas, 11/08).
 *
 * As RPCs de patrocínio (registar_sponsor / definir_nivel_sponsor /
 * definir_metodo_sponsor) ainda não estão aplicadas na Supabase; até lá o
 * formulário de patrocínio rebenta no passo A (502). Para validar o ecrã de
 * PARABÉNS do patrocínio em localhost:3001 SEM a base de dados, define
 * NEXT_PUBLIC_SPONSOR_MOCK="1" no .env.local — as 3 rotas /api/sponsor*
 * respondem sucesso sem tocar na Supabase, e a cadeia A→B→C→parabéns corre.
 *
 * ⛔ NUNCA ativo em produção: no build/deploy NODE_ENV === "production" →
 * SPONSOR_MOCK_ATIVO é false e o branch é eliminado pelo bundler.
 * ⛔ REMOVER assim que as migrations 0004/0005 estiverem aplicadas e o fluxo
 * real verificado (task #29/#64).
 */
export const SPONSOR_MOCK_ATIVO =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SPONSOR_MOCK === "1";
