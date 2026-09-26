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
 *
 * R16 — devolve o Response a montante (ou null se a chamada nem saiu: falta
 * env var ou houve erro de rede) para a rota sonda /api/emails/worker poder
 * reportar o estado; nas rotas de negócio o chamador ignora o resultado
 * (fire-and-forget — o cron da FASE 5 é a garantia). Nunca lança.
 *
 * R16 — envia TAMBÉM `Authorization: Bearer <anon>`: o gateway das Edge
 * Functions verifica JWT por omissão (verify_jwt) e rejeita com 401 ANTES de
 * o código da função correr — o x-worker-secret nem chegava a ser lido, e o
 * cron bateria no mesmo 401 de minuto a minuto. A chave anónima é pública e
 * não autentica nada aqui (mesma resolução de chave do supabase.ts); quem
 * autoriza de verdade é o x-worker-secret — se ele não bater certo, a função
 * devolve 401 com corpo `segredo_invalido` (distingue-se do 401 do gateway).
 * Funciona quer o verify_jwt fique ligado ou desligado no painel.
 */
export async function acordarWorkerServer(): Promise<Response | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const segredo = process.env.WORKER_SECRET;
  const anon =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !segredo) return null;
  try {
    return await fetch(`${base.replace(/\/$/, "")}/functions/v1/enviar-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Passa o gateway do Supabase (verify_jwt). A chave anónima é pública e
        // não autentica nada aqui — quem autoriza é o x-worker-secret abaixo.
        ...(anon ? { Authorization: `Bearer ${anon}` } : {}),
        "x-worker-secret": segredo,
      },
      body: JSON.stringify({ modo: "drenar" }),
    });
  } catch {
    return null; // o cron garante a drenagem — nunca rebentar o pedido
  }
}