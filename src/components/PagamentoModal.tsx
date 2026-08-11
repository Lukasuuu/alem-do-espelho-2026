"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, Check, QrCode, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WhatsAppIcon, GlobeIcon, MbWayIcon, TransferenciaIcon } from "./icons";
import LocalImage from "./LocalImage";
import PaymentProofUpload from "./PaymentProofUpload";
import { travarScroll, destravarScroll } from "@/lib/scroll-lock";
import {
  MBWAY_NUMERO,
  MBWAY_NUMERO_COPIAR,
  SUMUP_URL,
  TRANSFERENCIA,
  VALOR_INSCRICAO,
  VALOR_INSCRICAO_TEXT,
  formatarIban,
  linkWhatsAppPagamento,
} from "@/lib/pagamento";
import type { MetodoPagamento } from "@/lib/validation";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Id da inscrição registada no POST /api/inscricao. */
  inscricaoId: string;
  /** Primeiro nome, para a mensagem de confirmação. */
  nome: string;
  /** Tema da modal: vinho (escuro) ou claro. */
  tom?: "vinho" | "claro";
  /**
   * Upload do comprovativo respondeu OK → o pai fecha esta modal e mostra o
   * PARABÉNS (e dispara o email "recebemos a tua inscrição" — directiva §3).
   */
  onComprovativoSucesso: () => void;
  /**
   * Upload falhou (servidor/rede/rate) OU a pessoa prefere enviar o comprovativo
   * pelo WhatsApp → o pai fecha esta modal e mostra o PARABÉNS com a linha de
   * fallback. Nunca se deixa uma pagante presa no upload.
   */
  onComprovativoFalha: () => void;
};

/**
 * Botão de copiar (navigator.clipboard) — usado nos passos MB Way e
 * transferência para colar o valor EXATO SEM espaços (nº MB Way, IBAN, "40").
 * Estados: "Copiar" → "Copiado!"; falha de clipboard (contexto não seguro)
 * → silêncio, não rebenta o fluxo.
 */
function BotaoCopiar({
  texto,
  claro,
}: {
  /** Valor exato a colar (ex.: "928400069", "IE60SUMU…", "40"). */
  texto: string;
  claro?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Limpa o timeout do "Copiado!" se a modal desmontar a meio.
  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return; // clipboard indisponível → não bloquear o pagamento por causa disto
    }
    setCopiado(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopiado(false), 2000);
  }

  const borda = copiado
    ? "border-[#4fce5d]/60"
    : claro
      ? "border-vinho/25 text-vinho/75 hover:border-vinho/45 hover:text-vinho"
      : "border-creme/30 text-creme/70 hover:border-creme/50 hover:text-creme";
  const textoEstado = copiado ? (claro ? "text-[#2f9e3a]" : "text-[#6fd97b]") : "";

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${texto}`}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition-colors duration-300 ${borda} ${textoEstado}`}
    >
      {copiado && <Check className="h-3.5 w-3.5" aria-hidden />}
      {copiado ? "Copiado!" : "Copiar"}
    </button>
  );
}

/** Elementos focáveis dentro do painel, para o foco circular (trap). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Passos da modal:
 *  - metodos: escolha da forma de pagamento (SumUp / MB Way / Transferência);
 *  - sumup: checkout SumUp (nova aba) + toggle "Mostrar código QR" do mesmo link;
 *  - mbway / transferencia: instruções + dados para copiar + "Já efetuei o pagamento";
 *  - comprovativo: upload do comprovativo (PaymentProofUpload) — o resultado
 *    (OK ou falha) fecha a modal e abre o PARABÉNS (decide o pai).
 */
type Passo = "metodos" | "sumup" | "mbway" | "transferencia" | "comprovativo";

const TITULO_MODAL = "pagamento-titulo";

/**
 * Modal de pagamento (FASE2) — padrão do projeto: portal, focus trap, ESC,
 * clique fora e scroll-lock com contador de referências. Fluxo:
 *  1. escolher método → PATCH /api/inscricao/metodo cria o pagamento (payment_started);
 *  2. instruções do método (SumUp abre o checkout; MB Way e transferência com
 *     dados para copiar; o cartão expõe ainda o QR do mesmo link SumUp, num
 *     cartão branco e sem gerador de QR);
 *  3. "Já efetuei o pagamento" → comprovativo (upload validado no servidor);
 *  4. upload OK → onComprovativoSucesso (o pai fecha e mostra o PARABÉNS, que
 *     dispara o email "recebemos a tua inscrição" — directiva §3). Upload
 *     falhou ou a pessoa prefere o WhatsApp → onComprovativoFalha (o pai mostra
 *     o PARABÉNS com fallback). SEM ecrã de espera e SEM polling: ninguém fica
 *     à mercê de uma verificação manual que pode demorar horas.
 */
export default function PagamentoModal({
  aberto,
  fechar,
  inscricaoId,
  nome,
  tom = "vinho",
  onComprovativoSucesso,
  onComprovativoFalha,
}: Props) {
  const claro = tom === "claro";
  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);
  const [montado, setMontado] = useState(false);
  const reduzido = useReducedMotion();

  const [passo, setPasso] = useState<Passo>("metodos");
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(null);
  const [pagamentoId, setPagamentoId] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [erroMetodo, setErroMetodo] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null);
  const [mostrarQr, setMostrarQr] = useState(false);

  // createPortal ao <body>, só depois de o cliente montar.
  useEffect(() => setMontado(true), []);

  // Cada abertura volta ao primeiro passo e limpa o estado da sessão anterior.
  useEffect(() => {
    if (!aberto) return;
    setPasso("metodos");
    setMetodo(null);
    setPagamentoId(null);
    setErroMetodo(null);
    setMotivoRejeicao(null);
    setMostrarQr(false);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    // Quem abriu, devolve-se o foco ao fechar.
    abridorRef.current = document.activeElement as HTMLElement;

    // Scroll-lock com contador: empilhável com outros modais.
    travarScroll();

    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fechar();
        return;
      }
      if (e.key === "Tab" && painelRef.current) {
        const lista = focaveis(painelRef.current);
        if (lista.length === 0) return;
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };

    document.addEventListener("keydown", aoTecla);

    // Foco no primeiro elemento focável do painel ao abrir.
    const t = window.setTimeout(() => {
      painelRef.current
        ?.querySelector<HTMLElement>("button:not([disabled]), a[href]")
        ?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", aoTecla);
      window.clearTimeout(t);
      destravarScroll();
      abridorRef.current?.focus();
    };
  }, [aberto, fechar]);

  function aoClicarFora(e: React.MouseEvent) {
    if (e.target === overlayRef.current) fechar();
  }

  /** Marca o método no Supabase (cria o pagamento) e segue o fluxo. */
  async function escolherMetodo(escolhido: MetodoPagamento) {
    setMarcando(true);
    setErroMetodo(null);

    try {
      const resposta = await fetch("/api/inscricao/metodo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inscricaoId, metodo: escolhido }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setErroMetodo(dados.mensagem ?? "Não conseguimos guardar o método. Tenta novamente.");
        return;
      }

      setMetodo(escolhido);
      setPagamentoId(dados.pagamento.pagamentoId);

      if (escolhido === "sumup") {
        // Checkout numa nova aba — a modal fica aberta para o comprovativo.
        window.open(SUMUP_URL, "_blank", "noopener");
        setPasso("sumup");
        return;
      }

      setPasso(escolhido === "mbway" ? "mbway" : "transferencia");
    } catch {
      setErroMetodo("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setMarcando(false);
    }
  }

  /** Voltar do comprovativo para o ecrã de instruções do método escolhido. */
  function voltarAoMetodo() {
    if (metodo === "sumup") setPasso("sumup");
    else if (metodo === "mbway") setPasso("mbway");
    else if (metodo === "transferencia") setPasso("transferencia");
    else setPasso("metodos");
  }

  /**
   * "Já fiz o pagamento" (qualquer método): o PATCH /api/inscricao/metodo já
   * respondeu OK antes de este botão ser clicável (metodo !== null ⟺ gravado).
   * O email "recebemos a tua inscrição" NÃO dispara aqui — dispara no momento
   * do PARABÉNS, depois de o upload do comprovativo responder OK (directiva §3).
   */
  function declararPagamento() {
    setPasso("comprovativo");
  }

  /** Upload OK → o pai fecha esta modal e mostra o PARABÉNS (inscrição). */
  const aoUploadSucesso = useCallback(() => {
    setMotivoRejeicao(null);
    onComprovativoSucesso();
  }, [onComprovativoSucesso]);

  /** Upload falhou → o pai mostra o PARABÉNS com o fallback do WhatsApp. */
  const aoUploadFalha = useCallback(() => {
    onComprovativoFalha();
  }, [onComprovativoFalha]);

  /* ── Ecrãs ────────────────────────────────────────────────── */

  function CartaoMetodo({
    metodo: m,
    titulo,
    descricao,
    icone,
  }: {
    metodo: MetodoPagamento;
    titulo: string;
    descricao: string;
    icone: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={() => escolherMetodo(m)}
        disabled={marcando}
        className={`group flex w-full items-center gap-4 rounded-sm border p-4 text-left transition-all duration-300 disabled:cursor-wait disabled:opacity-60 ${
          claro
            ? "border-vinho/15 bg-creme-profundo/50 hover:border-vinho/35"
            : "border-creme/20 bg-creme/5 hover:border-creme/40 hover:bg-creme/[0.08]"
        }`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
            claro
              ? "border-vinho/25 text-vinho/75"
              : "border-creme/25 text-blush"
          }`}
          aria-hidden
        >
          {icone}
        </span>
        <span className="flex-1">
          <span className="block text-[0.9375rem] font-medium text-inherit">{titulo}</span>
          <span
            className={`mt-0.5 block text-[0.8125rem] leading-relaxed ${
              claro ? "text-carvao/60" : "text-creme/60"
            }`}
          >
            {descricao}
          </span>
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 ${
            claro ? "text-vinho/50" : "text-creme/40"
          }`}
          aria-hidden
        />
      </button>
    );
  }

  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";
  const animacaoEntrada = reduzido ? false : { opacity: 0, scale: 0.95, y: 10 };

  const dialogo = (
    <AnimatePresence>
      {aberto && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay modal-overlay-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={aoClicarFora}
          role="dialog"
          aria-modal="true"
          aria-labelledby={TITULO_MODAL}
        >
          <motion.div
            ref={painelRef}
            className="modal-content"
            style={{ maxWidth: "40rem" }}
            initial={animacaoEntrada}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduzido ? undefined : { opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`relative overflow-hidden rounded-sm ${
                claro ? "bg-creme" : "bg-vinho"
              }`}
            >
              {/* Glow decorativo (só no tom escuro) */}
              {!claro && (
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-1/3 left-1/4 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(242,205,186,0.15),transparent_62%)] blur-3xl" />
                  <div className="absolute -bottom-1/3 right-0 h-[25rem] w-[25rem] rounded-full bg-[radial-gradient(circle,rgba(196,126,138,0.20),transparent_62%)] blur-3xl" />
                </div>
              )}

              {/* Botão fechar, alvo de toque ≥ 44×44 */}
              <button
                onClick={fechar}
                aria-label="Fechar"
                className={`absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                  claro
                    ? "border-vinho/20 text-vinho/50 hover:border-vinho/40 hover:text-vinho/80"
                    : "border-creme/20 text-creme/50 hover:border-creme/40 hover:text-creme/80"
                }`}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative px-6 py-12 sm:px-9">
                {/* ── PASSO: métodos ── */}
                {passo === "metodos" && (
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <span
                        className={`eyebrow ${
                          claro ? "text-vinho/60" : "text-dourado-claro/70"
                        }`}
                      >
                        Pagamento
                      </span>
                      <span className="display text-3xl text-blush">{VALOR_INSCRICAO_TEXT}</span>
                    </div>

                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-4 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      Escolha a forma de pagamento
                    </h2>

                    <p
                      className={`mt-4 max-w-md text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/70" : "text-creme/70"
                      }`}
                    >
                      A tua inscrição inclui a entrega de um kit de higiene num dos pontos de
                      recolha.
                    </p>

                    {/* O que inclui e onde entregar */}
                    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                      <figure>
                        <div
                          className={`overflow-hidden rounded-sm ${
                            claro ? "bg-creme-profundo" : "bg-creme/5"
                          }`}
                        >
                          <Image
                            src="/brand/doacoes.webp"
                            alt="Kit de higiene incluído na inscrição"
                            width={572}
                            height={857}
                            sizes="(max-width: 640px) 40vw, 160px"
                            className="h-auto w-full"
                          />
                        </div>
                        <figcaption
                          className={`mt-2 text-center text-[0.75rem] leading-snug ${
                            claro ? "text-carvao/60" : "text-creme/60"
                          }`}
                        >
                          O kit de higiene
                        </figcaption>
                      </figure>
                      <figure>
                        <div
                          className={`overflow-hidden rounded-sm ${
                            claro ? "bg-creme-profundo" : "bg-creme/5"
                          }`}
                        >
                          <Image
                            src="/brand/pontoderecolha.webp"
                            alt="Ponto de recolha onde entregar o kit de higiene"
                            width={606}
                            height={862}
                            sizes="(max-width: 640px) 40vw, 160px"
                            className="h-auto w-full"
                          />
                        </div>
                        <figcaption
                          className={`mt-2 text-center text-[0.75rem] leading-snug ${
                            claro ? "text-carvao/60" : "text-creme/60"
                          }`}
                        >
                          Onde entregar o kit
                        </figcaption>
                      </figure>
                    </div>

                    {/* Métodos de pagamento */}
                    <div className="mt-8 space-y-3">
                      <CartaoMetodo
                        metodo="sumup"
                        titulo="Multi-plataforma de Pagamento"
                        descricao="Pagas com cartão por link, num checkout rápido e seguro."
                        icone={<GlobeIcon className="h-6 w-6" />}
                      />
                      <CartaoMetodo
                        metodo="mbway"
                        titulo="MB Way"
                        descricao="Pagas com o telemóvel e confirmas na app."
                        icone={<MbWayIcon className="h-6 w-6" />}
                      />
                      <CartaoMetodo
                        metodo="transferencia"
                        titulo="Transferência bancária"
                        descricao="IBAN direto para a conta do evento."
                        icone={<TransferenciaIcon className="h-6 w-6" />}
                      />
                    </div>

                    {erroMetodo && (
                      <p
                        role="alert"
                        className={`mt-4 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]`}
                      >
                        {erroMetodo}
                      </p>
                    )}
                  </div>
                )}

                {/* ── PASSO: SumUp ── */}
                {passo === "sumup" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPasso("metodos")}
                      className={`inline-flex min-h-11 items-center gap-2 text-[0.8125rem] ${
                        claro ? "text-vinho/60 hover:text-vinho" : "text-creme/60 hover:text-creme"
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Voltar aos métodos
                    </button>

                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-5 flex items-center gap-3 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      <GlobeIcon className="h-7 w-7 text-blush" />
                      Pagamento por cartão
                    </h2>

                    <ol
                      className={`mt-6 space-y-4 text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/75" : "text-creme/75"
                      }`}
                    >
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">1.</span>
                        Abrimos o checkout seguro da SumUp numa nova aba.
                      </li>
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">2.</span>
                        Pagas com cartão (o valor é {VALOR_INSCRICAO_TEXT}).
                      </li>
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">3.</span>
                        Volta a esta janela e envia o comprovativo do pagamento.
                      </li>
                    </ol>

                    <a
                      href={SUMUP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-rosa px-7 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro"
                    >
                      <GlobeIcon className="h-4.5 w-4.5" />
                      Reabrir o checkout SumUp
                    </a>

                    <button
                      type="button"
                      onClick={() => setMostrarQr((v) => !v)}
                      aria-expanded={mostrarQr}
                      aria-controls="qr-sumup-painel"
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      <QrCode className="h-4 w-4" aria-hidden />
                      {mostrarQr ? "Ocultar código QR" : "Mostrar código QR"}
                    </button>

                    {mostrarQr && (
                      <div
                        id="qr-sumup-painel"
                        className="mt-4 rounded-sm border border-vinho/15 bg-white p-4 sm:p-5"
                      >
                        <LocalImage
                          src="/pagamento/qr-sumup-inscricao.svg"
                          alt="QR Code para pagamento da inscrição no Além do Espelho 2026"
                          width={370}
                          height={370}
                          className="mx-auto h-auto w-full min-w-[180px] max-w-[220px]"
                        />
                        <p className="mt-3 text-center text-[0.8125rem] leading-relaxed text-carvao/60">
                          Aponta a câmara do telemóvel para pagares os {VALOR_INSCRICAO_TEXT} pelo
                          mesmo checkout SumUp.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={declararPagamento}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      Já fiz o pagamento
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}

                {/* ── PASSO: MB Way ── */}
                {passo === "mbway" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPasso("metodos")}
                      className={`inline-flex min-h-11 items-center gap-2 text-[0.8125rem] ${
                        claro ? "text-vinho/60 hover:text-vinho" : "text-creme/60 hover:text-creme"
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Voltar aos métodos
                    </button>

                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-5 flex items-center gap-3 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      <MbWayIcon className="h-7 w-7 text-blush" />
                      MB Way
                    </h2>

                    <ol
                      className={`mt-6 space-y-4 text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/75" : "text-creme/75"
                      }`}
                    >
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">1.</span>
                        Abre a app MB Way e escolhe pagar por número de telemóvel.
                      </li>
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">2.</span>
                        Confere os dados abaixo e confirma o pagamento.
                      </li>
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">3.</span>
                        Depois de pagar, envia o comprovativo para garantirmos o teu lugar.
                      </li>
                    </ol>

                    <dl className="mt-6 space-y-3">
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          Número
                        </dt>
                        <dd
                          className={`mt-1 flex items-center justify-between gap-3 ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          <span className="font-medium tabular-nums tracking-wide">
                            {MBWAY_NUMERO}
                          </span>
                          <BotaoCopiar texto={MBWAY_NUMERO_COPIAR} claro={claro} />
                        </dd>
                      </div>
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          Valor
                        </dt>
                        <dd
                          className={`mt-1 flex items-center justify-between gap-3 ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          <span className="font-medium tabular-nums">{VALOR_INSCRICAO_TEXT}</span>
                          <BotaoCopiar texto={String(VALOR_INSCRICAO)} claro={claro} />
                        </dd>
                      </div>
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          Titular
                        </dt>
                        <dd
                          className={`mt-1 flex items-center justify-between gap-3 ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          <span className="font-medium">{TRANSFERENCIA.beneficiario}</span>
                        </dd>
                      </div>
                    </dl>

                    <a
                      href={linkWhatsAppPagamento("mbway")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#4fce5d] px-7 py-4 text-[0.9375rem] font-medium text-carvao transition-all duration-300 hover:brightness-105"
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      Combinar confirmação por WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={declararPagamento}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      Já fiz o pagamento
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}

                {/* ── PASSO: Transferência ── */}
                {passo === "transferencia" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPasso("metodos")}
                      className={`inline-flex min-h-11 items-center gap-2 text-[0.8125rem] ${
                        claro ? "text-vinho/60 hover:text-vinho" : "text-creme/60 hover:text-creme"
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Voltar aos métodos
                    </button>

                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-5 flex items-center gap-3 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      <TransferenciaIcon className="h-7 w-7 text-blush" />
                      Transferência bancária
                    </h2>

                    <dl className="mt-6 space-y-3">
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          IBAN
                        </dt>
                        <dd
                          className={`mt-1 flex items-center justify-between gap-3 ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          <span className="font-medium tabular-nums tracking-wide">
                            {formatarIban(TRANSFERENCIA.iban)}
                          </span>
                          <BotaoCopiar texto={TRANSFERENCIA.iban} claro={claro} />
                        </dd>
                      </div>
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          Beneficiário
                        </dt>
                        <dd
                          className={`mt-1 font-medium ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          {TRANSFERENCIA.beneficiario}
                        </dd>
                      </div>
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          BIC / SWIFT
                        </dt>
                        <dd
                          className={`mt-1 font-medium tabular-nums ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          {TRANSFERENCIA.bic}
                        </dd>
                      </div>
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          Instituição
                        </dt>
                        <dd
                          className={`mt-1 font-medium ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          {TRANSFERENCIA.instituicao}
                        </dd>
                      </div>
                      <div
                        className={`rounded-sm border px-4 py-3 ${
                          claro
                            ? "border-vinho/15 bg-creme-profundo/60"
                            : "border-creme/20 bg-creme/5"
                        }`}
                      >
                        <dt className={`eyebrow ${claro ? "text-vinho/50" : "text-creme/45"}`}>
                          Valor
                        </dt>
                        <dd
                          className={`mt-1 flex items-center justify-between gap-3 ${
                            claro ? "text-carvao/85" : "text-creme/85"
                          }`}
                        >
                          <span className="font-medium tabular-nums">{VALOR_INSCRICAO_TEXT}</span>
                          <BotaoCopiar texto={String(VALOR_INSCRICAO)} claro={claro} />
                        </dd>
                      </div>
                    </dl>

                    <p
                      className={`mt-4 text-[0.8125rem] leading-relaxed ${
                        claro ? "text-carvao/60" : "text-creme/60"
                      }`}
                    >
                      Referência da transferência:{" "}
                      <span className="font-medium">
                        {primeiroNome} · Além do Espelho 2026
                      </span>
                    </p>

                    <p
                      className={`mt-3 text-[0.75rem] leading-relaxed ${
                        claro ? "text-carvao/45" : "text-creme/45"
                      }`}
                    >
                      IBAN irlandês (SumUp) — transferência SEPA, sem custos adicionais na maioria
                      dos bancos portugueses.
                    </p>

                    <a
                      href={linkWhatsAppPagamento("transferencia")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#4fce5d] px-7 py-4 text-[0.9375rem] font-medium text-carvao transition-all duration-300 hover:brightness-105"
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      Combinar confirmação por WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={declararPagamento}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      Já fiz a transferência
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}

                {/* ── PASSO: comprovativo (upload) ── */}
                {passo === "comprovativo" && (
                  <div>
                    <button
                      type="button"
                      onClick={voltarAoMetodo}
                      className={`inline-flex min-h-11 items-center gap-2 text-[0.8125rem] ${
                        claro ? "text-vinho/60 hover:text-vinho" : "text-creme/60 hover:text-creme"
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Voltar às instruções
                    </button>

                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-5 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      Envia o comprovativo
                    </h2>

                    <p
                      className={`mt-4 text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/70" : "text-creme/70"
                      }`}
                    >
                      Anexa o comprovativo do pagamento (captura de ecrã, recibo ou PDF) para
                      validarmos o teu lugar. Fica guardado em segurança e só nós o vemos.
                    </p>

                    {motivoRejeicao && (
                      <div
                        role="alert"
                        className="mt-5 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
                      >
                        <p>
                          <strong className="font-medium">O comprovativo anterior foi rejeitado.</strong>{" "}
                          {motivoRejeicao} Envia um novo comprovativo válido.
                        </p>
                      </div>
                    )}

                    <div className="mt-6">
                      {pagamentoId ? (
                        <PaymentProofUpload
                          inscricaoId={inscricaoId}
                          pagamentoId={pagamentoId}
                          onSucesso={aoUploadSucesso}
                          onFalhaServidor={aoUploadFalha}
                        />
                      ) : (
                        <p
                          className={`rounded-sm border px-4 py-3 text-[0.875rem] leading-relaxed ${
                            claro
                              ? "border-vinho/15 bg-creme-profundo/60 text-carvao/70"
                              : "border-creme/20 bg-creme/5 text-creme/70"
                          }`}
                        >
                          Não conseguimos preparar o upload. Volta aos métodos e tenta de novo.
                        </p>
                      )}
                    </div>

                    {/* Caminho de fuga SEMPRE disponível: se o upload for um
                        obstáculo, a pagante vai pelo WhatsApp — nunca fica presa. */}
                    <button
                      type="button"
                      onClick={onComprovativoFalha}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      <WhatsAppIcon className="h-4 w-4" aria-hidden />
                      Prefiro enviar o comprovativo pelo WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return montado ? createPortal(dialogo, document.body) : null;
}
