import { headers } from "next/headers";
import { CORTE_ESPERA_ISO } from "@/lib/site";

/**
 * Corte cronometrado da landing (release manager).
 *
 * Antes de CORTE_ESPERA_ISO: a lista de espera é a página ativa.
 * No corte e depois: redireciona para a versão do evento.
 *
 * A hora de corte é a MESMA do countdown (site.listaEspera.fecha), fonte
 * única em site.ts. Fuso Lisbon (Europe/Lisbon, +01:00 no verão).
 */
export const CORTE_ESPERA_MS = new Date(CORTE_ESPERA_ISO).getTime();

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
