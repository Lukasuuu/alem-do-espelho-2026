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
import {
  MENSAGENS_VAQUINHA,
  erroDaVaquinha,
  estaEncerrada,
  type TotaisComEstado,
  type TotaisVaquinha,
} from "@/lib/vaquinha";

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

/* ── V5 — as RPCs de admin (0014), chamadas só daqui ─────────────────────────
   A chave admin vive numa env server-only da Vercel e NUNCA chega ao browser:
   estas funções correm em rotas /api ou em componentes de servidor. O .trim() é
   obrigatório — a chave veio de uma env var e um espaço acidental no fim mudaria
   o sha256 que a base compara, em silêncio. */

function chaveAdmin(): string | null {
  const k = process.env.VAQUINHA_ADMIN_CHAVE?.trim();
  if (!k) {
    console.error("[vaquinha] VAQUINHA_ADMIN_CHAVE ausente — a página do voluntário não funciona");
    return null;
  }
  return k;
}

export type DoacaoAdmin = {
  id: string;
  referencia: string;
  valor_cents: number;
  metodo: string;
  estado: string;
  criada_em: string;
  declarada_em: string | null;
  decidida_em: string | null;
  nota: string | null;
};

export type ListaAdmin = { doacoes: DoacaoAdmin[]; totais: TotaisComEstado };

/** Lista para o voluntário: as `declarada` primeiro, depois as recentes. */
export async function lerDoacoesAdmin(limite = 50): Promise<ListaAdmin | null> {
  const chave = chaveAdmin();
  if (!chave) return null;
  try {
    const { data, error } = await getSupabase()
      .rpc("admin_listar_doacoes", { p_chave: chave, p_limite: limite })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) {
      console.error("[vaquinha] admin_listar_doacoes falhou:", error.message);
      return null;
    }
    const r = data as { ok: boolean; doacoes: DoacaoAdmin[]; totais: TotaisVaquinha };
    return {
      doacoes: r.doacoes ?? [],
      totais: { ...r.totais, encerrada: estaEncerrada(r.totais, new Date()) },
    };
  } catch (erro) {
    console.error("[vaquinha] lista do voluntário indisponível:", erro);
    return null;
  }
}

/**
 * Procura por referência (0014c) — QUALQUER estado, QUALQUER idade.
 *
 * É o caminho para os dois casos que a fila não apanha: quem pagou e não
 * carregou no botão (a linha ficou 'iniciada') e uma referência lida em voz alta
 * ou escrita à mão no descritivo. A normalização (maiúsculas, sem espaços nem
 * hífenes) é da RPC — aqui só se garante que vai algo com que procurar.
 *
 * Devolve null quando não há chave ou a leitura falha (a rota responde 502); a
 * lista vazia é uma resposta legítima e distinta disso.
 */
export async function procurarDoacaoAdmin(referencia: string): Promise<ListaAdmin | null> {
  const chave = chaveAdmin();
  if (!chave) return null;
  try {
    const { data, error } = await getSupabase()
      .rpc("admin_procurar_doacao", { p_chave: chave, p_referencia: referencia })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) {
      console.error("[vaquinha] admin_procurar_doacao falhou:", error.message);
      return null;
    }
    const r = data as { ok: boolean; doacoes: DoacaoAdmin[]; totais: TotaisVaquinha };
    return {
      doacoes: r.doacoes ?? [],
      totais: { ...r.totais, encerrada: estaEncerrada(r.totais, new Date()) },
    };
  } catch (erro) {
    console.error("[vaquinha] procura por referência indisponível:", erro);
    return null;
  }
}

/** Confirma ou anula. `p_nota` é opcional; a base guarda-a e carimba decidida_em. */
export async function decidirDoacaoAdmin(
  id: string,
  estado: "confirmada" | "anulada",
  nota: string | null
): Promise<{ ok: true; referencia: string; estado: string; totais: TotaisComEstado } | { ok: false; mensagem: string }> {
  const chave = chaveAdmin();
  if (!chave) return { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor };
  try {
    const { data, error } = await getSupabase()
      .rpc("admin_decidir_doacao", {
        p_chave: chave,
        p_id: id,
        p_estado: estado,
        p_nota: nota,
      })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) {
      const conhecido = erroDaVaquinha(error.message);
      console.error("[vaquinha] admin_decidir_doacao falhou:", error.message);
      return { ok: false, mensagem: conhecido?.mensagem ?? MENSAGENS_VAQUINHA.servidor };
    }
    const r = data as {
      ok: boolean;
      referencia: string;
      estado: string;
      totais: TotaisVaquinha;
    };
    return {
      ok: true,
      referencia: r.referencia,
      estado: r.estado,
      totais: { ...r.totais, encerrada: estaEncerrada(r.totais, new Date()) },
    };
  } catch (erro) {
    console.error("[vaquinha] decisão indisponível:", erro);
    return { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor };
  }
}
