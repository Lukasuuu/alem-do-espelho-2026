/**
 * Gate do bloco de patrocínio — interruptor de emergência (FIX-2, incidente 10/08).
 *
 * SPONSORS_ATIVOS=true (decisão Lucas, 11/08): os patrocinadores voltam a
 * renderizar, gated por faseInscricaoAtiva (server, src/lib/cutover.ts). Esta
 * flag é o interruptor MANUAL: se o fluxo de patrocínio rebentar em produção,
 * voltar a false num commit esconde a secção inteira (título, vitrine de logos,
 * "Quero Patrocinar") — nada é removido, só não renderiza.
 *
 * ⚠️ PRESSUPOSTO OBRIGATÓRIO: true só é seguro com as RPCs de patrocínio
 * APLICADAS na Supabase de produção (tabela `sponsors` + `registar_sponsor` /
 * `definir_nivel_sponsor` / `definir_metodo_sponsor`, alinhadas com o contrato
 * de src/app/api/sponsor/*). Ordem de deploy inegociável (Lucas, 11/08):
 *  1. flip para true                    → ESTE estado (desbloqueia QA localhost)
 *  2. QA completa em localhost
 *  3. aplicar 0004 + 0005 à Supabase produção
 *  4. validar as RPCs (pg_get_functiondef, RLS ativo, SECURITY DEFINER,
 *     search_path='', EXECUTE concedido ao anon)
 *  5. só então deploy
 * Deploy antes das migrations = formulário de patrocínio a rebentar (75–200€) —
 * o mesmo bug das inscrições de 10/08, com valores maiores.
 */
export const SPONSORS_ATIVOS = true;
