"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import {
  LIMITE_CONFIANCA_PADRAO_CENTS,
  formatarEuros,
  type TotaisComEstado,
} from "@/lib/vaquinha";
import { dataCurta, formatarMoeda } from "@/lib/cambio";
import type { DoacaoAdmin } from "@/lib/vaquinha-servidor";

type Props = {
  /** Lista do primeiro render, lida no servidor. null = não foi possível ler. */
  doacoesIniciais: DoacaoAdmin[] | null;
  totaisIniciais: TotaisComEstado | null;
};

const INTERVALO_MS = 15_000;

const ROTULO_METODO: Record<string, string> = {
  mbway: "MB Way",
  transferencia: "Transferência",
  wise_gbp: "Wise (GBP)",
  pix_brl: "Pix (BRL)",
};

const ROTULO_ESTADO: Record<string, string> = {
  iniciada: "sem declaração",
  declarada: "por confirmar",
  confirmada: "confirmada",
  anulada: "anulada",
};

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  }).format(new Date(iso));
}

/** 5.6339 → "5,6339". O câmbio é informativo: 4 casas chegam para reconciliar. */
function formatarTaxa(taxa: number | string): string {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 4 }).format(Number(taxa));
}

/**
 * Painel da Vitória (V5) — desenhado para TELEMÓVEL, em pé, com uma mão: é
 * alguém a conferir a app do MB Way e o extrato, sozinha, durante um mês.
 *
 * Três blocos, pela ordem em que ela precisa deles:
 *  1. «Procurar referência» — para quem pagou e não carregou no botão (a linha
 *     ficou 'iniciada') ou para uma referência lida em voz alta. Procura em
 *     qualquer estado e com qualquer idade (0014c).
 *  2. As declaradas ACIMA do limite de confiança — são as únicas que a barra
 *     ainda não conta; é esta a fila de trabalho. Confirmar é um toque.
 *  3. As recentes — as declarações que já contam (abaixo do limite) e as já
 *     decididas, para poder corrigir um engano.
 *
 * Anular apaga valor da barra, por isso pede confirmação e aceita uma nota.
 *
 * A lista atualiza-se a cada 15 s (e para com o separador escondido). Se a
 * LEITURA falhar, o painel diz que falhou — nunca «não há nada», que faria a
 * Vitória fechar a página com doações à espera.
 */
export default function PainelVoluntario({ doacoesIniciais, totaisIniciais }: Props) {
  const router = useRouter();
  const [doacoes, setDoacoes] = useState<DoacaoAdmin[] | null>(doacoesIniciais);
  const [totais, setTotais] = useState<TotaisComEstado | null>(totaisIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<DoacaoAdmin | null>(null);
  const [nota, setNota] = useState("");

  // ── Procura por referência ───────────────────────────────────────────────
  const [termo, setTermo] = useState("");
  /** Termo da última procura que correu bem — é o que se repete após decidir. */
  const [termoProcurado, setTermoProcurado] = useState("");
  const [resultado, setResultado] = useState<DoacaoAdmin[] | null>(null);
  const [aProcurar, setAProcurar] = useState(false);
  const [erroProcura, setErroProcura] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    try {
      const r = await fetch("/api/vaquinha/voluntario/lista", { cache: "no-store" });
      if (r.status === 401) {
        router.refresh(); // sessão caiu: volta ao link
        return;
      }
      const dados = (await r.json()) as {
        ok: boolean;
        doacoes?: DoacaoAdmin[];
        totais?: TotaisComEstado;
        mensagem?: string;
      };
      if (!r.ok || !dados.ok) {
        setErro(dados.mensagem ?? "Não conseguimos ler as contribuições agora.");
        return;
      }
      setErro(null);
      setDoacoes(dados.doacoes ?? []);
      setTotais(dados.totais ?? null);
    } catch {
      setErro("Sem ligação. Vamos tentar outra vez.");
    }
  }, [router]);

  const procurar = useCallback(
    async (t: string) => {
      setAProcurar(true);
      setErroProcura(null);
      try {
        const r = await fetch("/api/vaquinha/voluntario/procurar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referencia: t }),
        });
        if (r.status === 401) {
          router.refresh();
          return;
        }
        const dados = (await r.json()) as {
          ok: boolean;
          doacoes?: DoacaoAdmin[];
          totais?: TotaisComEstado;
          mensagem?: string;
        };
        if (!r.ok || !dados.ok) {
          setErroProcura(dados.mensagem ?? "Não conseguimos procurar agora. Tenta novamente.");
          return;
        }
        setResultado(dados.doacoes ?? []);
        setTermoProcurado(t.trim());
        if (dados.totais) setTotais(dados.totais);
      } catch {
        setErroProcura("Sem ligação ao servidor. Vamos tentar outra vez.");
      } finally {
        setAProcurar(false);
      }
    },
    [router]
  );

  useEffect(() => {
    let id: number | undefined;
    const arrancar = () => {
      if (id !== undefined) return;
      void buscar();
      id = window.setInterval(buscar, INTERVALO_MS);
    };
    const parar = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };
    const visivel = () => (document.visibilityState === "visible" ? arrancar() : parar());
    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", visivel);
    return () => {
      parar();
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [buscar]);

  async function decidir(doacao: DoacaoAdmin, estado: "confirmada" | "anulada", pNota?: string) {
    setOcupado(doacao.id);
    setErro(null);
    try {
      const r = await fetch("/api/vaquinha/voluntario/decidir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doacao.id, estado, nota: pNota ?? null }),
      });
      const dados = (await r.json()) as {
        ok: boolean;
        estado?: string;
        totais?: TotaisComEstado;
        mensagem?: string;
      };
      if (!r.ok || !dados.ok) {
        setErro(dados.mensagem ?? "Não conseguimos registar a decisão.");
        return;
      }
      setTotais(dados.totais ?? totais);
      // Refresca já a lista, sem esperar pelos 15 s — e o resultado da procura,
      // que é onde ela costuma estar a decidir.
      void buscar();
      if (resultado !== null && termoProcurado) void procurar(termoProcurado);
    } catch {
      setErro("Sem ligação ao servidor. A decisão não foi registada.");
    } finally {
      setOcupado(null);
      setAAnular(null);
      setNota("");
    }
  }

  /** O limite vem da RPC (mudável por SQL); a constante é o valor de recurso. */
  const limite = totais?.limite_confianca_cents ?? LIMITE_CONFIANCA_PADRAO_CENTS;
  /** As que a barra AINDA não conta: declaradas acima do limite. É a fila. */
  const aEspera = doacoes?.filter((d) => d.estado === "declarada" && d.valor_cents > limite) ?? [];
  const recentes =
    doacoes?.filter((d) => !(d.estado === "declarada" && d.valor_cents > limite)) ?? [];
  /**
   * `null` = a leitura FALHOU, não «não há nada». Distinguir as duas é o mesmo
   * cuidado que o cartão tem com o «0 €»: dizer «não há nada por confirmar»
   * quando não conseguimos ler faria a Vitória fechar a página a pensar que a
   * fila está vazia, com doações à espera.
   */
  const semLeitura = doacoes === null;

  const cartao = (d: DoacaoAdmin) => (
    <li key={d.id} className="rounded-xl border border-areia bg-white px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[1.25rem] font-semibold tracking-[0.08em] text-vinho">
          {d.referencia}
        </span>
        <span className="display text-[1.5rem] font-semibold leading-none">
          {formatarEuros(d.valor_cents)}
        </span>
      </div>
      <p className="mt-1 text-[0.8125rem] text-tinta-suave">
        {ROTULO_METODO[d.metodo] ?? d.metodo} · {quando(d.declarada_em ?? d.criada_em)}
        {d.estado !== "declarada" && ` · ${ROTULO_ESTADO[d.estado] ?? d.estado}`}
        {d.nota && ` · ${d.nota}`}
      </p>

      {/* Reconciliação: nos canais estrangeiros, o valor que a pessoa ENVIOU e o
          câmbio que viu. Em euros não aparece nada — a linha de cima já é o valor
          exato, e repeti-lo só faria ruído. */}
      {(d.moeda === "GBP" || d.moeda === "BRL") && d.valor_moeda_cents != null && (
        <p className="mt-1.5 rounded-[8px] bg-blush/30 px-2.5 py-1.5 text-[0.8125rem]">
          <span className="font-semibold text-vinho">
            Enviou {formatarMoeda(d.valor_moeda_cents, d.moeda)}
          </span>
          {d.cambio_usado != null && (
            <span className="text-tinta-suave">
              {" "}
              · câmbio {formatarTaxa(d.cambio_usado)}
              {d.cambio_data ? ` de ${dataCurta(d.cambio_data)}` : " (recurso)"}
            </span>
          )}
        </p>
      )}

      {d.estado === "declarada" || d.estado === "iniciada" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => decidir(d, "confirmada")}
            disabled={ocupado === d.id}
            className="h-11 flex-1 rounded-full bg-vinho text-[0.9375rem] font-semibold text-creme-neon disabled:opacity-60"
          >
            {ocupado === d.id ? "…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAAnular(d);
              setNota("");
            }}
            disabled={ocupado === d.id}
            className="h-11 flex-1 rounded-full border border-vinho/30 text-[0.9375rem] font-medium text-vinho disabled:opacity-60"
          >
            Anular
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => decidir(d, d.estado === "confirmada" ? "anulada" : "confirmada")}
          disabled={ocupado === d.id}
          className="mt-3 h-11 rounded-full border border-areia px-4 text-[0.8125rem] font-medium text-tinta-suave disabled:opacity-60"
        >
          {d.estado === "confirmada" ? "Anular esta" : "Confirmar esta"}
        </button>
      )}
    </li>
  );

  return (
    <main className="min-h-dvh bg-creme px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-tinta-suave">Vaquinha · ONG Atos</p>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/vaquinha/voluntario/sair", { method: "POST" }).catch(() => {});
              router.refresh();
            }}
            className="text-[0.8125rem] font-medium text-tinta-suave underline underline-offset-2"
          >
            Sair
          </button>
        </div>
        <h1 className="display mt-2 text-[2rem] leading-[1.05] text-vinho">Confirmar contribuições</h1>

        {/* ── 1. Procurar referência (no topo, como o Lucas pediu) ── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!termo.trim()) {
              setErroProcura("Escreve a referência que queres procurar.");
              return;
            }
            void procurar(termo);
          }}
          className="mt-4"
        >
          <label htmlFor="procurar" className="eyebrow block text-tinta-suave">
            Procurar referência
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="procurar"
              type="search"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="ATOS-83P2"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-xl border border-areia bg-white px-3.5 text-base tracking-[0.06em] text-vinho placeholder:text-vinho/35"
            />
            <button
              type="submit"
              disabled={aProcurar}
              className="h-12 flex-none rounded-full bg-vinho px-5 text-[0.9375rem] font-semibold text-creme-neon disabled:opacity-60"
            >
              {aProcurar ? "…" : "Procurar"}
            </button>
          </div>
          <p className="mt-1.5 text-[0.75rem] leading-[1.4] text-tinta-suave">
            Serve para quem pagou e não carregou no botão, ou para uma referência lida em voz alta.
            Procura em qualquer estado.
          </p>

          {erroProcura && (
            <p role="alert" className="mt-2 text-[0.875rem] font-medium text-vinho-profundo">
              {erroProcura}
            </p>
          )}

          {resultado !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow text-tinta-suave">
                  {resultado.length === 0
                    ? "Nada encontrado"
                    : `${resultado.length} ${resultado.length === 1 ? "resultado" : "resultados"}`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResultado(null);
                    setTermoProcurado("");
                    setTermo("");
                  }}
                  className="text-[0.8125rem] font-medium text-tinta-suave underline underline-offset-2"
                >
                  Limpar
                </button>
              </div>
              {resultado.length === 0 ? (
                <p className="mt-2 text-[0.9375rem] text-tinta-suave">
                  Não há nenhuma contribuição com <strong>{termoProcurado}</strong>. Confere a
                  referência — faz parte do descritivo da transferência ou da mensagem do MB Way.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2.5">{resultado.map(cartao)}</ul>
              )}
            </div>
          )}
        </form>

        {/* ── Totais: o arrecadado é o que o público vê; por partes ── */}
        {totais && (
          <div className="mt-5 rounded-xl border border-areia bg-white px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="display text-[1.5rem] font-semibold leading-none">
                {formatarEuros(totais.arrecadado_cents ?? totais.confirmado_cents)}
              </span>
              <span className="text-[0.8125rem] text-tinta-suave">
                meta {formatarEuros(totais.meta_cents ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-[0.8125rem] text-tinta-suave">
              {formatarEuros(totais.confirmado_cents)} confirmado ·{" "}
              {formatarEuros(totais.a_confirmar_cents)} por confirmar
            </p>
            <p className="mt-1 text-[0.75rem] leading-[1.4] text-tinta-suave">
              O arrecadado inclui as declarações até {formatarEuros(limite)}. Acima disso só entra
              quando confirmares.
            </p>
          </div>
        )}

        {(erro || semLeitura) && (
          <div className="mt-3 rounded-xl border border-vinho/25 bg-white px-4 py-3">
            <p role="alert" className="text-[0.875rem] font-medium text-vinho-profundo">
              {erro ?? "Não conseguimos ler as contribuições agora."}
            </p>
            <p className="mt-1 text-[0.8125rem] text-tinta-suave">
              Isto NÃO quer dizer que a fila está vazia — só que não a conseguimos ler. A procura
              por referência, em cima, continua a funcionar.
            </p>
            <button
              type="button"
              onClick={() => void buscar()}
              className="mt-3 h-11 rounded-full border border-vinho/30 px-4 text-[0.8125rem] font-medium text-vinho"
            >
              Tentar outra vez
            </button>
          </div>
        )}

        {/* ── 2. A fila: só o que a barra ainda não conta ── */}
        {!semLeitura && (
          <>
            <h2 className="eyebrow mt-6 text-tinta-suave">
              À espera de confirmação (acima de {formatarEuros(limite)})
              {aEspera.length > 0 && ` (${aEspera.length})`}
            </h2>
            {aEspera.length === 0 ? (
              <p className="mt-2 text-[0.9375rem] text-tinta-suave">
                Não há nada acima de {formatarEuros(limite)} à espera de confirmação.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2.5">{aEspera.map(cartao)}</ul>
            )}

            {/* ── 3. O resto: o que já conta e o que já foi decidido ── */}
            {recentes.length > 0 && (
              <>
                <h2 className="eyebrow mt-7 text-tinta-suave">Recentes</h2>
                <ul className="mt-2 flex flex-col gap-2.5">{recentes.map(cartao)}</ul>
              </>
            )}
          </>
        )}
      </div>

      {/* Anular apaga valor da barra: confirma-se, e a nota é opcional. */}
      <Modal
        aberto={aAnular !== null}
        fechar={() => setAAnular(null)}
        titulo="Anular esta contribuição?"
        tom="claro"
        larguraMax="26rem"
        focoInicial="button[data-foco]"
      >
        <p className="text-[0.9375rem] leading-relaxed">
          {aAnular && (
            <>
              A contribuição <strong>{aAnular.referencia}</strong> de{" "}
              <strong>{formatarEuros(aAnular.valor_cents)}</strong> sai da barra. Usa isto quando o
              dinheiro não chegou, ou quando é um teste ou uma duplicação.
            </>
          )}
        </p>
        <label htmlFor="nota" className="eyebrow mt-5 block text-tinta-suave">
          Nota (opcional)
        </label>
        <input
          id="nota"
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ex.: não recebido, duplicado, teste"
          className="mt-2 h-12 w-full rounded-xl border border-areia bg-white px-3.5 text-base text-vinho"
        />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            data-foco
            onClick={() => aAnular && decidir(aAnular, "anulada", nota)}
            disabled={ocupado !== null}
            className="flex min-h-11 w-full items-center justify-center rounded-full bg-vinho px-6 py-3 text-[0.9375rem] font-semibold text-creme-neon disabled:opacity-60"
          >
            Anular
          </button>
          <button
            type="button"
            onClick={() => setAAnular(null)}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-vinho/25 px-6 py-3 text-[0.9375rem] font-medium text-vinho/80"
          >
            Voltar
          </button>
        </div>
      </Modal>
    </main>
  );
}
