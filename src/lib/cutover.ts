import { headers } from "next/headers";
import { CORTE_ESPERA_ISO } from "@/lib/site";
import { FIM_CAMPANHA_ISO } from "@/lib/campanha";
import { faseForcada } from "@/lib/fase";

/**
 * DOIS marcos cronometrados — NÃO são a mesma coisa, não unificar:
 *
 * · CORTE_ESPERA_ISO (03/08, 10:00 — já ocorreu): troca a PÁGINA ativa.
 *     Antes  → a lista de espera é o destino (/alem-do-espelho-2026/lista).
 *     Depois → a versão do evento é o destino (/alem-do-espelho-2026).
 *     É o gate de ROTA, decidido pelo relógio do servidor (isDepoisDoCorte).
 *
 * · FIM_CAMPANHA_ISO (10/08, 10:00): fecho da LISTA GRATUITA e abertura da
 *     INSCRIÇÃO PAGA (40€).
 *     Antes  → api/waitlist aceita; api/inscricao recusa (410) — o fluxo
 *              ativo é a lista de espera gratuita (campanha Ecobag).
 *     Depois → api/waitlist recusa (410, lista fechada); api/inscricao abre.
 *              O fluxo de inscrição paga (Fase 3, PagamentoModal) liga-se
 *              a este marco, não ao corte de rota.
 *
 * Fuso Lisbon (Europe/Lisbon, +01:00 no verão). Fontes únicas: site.ts
 * (CORTE_ESPERA_ISO) e campanha.ts (FIM_CAMPANHA_ISO).
 */
export const CORTE_ESPERA_MS = new Date(CORTE_ESPERA_ISO).getTime();
export const FIM_CAMPANHA_MS = new Date(FIM_CAMPANHA_ISO).getTime();

/**
 * Override de fase (lista|inscricao) — implementação em lib/fase.ts, módulo
 * client-safe partilhado com os componentes de UI (EventoPage decide qual
 * modal abre respeitando o override de teste). Sem variável → relógio.
 */

/** true quando a lista gratuita é a fase ativa (override incluído). */
export function listaAtiva(agora: Date = new Date()): boolean {
  const f = faseForcada();
  if (f) return f === "lista";
  return agora.getTime() < FIM_CAMPANHA_MS;
}

/** true quando a inscrição paga é a fase ativa (override incluído). */
export function inscricaoAtiva(agora: Date = new Date()): boolean {
  const f = faseForcada();
  if (f) return f === "inscricao";
  return agora.getTime() >= FIM_CAMPANHA_MS;
}

/**
 * Força o resultado do teste sem mexer no relógio do servidor:
 * - Header "x-cutover-test: after"  → simula pós-corte (308 para o evento)
 * - Header "x-cutover-test: before" → simula pré-corte
 *
 * Nunca ativo em produção (Vercel): aí o header é ignorado, para não haver
 * forma pública de saltar o corte.
 */
async function forcaDeTeste(): Promise<boolean | null> {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (env === "production") return null;
  const h = await headers();
  const flag = h.get("x-cutover-test");
  if (flag === "after") return true;
  if (flag === "before") return false;
  return null;
}

/** true quando já passou o corte (ou quando o teste de pós-corte o força). */
export async function isDepoisDoCorte(agora: Date = new Date()): Promise<boolean> {
  const forcado = await forcaDeTeste();
  if (forcado !== null) return forcado;
  return agora.getTime() >= CORTE_ESPERA_MS;
}
