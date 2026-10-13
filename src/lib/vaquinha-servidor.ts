/**
 * Leitura dos totais no SERVIDOR — só para o primeiro render do cartão.
 *
 * Porque no servidor e não no cliente: o cartão mostra um valor a dinheiro. Se
 * o primeiro render fosse a zeros e o cliente fosse buscar depois, haveria um
 * instante em que a página AFIRMA 0 € arrecadados — num cartão de causa
 * solidária isso é pior do que mostrar o esqueleto. O servidor é a autoridade
 * (mesmo padrão das fases) e o cliente só faz o polling das atualizações.
 *
 * Nunca lança: sem base (env em falta, rede, RPC indisponível) devolve null e o
 * cartão mostra o estado de carregamento, que o polling resolve em 15 s. A
 * página do evento NUNCA cai por causa da vaquinha.
 */
import { getSupabase } from "@/lib/supabase";
import { estaEncerrada, type TotaisComEstado, type TotaisVaquinha } from "@/lib/vaquinha";

export async function lerTotaisVaquinha(): Promise<TotaisComEstado | null> {
  try {
    const { data, error } = await getSupabase()
      .rpc("vaquinha_totais")
      // A página do evento NUNCA espera pela vaquinha: ao fim de 1,5 s a leitura
      // desiste e o cartão mostra o estado de carregamento, que o polling do
      // cliente resolve em 15 s. Sem isto, uma RPC lenta segurava o render da
      // landing inteira — e a landing é o que as pessoas vieram ver.
      .abortSignal(AbortSignal.timeout(1500));
    if (error) {
      console.error("[vaquinha] vaquinha_totais falhou:", error.message);
      return null;
    }
    const totais = data as TotaisVaquinha;
    // O estado de fecho decide-se AQUI, com o relógio do servidor.
    return { ...totais, encerrada: estaEncerrada(totais, new Date()) };
  } catch (erro) {
    console.error("[vaquinha] leitura dos totais indisponível:", erro);
    return null;
  }
}
