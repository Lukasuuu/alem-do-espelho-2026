"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WhatsAppIcon, MbWayIcon, TransferenciaIcon } from "./icons";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import SponsorPaymentProofUpload from "./SponsorPaymentProofUpload";
import { travarScroll, destravarScroll } from "@/lib/scroll-lock";
import { MBWAY_NUMERO, MBWAY_NUMERO_COPIAR, TRANSFERENCIA } from "@/lib/pagamento";
import { linkWhatsAppPatrocinio } from "@/lib/sponsor";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Id do patrocínio registado no POST /api/sponsor. */
  sponsorId: string;
  /**
   * B1/0011 — capability de posse do patrocínio (vive só em memória no
   * SponsorFlow). Vai nos PATCHs do método/handoff e no upload do comprovativo.
   */
  posseToken: string;
  /** Nome completo (o 1.º nome entra na referência da transferência). */
  nome: string;
  /** Empresa/marca, opcional — entra na mensagem do WhatsApp (Bloco J r2). */
  empresa?: string | null;
  /** Nível de parceria escolhido (75 / 150 / 200€). */
  nivel: NivelParceria;
  /** Tema da modal: vinho (escuro) ou claro. */
  tom?: "vinho" | "claro";
  /**
   * Conclusão do fluxo (Bloco J r2): comprovativo recebido pelo upload
   * (comprovativoOk=true) ou handoff WhatsApp registado / upload falhado
   * (false) — o pai fecha a cadeia e abre o Obrigado.
   */
  onConcluido?: (metodo: MetodoSponsor, comprovativoOk: boolean) => void;
};

/** Elementos focáveis dentro do painel, para o foco circular (trap). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

type Passo = "metodos" | "dados";

const TITULO_MODAL = "patrocinio-pagamento-titulo";

/**
 * Modal de pagamento do patrocínio (FASE5 + Bloco J r2) — mesmo padrão do
 * PagamentoModal (portal, focus trap, clique fora, scroll-lock com contador),
 * mas com APENAS MB Way e transferência bancária. O SumUp/cartão/QR é
 * exclusivo da inscrição e nunca aparece aqui.
 *
 * FLUXO r2 (revisão do prompt) — dois passos, sem "Já fiz o pagamento":
 *
 *   1. MÉTODOS — escolher MB Way ou transferência (PATCH /api/sponsor/metodo
 *      → RPC iniciar_pagamento_sponsor: marca o método E cria o pagamento
 *      numa transação, valor derivado do nível).
 *   2. DADOS DO PAGAMENTO — na MESMA modal, por baixo das instruções
 *      (número/valor do MB Way ou beneficiário/IBAN/BIC/valor), o UPLOAD do
 *      comprovativo (signed upload direto ao bucket sponsor-payment-proofs)
 *      e logo abaixo o WhatsApp da Vitória (com handoff registado ANTES de
 *      abrir — a conversa só abre se a escrita responder OK).
 *
 * A conclusão (upload OK ou handoff OK) chama onConcluido e o SponsorFlow
 * abre o Obrigado — nunca se afirma pagamento confirmado; a Vitória verifica.
 */
export default function PatrocinioPagamentoModal({
  aberto,
  fechar,
  sponsorId,
  posseToken,
  nome,
  empresa,
  nivel,
  tom = "vinho",
  onConcluido,
}: Props) {
  const claro = tom === "claro";
  const painelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);
  const [montado, setMontado] = useState(false);
  const reduzido = useReducedMotion();

  const [passo, setPasso] = useState<Passo>("metodos");
  const [marcando, setMarcando] = useState(false);
  const [erroMetodo, setErroMetodo] = useState<string | null>(null);

  // Bloco J — pagamento criado pela RPC atómica (id alimenta o upload), e o
  // motivo de rejeição do polling.
  const [pagamentoId, setPagamentoId] = useState("");
  const [metodoEscolhido, setMetodoEscolhido] = useState<MetodoSponsor | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null);

  // Handoff WhatsApp: a rota PATCH /api/sponsor/whatsapp corre ANTES de abrir.
  const [abrirWhatsapp, setAbrirWhatsapp] = useState(false);

  // r3 — anti-fecho: o clique fora e o ESC não fecham; o X com progresso a
  // perder (método escolhido) pede confirmação antes de descartar.
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  // createPortal ao <body>, só depois de o cliente montar.
  useEffect(() => setMontado(true), []);

  // Cada abertura volta ao primeiro passo, sem confirmação pendente.
  useEffect(() => {
    if (aberto) {
      setPasso("metodos");
      setConfirmarSaida(false);
      setPagamentoId("");
      setMetodoEscolhido(null);
      setMotivoRejeicao(null);
      setAbrirWhatsapp(false);
      setErroMetodo(null);
    }
  }, [aberto]);

  /** X da modal C: com método já escolhido, pede confirmação primeiro. */
  function pedirFechar() {
    if (confirmarSaida) return;
    if (passo !== "metodos") {
      setConfirmarSaida(true);
      return;
    }
    fechar();
  }

  useEffect(() => {
    if (!aberto) return;

    // Quem abriu, devolve-se o foco ao fechar.
    abridorRef.current = document.activeElement as HTMLElement;

    // Scroll-lock com contador: empilhável com os outros modais do fluxo.
    travarScroll();

    const aoTecla = (e: KeyboardEvent) => {
      // r3 — sem ESC aqui: o fecho é só pelo X (que pede confirmação quando
      // há progresso). A confirmação própria tem ESC = "cancelar saída".
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

  /** Marca o método e cria o pagamento (RPC ATÓMICA) numa só chamada. */
  async function escolherMetodo(escolhido: MetodoSponsor) {
    // B1/0011: sem token de posse não há escrita — a sessão não é a deste registo.
    if (!posseToken) {
      setErroMetodo("A tua sessão expirou. Volta a submeter o formulário para continuar.");
      return;
    }
    setMarcando(true);
    setErroMetodo(null);

    try {
      const resposta = await fetch("/api/sponsor/metodo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, metodo: escolhido, posseToken }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setErroMetodo(dados.mensagem ?? "Não conseguimos guardar o método. Tenta novamente.");
        return;
      }

      // A mesma PATCH marca o método E cria/atualiza o pagamento — o id vem
      // na resposta e alimenta o upload do comprovativo.
      setMetodoEscolhido(escolhido);
      setPagamentoId(
        typeof dados.pagamento?.pagamentoId === "string" ? dados.pagamento.pagamentoId : ""
      );
      setPasso("dados");
    } catch {
      setErroMetodo("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setMarcando(false);
    }
  }

  /** Handoff WhatsApp: REGISTAR antes de abrir (Bloco J r2). Só abre se OK. */
  async function enviarPeloWhatsApp() {
    if (abrirWhatsapp) return;
    if (!posseToken || !pagamentoId) {
      setErroMetodo("O pagamento ainda não ficou registado. Volta atrás e escolhe o método de novo.");
      return;
    }
    setAbrirWhatsapp(true);
    setErroMetodo(null);

    // A janela abre vazia DENTRO do gesto do clique (popup blockers só
    // honram o gesto direto) e é preenchida depois de a escrita responder.
    const janela = window.open("", "_blank");

    try {
      const resposta = await fetch("/api/sponsor/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, pagamentoId, posseToken }),
      });
      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        // Handoff não registado → a conversa NÃO abre (a Vitória não recebe
        // contexto) e o erro aparece na modal.
        janela?.close();
        setErroMetodo(dados.mensagem ?? "Não conseguimos registar o envio pelo WhatsApp. Tenta novamente.");
        return;
      }

      const link = linkWhatsAppPatrocinio(
        metodoEscolhido ?? "mbway",
        nivel,
        nome,
        empresa
      );
      if (janela) {
        janela.location.href = link;
      } else {
        // Popup bloqueado: abre pelo href normal (ainda após o registo OK).
        window.location.href = link;
      }
      onConcluido?.(metodoEscolhido ?? "mbway", false);
    } catch {
      janela?.close();
      setErroMetodo("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setAbrirWhatsapp(false);
    }
  }

  // Bloco J — polling do estado do pagamento enquanto os dados estão abertos:
  // se a Vitória rejeitar, o motivo aparece no sítio e a pessoa reenvia.
  // Intervalo comedido (10 s) e parado quando sai do passo.
  useEffect(() => {
    if (!aberto || passo !== "dados" || !sponsorId || !posseToken) return;

    let vivo = true;
    async function sondar() {
      try {
        const resposta = await fetch("/api/sponsor/estado", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sponsorId, posseToken }),
        });
        if (!resposta.ok || !vivo) return;
        const dados = (await resposta.json()) as {
          ok: boolean;
          estado?: string;
          motivoRejeicao?: string | null;
        };
        if (vivo && dados.ok) setMotivoRejeicao(dados.motivoRejeicao ?? null);
      } catch {
        // polling é best-effort — falha de rede não perturba o passo
      }
    }

    const intervalo = window.setInterval(sondar, 10000);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
    };
  }, [aberto, passo, sponsorId, posseToken]);

  /* ── Ecrãs ────────────────────────────────────────────────── */

  function CartaoMetodo({
    metodo: m,
    titulo,
    descricao,
    icone,
  }: {
    metodo: MetodoSponsor;
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
          className="modal-overlay modal-overlay-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={TITULO_MODAL}
        >
          <motion.div
            ref={painelRef}
            className="modal-content"
            style={{ maxWidth: "36rem" }}
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
                onClick={pedirFechar}
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
                        Patrocínio
                      </span>
                      <span className="display text-3xl text-blush tabular-nums">{nivel}€</span>
                    </div>

                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-4 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      Escolhe a forma de pagamento
                    </h2>

                    <p
                      className={`mt-4 max-w-md text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/70" : "text-creme/70"
                      }`}
                    >
                      Este patrocínio ajuda a levar o Além do Espelho a mais mulheres. Confirma
                      como preferes pagar.
                    </p>

                    {/* Só MB Way e transferência — sem cartão neste fluxo */}
                    <div className="mt-8 space-y-3">
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
                        className="mt-4 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
                      >
                        {erroMetodo}
                      </p>
                    )}

                    <p
                      className={`mt-8 text-center text-[0.75rem] leading-relaxed ${
                        claro ? "text-carvao/45" : "text-creme/45"
                      }`}
                    >
                      Sem cartão no site — transferência bancária ou MB Way.
                    </p>
                  </div>
                )}

                {/* ── PASSO: DADOS DO PAGAMENTO (r2) — instruções + UPLOAD +
                       WhatsApp na MESMA modal, por esta ordem. Sem o passo
                       "Já fiz o pagamento": o comprovativo é logo aqui. ── */}
                {passo === "dados" && (
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

                    {metodoEscolhido === "mbway" ? (
                      <>
                        <h2
                          id={TITULO_MODAL}
                          className={`display mt-5 flex items-center gap-3 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                            claro ? "text-vinho" : "text-creme"
                          }`}
                        >
                          <MbWayIcon className="h-7 w-7 text-blush" />
                          MB Way
                        </h2>

                        <p
                          className={`mt-4 text-[0.9375rem] leading-relaxed ${
                            claro ? "text-carvao/75" : "text-creme/75"
                          }`}
                        >
                          Efetua o pagamento pelo MB WAY e envia o comprovativo abaixo.
                        </p>

                        <dl className="mt-6 space-y-3">
                          <div
                            className={`rounded-sm border px-4 py-3 ${
                              claro
                                ? "border-vinho/15 bg-creme-profundo/60"
                                : "border-creme/20 bg-creme/5"
                            }`}
                          >
                            <dt
                              className={`eyebrow ${
                                claro ? "text-vinho/50" : "text-creme/45"
                              }`}
                            >
                              Número MB Way
                            </dt>
                            <dd
                              className={`mt-1 flex items-center justify-between gap-3 font-medium tabular-nums tracking-wide ${
                                claro ? "text-carvao/85" : "text-creme/85"
                              }`}
                            >
                              <span>{MBWAY_NUMERO}</span>
                              <span className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(MBWAY_NUMERO_COPIAR);
                                  }}
                                  className="min-h-11 rounded-sm border px-3 text-[0.75rem] uppercase tracking-wide transition-colors"
                                  aria-label="Copiar número MB Way"
                                >
                                  Copiar
                                </button>
                              </span>
                            </dd>
                          </div>
                          <div
                            className={`rounded-sm border px-4 py-3 ${
                              claro
                                ? "border-vinho/15 bg-creme-profundo/60"
                                : "border-creme/20 bg-creme/5"
                            }`}
                          >
                            <dt
                              className={`eyebrow ${
                                claro ? "text-vinho/50" : "text-creme/45"
                              }`}
                            >
                              Valor
                            </dt>
                            <dd className="display mt-1 text-2xl text-blush tabular-nums">
                              {nivel}€
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <>
                        <h2
                          id={TITULO_MODAL}
                          className={`display mt-5 flex items-center gap-3 text-[1.75rem] leading-[1.05] sm:text-[2.125rem] ${
                            claro ? "text-vinho" : "text-creme"
                          }`}
                        >
                          <TransferenciaIcon className="h-7 w-7 text-blush" />
                          Transferência bancária
                        </h2>

                        <p
                          className={`mt-4 text-[0.9375rem] leading-relaxed ${
                            claro ? "text-carvao/75" : "text-creme/75"
                          }`}
                        >
                          Efetua a transferência e envia o comprovativo abaixo.
                        </p>

                        <dl className="mt-6 space-y-3">
                          <div
                            className={`rounded-sm border px-4 py-3 ${
                              claro
                                ? "border-vinho/15 bg-creme-profundo/60"
                                : "border-creme/20 bg-creme/5"
                            }`}
                          >
                            <dt
                              className={`eyebrow ${
                                claro ? "text-vinho/50" : "text-creme/45"
                              }`}
                            >
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
                            <dt
                              className={`eyebrow ${
                                claro ? "text-vinho/50" : "text-creme/45"
                              }`}
                            >
                              IBAN
                            </dt>
                            <dd
                              className={`mt-1 font-medium tabular-nums tracking-wide ${
                                claro ? "text-carvao/85" : "text-creme/85"
                              }`}
                            >
                              {TRANSFERENCIA.iban}
                            </dd>
                          </div>
                          <div
                            className={`rounded-sm border px-4 py-3 ${
                              claro
                                ? "border-vinho/15 bg-creme-profundo/60"
                                : "border-creme/20 bg-creme/5"
                            }`}
                          >
                            <dt
                              className={`eyebrow ${
                                claro ? "text-vinho/50" : "text-creme/45"
                              }`}
                            >
                              BIC / SWIFT
                            </dt>
                            <dd
                              className={`mt-1 font-medium tabular-nums tracking-wide ${
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
                            <dt
                              className={`eyebrow ${
                                claro ? "text-vinho/50" : "text-creme/45"
                              }`}
                            >
                              Valor
                            </dt>
                            <dd className="display mt-1 text-2xl text-blush tabular-nums">
                              {nivel}€
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
                            {primeiroNome} · Patrocínio Além do Espelho 2026
                          </span>
                        </p>
                      </>
                    )}

                    {/* Vitória rejeitou o comprovativo anterior → o motivo do
                        polling aparece aqui e a pessoa reenvia. */}
                    {motivoRejeicao && (
                      <p
                        role="alert"
                        className="mt-4 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
                      >
                        A confirmação devolveu o comprovativo: {motivoRejeicao}. Podes
                        enviar outro ficheiro.
                      </p>
                    )}

                    {pagamentoId && posseToken ? (
                      <div className="mt-6">
                        <SponsorPaymentProofUpload
                          sponsorId={sponsorId}
                          pagamentoId={pagamentoId}
                          posseToken={posseToken}
                          onSucesso={() => {
                            onConcluido?.(metodoEscolhido ?? "mbway", true);
                          }}
                          onFalhaServidor={() => {
                            // Falha do servidor → conclusão com fallback humano
                            // (o Obrigado diz para enviar pelo WhatsApp).
                            onConcluido?.(metodoEscolhido ?? "mbway", false);
                          }}
                        />
                      </div>
                    ) : (
                      <p
                        role="alert"
                        className={`mt-6 rounded-sm border px-4 py-3 text-[0.875rem] ${
                          claro
                            ? "border-vinho/30 bg-vinho/5 text-vinho/80"
                            : "border-[#e88b8b]/40 bg-[#e88b8b]/10 text-[#f3c0c0]"
                        }`}
                      >
                        O pagamento ainda não ficou registado. Volta atrás e
                        escolhe o método de novo.
                      </p>
                    )}

                    {/* Handoff WhatsApp — REGISTADO antes de abrir; a conversa
                        só abre se a escrita responder OK. A mensagem é montada
                        pela lib (nome/empresa/nível/valor — sem dados técnicos). */}
                    <button
                      type="button"
                      onClick={() => void enviarPeloWhatsApp()}
                      disabled={abrirWhatsapp}
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      {abrirWhatsapp
                        ? "A registar o envio…"
                        : "Enviar pelo WhatsApp à Vitória"}
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

  return montado ? (
    <>
      {createPortal(dialogo, document.body)}
      {/* r3 — confirmação de saída por cima (mesmo padrão do fluxo de inscrição). */}
      <ConfirmacaoSaidaModal
        aberto={aberto && confirmarSaida}
        manter={() => setConfirmarSaida(false)}
        sair={() => {
          setConfirmarSaida(false);
          fechar();
        }}
        texto="Escolheste o método de pagamento, mas o patrocínio ainda não está confirmado."
      />
    </>
  ) : null;
}