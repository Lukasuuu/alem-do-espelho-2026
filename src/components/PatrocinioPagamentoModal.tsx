"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MbWayIcon, TransferenciaIcon } from "./icons";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import { EcranMbWay, EcranTransferencia } from "./EcrasPagamentoMetodo";
import { travarScroll, destravarScroll } from "@/lib/scroll-lock";
import { linkWhatsAppPatrocinio } from "@/lib/sponsor";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Id do patrocínio registado no POST /api/sponsor. */
  sponsorId: string;
  /** Nome completo (o 1.º nome entra na referência da transferência). */
  nome: string;
  /** Empresa/marca, opcional — entra na mensagem do WhatsApp (Bloco J r2). */
  empresa?: string | null;
  /** Nível de parceria escolhido INLINE no formulário (75 / 150 / 200€). */
  nivel: NivelParceria;
  /** Tema da modal: vinho (escuro) ou claro. */
  tom?: "vinho" | "claro";
  /**
   * Fim do fluxo de pagamento: a pessoa marcou "Já fiz a
   * transferência/pagamento". O pai fecha esta modal e abre o Agradecimento.
   * Nunca se afirma pagamento confirmado — a Vitória confirma à parte.
   */
  onDeclararPagamento?: (metodo: MetodoSponsor) => void;
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
 * Modal de pagamento do patrocínio — mesmo padrão do PagamentoModal (portal,
 * focus trap, clique fora, scroll-lock com contador), com APENAS MB Way e
 * transferência bancária. O SumUp/cartão/QR é exclusivo da inscrição.
 *
 * FLUXO SIMPLES (3 passos):
 *   1. MÉTODOS — escolher MB Way ou transferência (PATCH /api/sponsor/metodo
 *      → RPC definir_metodo_sponsor, 2-arg — a RPC viva em produção).
 *   2. INSTRUÇÕES — os MESMOS ecrãs partilhados da inscrição
 *      (EcrasPagamentoMetodo), com valor = nível e referência de patrocínio.
 *      "Já fiz a transferência/pagamento" → onDeclararPagamento → Agradecimento.
 *
 * Sem comprovativo na app, sem upload, sem polling: o comprovativo vai à
 * Vitória por WhatsApp (como na inscrição).
 */
export default function PatrocinioPagamentoModal({
  aberto,
  fechar,
  sponsorId,
  nome,
  empresa,
  nivel,
  tom = "vinho",
  onDeclararPagamento,
}: Props) {
  const claro = tom === "claro";
  const painelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);
  const [montado, setMontado] = useState(false);
  const reduzido = useReducedMotion();

  const [passo, setPasso] = useState<Passo>("metodos");
  const [marcando, setMarcando] = useState(false);
  const [erroMetodo, setErroMetodo] = useState<string | null>(null);
  const [metodoEscolhido, setMetodoEscolhido] = useState<MetodoSponsor | null>(null);

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
      setMetodoEscolhido(null);
      setErroMetodo(null);
    }
  }, [aberto]);

  /** X da modal: com método já escolhido, pede confirmação primeiro. */
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

  /** Marca o método (RPC definir_metodo_sponsor — 2-arg, a viva em produção). */
  async function escolherMetodo(escolhido: MetodoSponsor) {
    setMarcando(true);
    setErroMetodo(null);

    try {
      const resposta = await fetch("/api/sponsor/metodo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, metodo: escolhido }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setErroMetodo(dados.mensagem ?? "Não conseguimos guardar o método. Tenta novamente.");
        return;
      }

      setMetodoEscolhido(escolhido);
      setPasso("dados");
    } catch {
      setErroMetodo("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setMarcando(false);
    }
  }

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
          {/* r4 — cor explícita: text-inherit puxava o carvão do body e
              deixava os títulos MB Way/Transferência escuros sobre o vinho. */}
          <span
            className={`block text-[0.9375rem] font-medium ${
              claro ? "text-vinho" : "text-creme"
            }`}
          >
            {titulo}
          </span>
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

  // Dados partilhados dos ecrãs de instrução — IGUAIS aos da inscrição, só
  // muda o valor (nível) e a copy "para confirmarmos o teu patrocínio".
  const valorText = `${nivel.toFixed(2).replace(".", ",")} €`;
  const valorCopiar = String(nivel);
  const whatsappHref =
    metodoEscolhido !== null
      ? linkWhatsAppPatrocinio(metodoEscolhido, nivel, nome, empresa)
      : "";

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

                {/* ── PASSO: instruções de pagamento — MESMOS ecrãs da
                       inscrição (componente partilhado), com o valor do
                       nível e a copy de patrocínio. Sem upload: o
                       comprovativo vai à Vitória por WhatsApp. ── */}
                {passo === "dados" && metodoEscolhido !== null && (
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
                      {metodoEscolhido === "mbway" ? (
                        <MbWayIcon className="h-7 w-7 text-blush" />
                      ) : (
                        <TransferenciaIcon className="h-7 w-7 text-blush" />
                      )}
                      {metodoEscolhido === "mbway" ? "MB Way" : "Transferência bancária"}
                    </h2>

                    <p
                      className={`mt-4 text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/75" : "text-creme/75"
                      }`}
                    >
                      {metodoEscolhido === "mbway"
                        ? `Efetua o pagamento de ${nivel}€ pelo MB Way para confirmarmos o teu patrocínio.`
                        : `Efetua a transferência de ${nivel}€ para confirmarmos o teu patrocínio.`}
                    </p>

                    {metodoEscolhido === "mbway" ? (
                      <EcranMbWay
                        claro={claro}
                        valorText={valorText}
                        valorCopiar={valorCopiar}
                        whatsappHref={whatsappHref}
                        aoDeclararPagamento={() => onDeclararPagamento?.(metodoEscolhido)}
                        textoBotaoDeclarar="Já fiz o pagamento"
                        textoPassoFinal="Volta aqui e marca “Já fiz o pagamento”."
                      />
                    ) : (
                      <EcranTransferencia
                        claro={claro}
                        valorText={valorText}
                        valorCopiar={valorCopiar}
                        whatsappHref={whatsappHref}
                        aoDeclararPagamento={() => onDeclararPagamento?.(metodoEscolhido)}
                        textoBotaoDeclarar="Já fiz a transferência"
                        referencia={`${primeiroNome} · Patrocínio Além do Espelho 2026`}
                      />
                    )}
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