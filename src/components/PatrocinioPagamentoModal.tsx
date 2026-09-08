"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WhatsAppIcon, MbWayIcon, TransferenciaIcon } from "./icons";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import PaymentProofUpload from "./PaymentProofUpload";
import { travarScroll, destravarScroll } from "@/lib/scroll-lock";
import { MBWAY_NUMERO, TRANSFERENCIA } from "@/lib/pagamento";
import { linkWhatsAppPatrocinio } from "@/lib/sponsor";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Id do patrocínio registado no POST /api/sponsor. */
  sponsorId: string;
  /**
   * B1/0011 — capability de posse do patrocínio (vive só em memória no
   * SponsorFlow). Vai nos PATCHs do método e no upload do comprovativo.
   */
  posseToken: string;
  /** Primeiro nome, para a referência da transferência. */
  nome: string;
  /** Nível de parceria escolhido (75 / 150 / 200€). */
  nivel: NivelParceria;
  /** Tema da modal: vinho (escuro) ou claro. */
  tom?: "vinho" | "claro";
  /**
   * Conclusão do fluxo (Bloco J): comprovativo recebido (comprovativoOk=true)
   * ou envio falhado / preferência pelo WhatsApp (false) — o pai fecha a
   * cadeia e abre o Parabéns (4.º modal empilhado).
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

type Passo = "metodos" | "mbway" | "transferencia" | "comprovativo";

const TITULO_MODAL = "patrocinio-pagamento-titulo";

/**
 * Modal de pagamento do patrocínio (FASE5) — mesmo padrão do PagamentoModal
 * (portal, focus trap, clique fora, scroll-lock com contador), mas com APENAS
 * MB Way e transferência bancária. O SumUp/cartão/QR é exclusivo da inscrição
 * e nunca aparece aqui. O "obrigado" é o 4.º modal empilhado no SponsorFlow,
 * por isso este modal não tem esse passo.
 *
 * Bloco J (0011): a escolha do método marca-o E cria o pagamento (valor
 * derivado do nível, pela RPC). "Já fiz o pagamento" abre o passo de
 * COMPROVATIVO — upload para o bucket privado (espelho do fluxo de inscrição),
 * com polling do estado para mostrar o motivo quando a Vitória rejeita. O
 * upload falhou ou a pessoa prefere o WhatsApp → conclusão com comprovativoOk
 * = false (fallback humano no Parabéns).
 */
export default function PatrocinioPagamentoModal({
  aberto,
  fechar,
  sponsorId,
  posseToken,
  nome,
  nivel,
  tom = "vinho",
  onConcluido,
}: Props) {
  const claro = tom === "claro";
  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);
  const [montado, setMontado] = useState(false);
  const reduzido = useReducedMotion();

  const [passo, setPasso] = useState<Passo>("metodos");
  const [marcando, setMarcando] = useState(false);
  const [erroMetodo, setErroMetodo] = useState<string | null>(null);

  // Bloco J — pagamento criado pela sequência do método (id + método guardado
  // para o upload e para o "voltar"), e o motivo de rejeição do polling.
  const [pagamentoId, setPagamentoId] = useState("");
  const [metodoEscolhido, setMetodoEscolhido] = useState<MetodoSponsor | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null);

  // r3 — anti-fecho (task #17): o clique fora e o ESC não fecham; o X com
  // progresso a perder (método escolhido) pede confirmação antes de descartar.
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

  /** Marca o método (cria o pagamento) e mostra as instruções dele. */
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

      // Bloco J: a mesma PATCH marca o método E cria o pagamento — o id vem
      // na resposta e alimenta o upload do comprovativo.
      setMetodoEscolhido(escolhido);
      setPagamentoId(
        typeof dados.pagamento?.pagamentoId === "string" ? dados.pagamento.pagamentoId : ""
      );
      setPasso(escolhido === "mbway" ? "mbway" : "transferencia");
    } catch {
      setErroMetodo("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setMarcando(false);
    }
  }

  // Bloco J — polling do estado do pagamento enquanto o passo de comprovativo
  // está aberto: se a Vitória rejeitar, o motivo aparece no sítio e a pessoa
  // reenvia. Intervalo comedido (10 s) e parado quando sai do passo.
  useEffect(() => {
    if (!aberto || passo !== "comprovativo" || !sponsorId || !posseToken) return;

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
          ref={overlayRef}
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
                        Usa o número:
                        <span className="font-medium tabular-nums">{MBWAY_NUMERO}</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-medium text-blush">3.</span>
                        Depois de pagar, combina a confirmação por WhatsApp para registarmos o
                        teu patrocínio.
                      </li>
                    </ol>

                    <a
                      href={linkWhatsAppPatrocinio("mbway", nivel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#4fce5d] px-7 py-4 text-[0.9375rem] font-medium text-carvao transition-all duration-300 hover:brightness-105"
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      Combinar confirmação por WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={() => setPasso("comprovativo")}
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

                    <a
                      href={linkWhatsAppPatrocinio("transferencia", nivel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#4fce5d] px-7 py-4 text-[0.9375rem] font-medium text-carvao transition-all duration-300 hover:brightness-105"
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      Combinar confirmação por WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={() => setPasso("comprovativo")}
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

                {/* ── PASSO: Comprovativo (Bloco J) — espelho do fluxo de
                       inscrição: upload ao bucket privado + polling do estado.
                       O upload falhou ou prefere o WhatsApp → conclusão com
                       comprovativoOk=false (fallback humano no Parabéns). ── */}
                {passo === "comprovativo" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPasso(metodoEscolhido === "transferencia" ? "transferencia" : "mbway")}
                      className={`inline-flex min-h-11 items-center gap-2 text-[0.8125rem] ${
                        claro ? "text-vinho/60 hover:text-vinho" : "text-creme/60 hover:text-creme"
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Voltar
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
                      Envia a captura do pagamento para agilizarmos a confirmação
                      do teu patrocínio — sem esperar pelo WhatsApp.
                    </p>

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
                        <PaymentProofUpload
                          inscricaoId={sponsorId}
                          pagamentoId={pagamentoId}
                          posseToken={posseToken}
                          endpoint="/api/sponsor/comprovativo"
                          idCampo="sponsorId"
                          onSucesso={() => {
                            onConcluido?.(metodoEscolhido ?? "mbway", true);
                          }}
                          onFalhaServidor={() => {
                            // Falha do servidor → conclusão com fallback humano
                            // (o Parabéns diz para combinar pelo WhatsApp).
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

                    {/* Fallback humano — mesmo sem upload, o fluxo nunca deixa
                        uma pagante presa (invariante do Bloco D). */}
                    <a
                      href={linkWhatsAppPatrocinio(
                        metodoEscolhido === "transferencia" ? "transferencia" : "mbway",
                        nivel
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onConcluido?.(
                        metodoEscolhido === "transferencia" ? "transferencia" : "mbway",
                        false
                      )}
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
                        claro
                          ? "border-vinho/25 text-vinho hover:border-vinho/45"
                          : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
                      }`}
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      Prefiro enviar pelo WhatsApp
                    </a>
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
