/**
 * Gate global do bloco de patrocínio (FIX-2, incidente 10/08).
 *
 * O fluxo de patrocínio fica DESLIGADO até a FIX-1 estar aplicada e verificada
 * no Supabase (tabela `sponsors` + RPCs `registar_sponsor` / `definir_nivel_sponsor`
 * / `definir_metodo_sponsor` alinhadas com o contrato das rotas em
 * src/app/api/sponsor/*). Enquanto false, a secção "Junte-se à nossa missão"
 * não renderiza — sem vitrine de logos, sem "Quero Patrocinar", sem buracos de
 * layout. Nada é removido: os componentes continuam no código.
 *
 * ⚠️ O flip para true é um commit SEPARADO, só depois de validar o fluxo real
 * de patrocínio ponta a ponta (formulário → registar_sponsor → nivel → metodo).
 */
export const SPONSORS_ATIVOS = false;
