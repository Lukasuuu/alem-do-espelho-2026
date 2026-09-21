/**
 * R15 — ligação da app à fila de emails (FASE 4).
 *
 * Regra central (R15): o browser NUNCA envia emails e NUNCA decide
 * destinatários. Estas funções correm só em rotas /api/ (server-side):
 *   • enfileirarEmail → RPC enfileirar_email com posse_token; a base lê o
 *     email do inscrito de inscricoes.email e calcula nome/referência/
 *     valor/método da linha real de pagamentos. p_dados traz SÓ os dados
 *     financeiros de src/lib/pagamento.ts (não duplicados na base).
 *   • acordarWorkerServer → caminho rápido: dispara a Edge Function logo
 *     após o enfileiramento (best-effort; o cron da FASE 5 é a garantia).
 *
 * Falha de enfileiramento NUNCA falha o pedido do utilizador — é registada
 * no console e o cron drena a fila minuto a minuto.
 */
import { MBWAY_NUMERO, MBWAY_NUMERO_COPIAR, SUMUP_URL, TRANSFERENCIA } from "@/lib/pagamento";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Dados financeiros para o email de instruções — fonte única: pagamento.ts. */
export const DADOS_FINANCEIROS = {
  iban: TRANSFERENCIA.iban,
  beneficiario: TRANSFERENCIA.beneficiario,
  bic: TRANSFERENCIA.bic,
  instituicao: TRANSFERENCIA.instituicao,
  mbway_numero: MBWAY_NUMERO,
  mbway_copiar: MBWAY_NUMERO_COPIAR,
  sumup_url: SUMUP_URL,
} as const;

type SupabaseRpc = Pick<SupabaseClient, "rpc">;

/**
 * Enfileira um email pela RPC enfileirar_email (0012). Nunca lança: falhas
 * vão ao console e o cron drena — a inscrição do utilizador não depende disto.
 */
export async function enfileirarEmail(
  supabase: SupabaseRpc,
  inscricaoId: string,
  posseToken: string,
  tipo: "instrucoes" | "org_nova_inscricao" | "comprovativo_recebido",
  dados: Record<string, string> | null = null
): Promise<void> {
  try {
    const { error } = await supabase.rpc("enfileirar_email", {
      p_inscricao_id: inscricaoId,
      p_posse_token: posseToken,
      p_tipo: tipo,
      ...(dados ? { p_dados: dados } : {}),
    });
    if (error) {
      // 'existente' (duplicado) chega aqui? Não — a RPC devolve jsonb, não erro.
      // Erro real: acesso_negado / inscricao_nao_encontrada / invalid_tipo.
      console.error(`[fila-emails] enfileirar_email (${tipo}) falhou:`, error.message);
    }
  } catch (erro) {
    console.error("[fila-emails] enfileiramento indisponível (cron apanha):", erro);
  }
}

/**
 * Server-side: acorda o worker da Edge Function para drenar já (caminho
 * rápido). O WORKER_SECRET vive nas env vars do servidor — nunca no bundle.
 * Fire-and-forget: se esta chamada não partir, o cron apanha em ≤1 min.
 */
export function acordarWorkerServer(): void {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const segredo = process.env.WORKER_SECRET;
  if (!base || !segredo) return;
  void fetch(`${base.replace(/\/$/, "")}/functions/v1/enviar-emails`, {
    method: "POST",
    headers: { "x-worker-secret": segredo, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {
    /* o cron garante a drenagem */
  });
}