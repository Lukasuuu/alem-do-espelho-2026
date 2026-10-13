"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { formatarEuros, type TotaisComEstado } from "@/lib/vaquinha";
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
};

const ROTULO_ESTADO: Record<string, string> = {
  iniciada: "iniciada",
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

/**
 * Painel do voluntário (V5) — desenhado para TELEMÓVEL, em pé, com uma mão: é
 * alguém a conferir a app do MB Way e o extrato enquanto o evento acontece.
 *
 * A fila são as `declarada` (por confirmar) primeiro; as já decididas ficam
 * abaixo, para poder corrigir um engano. Confirmar é um toque; anular pede
 * confirmação e aceita uma nota, porque anular apaga o valor da barra.
 *
 * A lista atualiza-se a cada 15 s (e para com o separador escondido) para o
 * voluntário ver chegar as doações dos outros; a barra em cima é a mesma conta
 * que o público vê, mas mostrada por partes.
 */
export default function PainelVoluntario({ doacoesIniciais, totaisIniciais }: Props) {
  const router = useRouter();
  const [doacoes, setDoacoes] = useState<DoacaoAdmin[] | null>(doacoesIniciais);
  const [totais, setTotais] = useState<TotaisComEstado | null>(totaisIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<DoacaoAdmin | null>(null);
  const [nota, setNota] = useState("");

  const buscar = useCallback(async () => {
    try {
      const r = await fetch("/api/vaquinha/voluntario/lista", { cache: "no-store" });
      if (r.status === 401) {
        router.refresh(); // sessão caiu: volta ao login
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
      // Refresca já a lista, sem esperar pelos 15 s.
      void buscar();
    } catch {
      setErro("Sem ligação ao servidor. A decisão não foi registada.");
    } finally {
      setOcupado(null);
      setAAnular(null);
      setNota("");
    }
  }

  const porConfirmar = doacoes?.filter((d) => d.estado === "declarada") ?? [];
  const recentes = doacoes?.filter((d) => d.estado !== "declarada") ?? [];
  /**
   * `null` = a leitura FALHOU, não «não há nada». Distinguir as duas é o mesmo
   * cuidado que o cartão tem com o «0 €»: dizer «não há nada por confirmar»
   * quando não conseguimos ler faria o voluntário fechar a página a pensar que a
   * fila está vazia, com doações à espera.
   */
  const semLeitura = doacoes === null;

  const cartao = (d: DoacaoAdmin) => (
    <li
      key={d.id}
      className="rounded-xl border border-areia bg-white px-4 py-3.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[1.25rem] font-semibold tracking-[0.08em] text-vinho">
          {d.referencia}
        </span>
        <span className="display text-[1.5rem] font-semibold leading-none">
          {formatarEuros(d.valor_cents)}
        </span>
      </div>
      <p className="mt-1 text-[0.8125rem] text-tinta-suave">
        {ROTULO_METODO[d.metodo] ?? d.metodo} · declarada {quando(d.declarada_em ?? d.criada_em)}
        {d.estado !== "declarada" && ` · ${ROTULO_ESTADO[d.estado] ?? d.estado}`}
        {d.nota && ` · ${d.nota}`}
      </p>

      {d.estado === "declarada" ? (
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
          className="mt-3 h-10 rounded-full border border-areia px-4 text-[0.8125rem] font-medium text-tinta-suave disabled:opacity-60"
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

        {totais && (
          <div className="mt-4 rounded-xl border border-areia bg-white px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="display text-[1.5rem] font-semibold leading-none">
                {formatarEuros(totais.confirmado_cents)}
              </span>
              <span className="text-[0.8125rem] text-tinta-suave">
                meta {formatarEuros(totais.meta_cents ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-[0.8125rem] text-tinta-suave">
              confirmado · {formatarEuros(totais.a_confirmar_cents)} por confirmar
            </p>
          </div>
        )}

        {(erro || semLeitura) && (
          <div className="mt-3 rounded-xl border border-vinho/25 bg-white px-4 py-3">
            <p role="alert" className="text-[0.875rem] font-medium text-vinho-profundo">
              {erro ?? "Não conseguimos ler as contribuições agora."}
            </p>
            <p className="mt-1 text-[0.8125rem] text-tinta-suave">
              Isto NÃO quer dizer que a fila está vazia — só que não a conseguimos ler.
            </p>
            <button
              type="button"
              onClick={() => void buscar()}
              className="mt-3 h-10 rounded-full border border-vinho/30 px-4 text-[0.8125rem] font-medium text-vinho"
            >
              Tentar outra vez
            </button>
          </div>
        )}

        {!semLeitura && (
        <h2 className="eyebrow mt-6 text-tinta-suave">
          Por confirmar {porConfirmar.length > 0 && `(${porConfirmar.length})`}
        </h2>
        )}
        {semLeitura ? null : porConfirmar.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-tinta-suave">
            Não há nada por confirmar neste momento.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">{porConfirmar.map(cartao)}</ul>
        )}

        {recentes.length > 0 && (
          <>
            <h2 className="eyebrow mt-7 text-tinta-suave">Já decididas</h2>
            <ul className="mt-2 flex flex-col gap-2.5">{recentes.map(cartao)}</ul>
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
