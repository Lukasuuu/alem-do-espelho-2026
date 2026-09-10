/**
 * Mock de QA do fluxo de patrocínio — APENAS desenvolvimento (Lucas, 11/08).
 *
 * As RPCs de patrocínio vivas em produção (registar_sponsor /
 * definir_metodo_sponsor — fluxo simples de 3 passos) respondem sem token de
 * posse e sem comprovativo na app. Para validar o fluxo em localhost SEM
 * tocar na base de dados real, define NEXT_PUBLIC_SPONSOR_MOCK="1" no
 * .env.local — as rotas /api/sponsor respondem sucesso sem tocar na Supabase.
 *
 * ⛔ NUNCA ativo em produção: no build/deploy NODE_ENV === "production" →
 * SPONSOR_MOCK_ATIVO é false e o branch é eliminado pelo bundler.
 */
export const SPONSOR_MOCK_ATIVO =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SPONSOR_MOCK === "1";
