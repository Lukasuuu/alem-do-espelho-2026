import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente usado apenas do lado do servidor.
 *
 * A tabela `waitlist_subscribers` tem RLS ativo e nenhuma policy pública:
 * ninguém lê os dados com esta chave. A escrita acontece exclusivamente
 * através da função `join_waitlist` (SECURITY DEFINER), que valida e
 * deduplica. Por isso não é preciso — nem desejável — expor a service role key.
 */
export function getSupabase(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltam variáveis de ambiente do Supabase (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY)."
    );
  }

  cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "alem-do-espelho-waitlist" } },
  });

  return cliente;
}
