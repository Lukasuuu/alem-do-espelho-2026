"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, QrCode, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WhatsAppIcon, GlobeIcon, MbWayIcon, TransferenciaIcon } from "./icons";
import LocalImage from "./LocalImage";
import CartaoMetodoPagamento from "./CartaoMetodoPagamento";
import PaymentProofUpload from "./PaymentProofUpload";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
// Ecrãs de instrução MB Way/Transferência EXTRAÍDOS para componente
// partilhado (EcrasPagamentoMetodo.tsx, que já usa BotaoCopiar.tsx) —
// usados AQUI (inscrição) e no patrocínio (PatrocinioPagamentoModal):
// paridade visual real, um só componente, nenhum risco de divergir.
import { EcranMbWay, EcranTransferencia } from "./EcrasPagamentoMetodo";
import { travarScroll, destravarScroll } from "@/lib/scroll-lock";
// MBWAY_NUMERO/MBWAY_NUMERO_COPIAR/TRANSFERENCIA/formatarIban vivem agora
// DENTRO dos ecrãs partilhados — aqui não se usam mais (fonte única).
import {
  SUMUP_URL,
  VALOR_INSCRICAO,
  VALOR_INSCRICAO_TEXT,
  linkWhatsAppPagamento,
  mensagemRecuperacaoPagamento,
} from "@/lib/pagamento";
import { SALON_WHATSAPP } from "@/lib/campanha";
import { linkWhatsApp } from "@/lib/site";
import type { MetodoPagamento } from "@/lib/validation";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Id da inscrição registada no POST /api/inscricao. */
  inscricaoId: string;
  /**
   * Token de posse da inscrição (B1/0009) — capability devolvida UMA vez pelo
   * POST e guardada só em memória no pai. Envia-se nas escritas (método,
   * comprovativo); nunca em logs, URL ou à SumUp.
   */
  posseToken: string;
  /** Primeiro nome, para a mensagem de confirmação. */
  nome: string;
  /** Tema da modal: vinho (escuro) ou claro. */
  tom?: "vinho" | "claro";
  /**
   * Upload do comprovativo respondeu OK (MB Way / transferência) OU a pagante
   * declarou "Já fiz o pagamento" no passo do link SumUp (decisão E: para a
   * SumUp o comprovativo é redundante — ela tem registo próprio) → o pai
   * fecha esta modal e mostra o PARABÉNS (e dispara o email "recebemos a tua
   * inscrição" — directiva §3).
   */
  onComprovativoSucesso: () => void;
  /**
   * Upload falhou (servidor/rede/rate) OU a pessoa prefere enviar o comprovativo
   * pelo WhatsApp → o pai fecha esta modal e mostra o PARABÉNS com a linha de
   * fallback. Nunca se deixa uma pagante presa no upload.
   */
  onComprovativoFalha: () => void;
};

/** Elementos focáveis dentro do painel, para o foco circular (trap). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Painel do código QR do link SumUp — o MESMO checkout, num cartão branco e
 * sem gerador de QR (asset estático). Partilhado pelos passos "sumup" e
 * "recuperacao" (Bloco C): só um passo renderiza de cada vez, pelo que o
 * id usado pelo aria-controls nunca se duplica.
 */
function PainelQrSumup() {
  return (
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
        Podes pagar noutro telemóvel: aponta a câmara para o QR e pagas os{" "}
        {VALOR_INSCRICAO_TEXT} no mesmo checkout SumUp.
      </p>
    </div>
  );
}

/**
 * Passos da modal:
 *  - metodos: escolha da forma de pagamento (SumUp / MB Way / Transferência);
 *  - sumup: checkout SumUp (nova aba, com sondagem de retorno) + toggle
 *    "Mostrar código QR" do mesmo link + "Tive um problema" (rede de segurança);
 *  - recuperacao (Bloco C): o checkout não concluiu — pergunta neutra, WhatsApp
 *    destaque, alternativas de método e "Já fiz o pagamento";
 *  - mbway / transferencia: instruções + dados para copiar + "Já efetuei o pagamento";
 *  - comprovativo: upload do comprovativo (PaymentProofUpload) — o resultado
 *    (OK ou falha) fecha a modal e abre o PARABÉNS (decide o pai).
 */
type Passo =
  | "metodos"
  | "sumup"
  | "recuperacao"
  | "mbway"
  | "transferencia"
  | "comprovativo";

const TITULO_MODAL = "pagamento-titulo";

/**
 * Modal de pagamento (FASE2) — padrão do projeto: portal, focus trap, ESC,
 * clique fora e scroll-lock com contador de referências. Fluxo:
 *  1. escolher método → PATCH /api/inscricao/metodo cria o pagamento (payment_started);
 *  2. instruções do método (SumUp abre o checkout e a sondagem de retorno
 *     leva ao passo "recuperacao" se o checkout fechar; MB Way e transferência
 *     com dados para copiar; o cartão do link expõe ainda o QR do mesmo link,
 *     num cartão branco e sem gerador de QR);
 *  3. "Já fiz o pagamento": no link SumUp é uma DECLARAÇÃO que vai direto ao
 *     sucesso (decisão E — a SumUp tem registo próprio); nos outros métodos
 *     leva ao comprovativo (upload validado no servidor);
 *  4. sucesso → onComprovativoSucesso (o pai fecha e mostra o PARABÉNS, que
 *     dispara o email "recebemos a tua inscrição" — directiva §3). Upload
 *     falhou ou a pessoa prefere o WhatsApp → onComprovativoFalha (o pai mostra
 *     o PARABÉNS com fallback). SEM ecrã de espera e SEM polling do estado na
 *     base: a única sondagem é a da janela do checkout, local e passageira.
 */
export default function PagamentoModal({
  aberto,
  fechar,
  inscricaoId,
  nome,
  posseToken,
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
  // Briefing 05/09 (Bloco A): confirmação ao fechar a meio do pagamento.
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // Espelhos em ref: o handler de teclado é registado uma vez por abertura e
  // não vê re-renders — ler estado em closure ficaria antigo.
  const confirmarSaidaRef = useRef(false);
  const metodoRef = useRef<MetodoPagamento | null>(null);
  // Bloco C: referência à janela do checkout SumUp e o instante da abertura —
  // a sondagem ignora fechos nos primeiros 1500 ms (anti-falso-positivo).
  const sumupRef = useRef<Window | null>(null);
  const sumupAbertoEm = useRef(0);

  // createPortal ao <body>, só depois de o cliente montar.
  useEffect(() => setMontado(true), []);

  // Cada abertura volta ao primeiro passo e limpa o estado da sessão anterior.
  useEffect(() => {
    if (!aberto) return;
    setPasso("metodos");
    setMetodo(null);
    metodoRef.current = null;
    setPagamentoId(null);
    setErroMetodo(null);
    setMotivoRejeicao(null);
    setMostrarQr(false);
    setConfirmarSaida(false);
    confirmarSaidaRef.current = false;
    sumupRef.current = null;
    sumupAbertoEm.current = 0;
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    // Quem abriu, devolve-se o foco ao fechar.
    abridorRef.current = document.activeElement as HTMLElement;

    // Scroll-lock com contador: empilhável com outros modais.
    travarScroll();

    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pedirFechar();
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

  // ── Bloco C: sondagem de retorno do checkout SumUp. Enquanto o passo é
  // "sumup", sonda sumupRef.closed a cada 500 ms e sempre que a nossa tab
  // recupera o foco (focus / visibilitychange). Um fecho detetado >1500 ms
  // depois da abertura leva ao passo "recuperacao" — pergunta neutra, nunca
  // diagnóstico (não sabemos o que correu mal no checkout, e afirmar
  // "falhou" pode ser falso). Popup bloqueado (sumupRef null) → sem deteção;
  // a rede de segurança é o link "Tive um problema", sempre visível.
  useEffect(() => {
    if (passo !== "sumup") return;

    const verificarRetorno = () => {
      const janela = sumupRef.current;
      if (!janela) return;
      if (Date.now() - sumupAbertoEm.current < 1500) return;
      if (janela.closed) {
        sumupRef.current = null;
        setPasso("recuperacao");
      }
    };

    const intervalo = window.setInterval(verificarRetorno, 500);
    const aoFoco = () => verificarRetorno();
    window.addEventListener("focus", aoFoco);
    document.addEventListener("visibilitychange", aoFoco);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFoco);
      document.removeEventListener("visibilitychange", aoFoco);
      // Ao sair do passo sumup (por qualquer via), a referência morre.
      sumupRef.current = null;
    };
  }, [passo]);

  /** Briefing 05/09 (Bloco A): o clique fora não fecha — um clique acidental
   *  descartaria um pagamento a meio. ESC e o botão X mantêm-se. */
  function aoClicarFora() {
    /* no-op intencional */
  }

  /**
   * X e ESC passam por aqui (briefing 05/09, Bloco A): com método já escolhido,
   * o fecho pede confirmação em vez de descartar o pagamento a meio. Os refs
   * evitam a closure antiga do handler de teclado.
   */
  function pedirFechar() {
    // Confirmação aberta → o ESC do fundo não faz nada: quem reage é a
    // confirmação (o ESC aí é "cancelar saída").
    if (confirmarSaidaRef.current) return;
    if (metodoRef.current !== null) {
      confirmarSaidaRef.current = true;
      setConfirmarSaida(true);
      return;
    }
    fechar();
  }

  /**
   * Bloco C: abre (ou reabre) o checkout SumUp e guarda a referência para a
   * sondagem de retorno. SEM "noopener" — passaria a referência a null e
   * perdíamos a deteção de fecho; a higiene faz-se com janela.opener = null,
   * que corta o acesso do checkout à nossa janela sem perder a nossa
   * referência para sondar win.closed.
   */
  function abrirSumup() {
    const janela = window.open(SUMUP_URL, "_blank");
    sumupRef.current = janela;
    try {
      if (janela) janela.opener = null;
    } catch {
      /* higiene best-effort: nenhum passo do fluxo depende disto */
    }
    sumupAbertoEm.current = Date.now();
  }

  /** Marca o método no Supabase (cria o pagamento) e segue o fluxo. */
  async function escolherMetodo(escolhido: MetodoPagamento) {
    setMarcando(true);
    setErroMetodo(null);

    try {
      const resposta = await fetch("/api/inscricao/metodo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // B1: posse_token prova a posse da inscrição (saía daqui o ip_hash).
        body: JSON.stringify({ inscricaoId, metodo: escolhido, posseToken }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setErroMetodo(dados.mensagem ?? "Não conseguimos guardar o método. Tenta novamente.");
        return;
      }

      setMetodo(escolhido);
      metodoRef.current = escolhido;
      setPagamentoId(dados.pagamento.pagamentoId);

      if (escolhido === "sumup") {
        // Checkout numa nova aba — a modal fica aberta a sondar o retorno.
        abrirSumup();
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
   * "Já fiz o pagamento" (MB Way, transferência e passo de recuperação): leva
   * ao comprovativo. O PATCH /api/inscricao/metodo já respondeu OK antes de
   * este botão ser clicável (metodo !== null ⟺ gravado). O email "recebemos a
   * tua inscrição" NÃO dispara aqui — dispara no momento do PARABÉNS, depois
   * de o upload do comprovativo responder OK (directiva §3). No passo do link
   * SumUp o botão NÃO passa por aqui: é uma declaração direta ao sucesso.
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
            className="modal-content modal-pagamento-conteudo"
            initial={animacaoEntrada}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduzido ? undefined : { opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl rounded-b-none md:rounded-sm ${
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

              {/* Cabeçalho fixo (B.3): não sai com o scroll interno e é aqui que
                  o X vive. B.2: pr-16 reserva a faixa de toque do X — o preço
                  nunca passa por baixo dele, seja qual for o comprimento. */}
              <div className="relative z-10 flex-none px-6 pb-3 pt-4 sm:px-9 md:pb-5 md:pt-6">
                {passo === "metodos" && (
                  <div className="flex flex-nowrap items-center justify-between gap-x-4 gap-y-1 pr-16 md:flex-wrap">
                    {/* Telemóvel (<768px): título à esquerda, preço à direita, na
                        mesma linha (o título parte em 2 linhas dentro do seu espaço,
                        o preço nunca desce nem entra na faixa do X); sobrescrito
                        PAGAMENTO escondido. Desktop: sobrescrito + preço na 1.ª
                        linha, título por baixo. */}
                    <span
                      className={`eyebrow order-1 hidden md:block ${
                        claro ? "text-vinho/60" : "text-dourado-claro/70"
                      }`}
                    >
                      Pagamento
                    </span>
                    <h2
                      id={TITULO_MODAL}
                      className={`display order-2 min-w-0 flex-1 text-[1.125rem] leading-[1.3] md:order-3 md:w-full md:flex-none md:text-[1.75rem] md:leading-[1.05] lg:text-[2.125rem] 2xl:text-[2.375rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      Escolha a forma de pagamento
                    </h2>
                    <span className="display order-3 shrink-0 text-[1.35rem] text-blush md:order-2 md:text-3xl 2xl:text-4xl">
                      {VALOR_INSCRICAO_TEXT}
                    </span>
                  </div>
                )}

                {(passo === "sumup" ||
                  passo === "recuperacao" ||
                  passo === "mbway" ||
                  passo === "transferencia" ||
                  passo === "comprovativo") && (
                  <div className="pr-14">
                    <button
                      type="button"
                      onClick={
                        passo === "comprovativo" ? voltarAoMetodo : () => setPasso("metodos")
                      }
                      className={`inline-flex min-h-11 items-center gap-2 text-[0.8125rem] ${
                        claro ? "text-vinho/60 hover:text-vinho" : "text-creme/60 hover:text-creme"
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      {passo === "comprovativo" ? "Voltar às instruções" : "Voltar aos métodos"}
                    </button>
                    <h2
                      id={TITULO_MODAL}
                      className={`display mt-2 flex items-center gap-3 text-[1.375rem] leading-tight md:text-[1.75rem] md:leading-[1.05] lg:text-[2.125rem] 2xl:text-[2.375rem] ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      {passo === "sumup" && (
                        <GlobeIcon className="h-6 w-6 text-blush md:h-7 md:w-7" />
                      )}
                      {passo === "recuperacao" && (
                        <GlobeIcon className="h-6 w-6 text-blush md:h-7 md:w-7" />
                      )}
                      {passo === "mbway" && (
                        <MbWayIcon className="h-6 w-6 text-blush md:h-7 md:w-7" />
                      )}
                      {passo === "transferencia" && (
                        <TransferenciaIcon className="h-6 w-6 text-blush md:h-7 md:w-7" />
                      )}
                      {passo === "sumup" && "Pagamento por link"}
                      {passo === "recuperacao" && "Problema com o pagamento"}
                      {passo === "mbway" && "MB Way"}
                      {passo === "transferencia" && "Transferência bancária"}
                      {passo === "comprovativo" && "Envia o comprovativo"}
                    </h2>
                  </div>
                )}

                {/* Botão fechar, alvo de toque ≥ 44×44 — no cabeçalho fixo,
                    nunca sai com o scroll interno (B.3). */}
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
              </div>

              {/* Zona de scroll interno — o cabeçalho acima fica fixo. */}
              <div
                className={`modal-pagamento-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-10 sm:px-9 ${
                  claro ? "text-carvao/75" : "text-creme/75"
                }`}
              >
                {/* ── PASSO: métodos (corpo; cabeçalho está na zona fixa) ── */}
                {passo === "metodos" && (
                  <div>
                    {/* Briefing 05/09 (B.1/B.3): os métodos vêm primeiro, acima da
                        dobra. Telemóvel: 1 coluna em linha (ver CartaoMetodoPagamento);
                        tablet e acima: 3 colunas lado a lado. */}
                    <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                      <CartaoMetodoPagamento
                        titulo="Pagamento por link"
                        descricao="Cartão, checkout seguro"
                        iconeSrc="/icone/pagamento-link.webp"
                        onClick={() => escolherMetodo("sumup")}
                        disabled={marcando}
                      />
                      <CartaoMetodoPagamento
                        titulo="MB Way"
                        descricao="Pagas no telemóvel"
                        iconeSrc="/icone/mbway.webp"
                        onClick={() => escolherMetodo("mbway")}
                        disabled={marcando}
                      />
                      <CartaoMetodoPagamento
                        titulo="Transferência"
                        descricao="IBAN direto"
                        iconeSrc="/icone/mb-transferencia.webp"
                        onClick={() => escolherMetodo("transferencia")}
                        disabled={marcando}
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

                    {/* Briefing 05/09 (B.4): o kit passa para baixo, como contexto
                        secundário com título próprio, e sai do caminho da escolha. */}
                    <div className="mt-9">
                      <h3
                        className={`display text-[1.25rem] ${
                          claro ? "text-vinho" : "text-creme"
                        }`}
                      >
                        O kit de higiene
                      </h3>
                      <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed">
                        A tua inscrição inclui um kit de higiene. Podes entregá-lo em qualquer um
                        destes pontos de recolha.
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                              sizes="(max-width: 640px) 90vw, 160px"
                              className="aspect-[2/3] w-full object-cover object-top"
                            />
                          </div>
                          <figcaption
                            className={`mt-2 text-center text-[0.75rem] leading-snug ${
                              claro ? "text-carvao/60" : "text-creme/65"
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
                              sizes="(max-width: 640px) 90vw, 160px"
                              className="aspect-[2/3] w-full object-cover object-top"
                            />
                          </div>
                          <figcaption
                            className={`mt-2 text-center text-[0.75rem] leading-snug ${
                              claro ? "text-carvao/60" : "text-creme/65"
                            }`}
                          >
                            Onde entregar o kit
                          </figcaption>
                        </figure>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PASSO: pagamento por link (cabeçalho e voltar estão na
                    zona fixa). A sondagem local leva ao passo "recuperacao"
                    se o checkout fechar; o link "Tive um problema" é a rede
                    de segurança para o popup bloqueado. ── */}
                {passo === "sumup" && (
                  <div>
                    <ol
                      className={`mt-4 space-y-4 text-[0.9375rem] leading-relaxed ${
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
                        Quando o pagamento concluir, volta a esta janela e toca em
                        «Já fiz o pagamento».
                      </li>
                    </ol>

                    {/* Reabrir por botão (não <a>): assim a reabertura passa por
                        abrirSumup() e a referência para a sondagem repõe-se. */}
                    <button
                      type="button"
                      onClick={abrirSumup}
                      className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-rosa px-7 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro"
                    >
                      <GlobeIcon className="h-4.5 w-4.5" />
                      Reabrir o checkout SumUp
                    </button>

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

                    {mostrarQr && <PainelQrSumup />}

                    {/* Rede de segurança, sempre visível: cobre o popup bloqueado
                        (sem deteção possível) e o fecho não concluído. */}
                    <button
                      type="button"
                      onClick={() => setPasso("recuperacao")}
                      className={`mx-auto mt-5 block text-[0.8125rem] underline underline-offset-4 transition-colors ${
                        claro
                          ? "text-carvao/50 hover:text-vinho"
                          : "text-creme/50 hover:text-creme/80"
                      }`}
                    >
                      Tive um problema com o pagamento
                    </button>

                    {/* Decisão E (06/09): para o link SumUp o comprovativo é
                        redundante — a SumUp tem registo próprio da transação.
                        A declaração vai DIRETO ao sucesso (Parabéns + email),
                        sem upload; a reconciliação da organização é o painel
                        SumUp. Guard anti-duplo-email vive no pai (EventoPage). */}
                    <button
                      type="button"
                      onClick={onComprovativoSucesso}
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

                {/* ── PASSO: recuperação do pagamento por link (Bloco C) ──
                    Chega-se aqui pela deteção de fecho do checkout ou pelo
                    "Tive um problema". Pergunta NEUTRA — nunca diagnóstico:
                    não sabemos o que aconteceu no checkout, e dizer "falhou"
                    pode ser falso. */}
                {passo === "recuperacao" && (
                  <div>
                    <p
                      className={`mt-4 text-[0.9375rem] font-medium leading-relaxed ${
                        claro ? "text-carvao/85" : "text-creme/85"
                      }`}
                    >
                      Correu tudo bem com o pagamento?
                    </p>
                    <p
                      className={`mt-2 text-[0.875rem] leading-relaxed ${
                        claro ? "text-carvao/60" : "text-creme/65"
                      }`}
                    >
                      Às vezes o banco bloqueia o pagamento por cartão. Tens outras
                      formas de pagar.
                    </p>

                    {/* WhatsApp destaque — a rede de segurança humana. A mensagem
                        leva a referência da inscrição para a Vitória localizar. */}
                    <a
                      href={linkWhatsApp(
                        SALON_WHATSAPP,
                        mensagemRecuperacaoPagamento(primeiroNome, inscricaoId)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-whatsapp px-7 py-4 text-[0.9375rem] font-medium text-white transition-all duration-300 hover:brightness-105"
                    >
                      <WhatsAppIcon className="h-4.5 w-4.5" />
                      Falar connosco no WhatsApp
                    </a>

                    {/* Alternativas: reescolher método (o PATCH atualiza a MESMA
                        row de pagamento) ou pagar pelo QR do mesmo link — o QR
                        NUNCA grava metodo="qr" na base. */}
                    <div className="mt-6 grid grid-cols-1 gap-3">
                      <CartaoMetodoPagamento
                        titulo="Transferência"
                        descricao="IBAN direto"
                        iconeSrc="/icone/mb-transferencia.webp"
                        onClick={() => escolherMetodo("transferencia")}
                        disabled={marcando}
                      />
                      <CartaoMetodoPagamento
                        titulo="MB Way"
                        descricao="Pagas no telemóvel"
                        iconeSrc="/icone/mbway.webp"
                        onClick={() => escolherMetodo("mbway")}
                        disabled={marcando}
                      />
                      <CartaoMetodoPagamento
                        titulo="Código QR"
                        descricao="O mesmo link, noutro telemóvel"
                        iconeSrc="/pagamento/qr-sumup-inscricao.svg"
                        onClick={() => setMostrarQr((v) => !v)}
                        ariaExpanded={mostrarQr}
                      />
                    </div>

                    {mostrarQr && <PainelQrSumup />}

                    {/* A pessoa pode ter conseguido pagar afinal (falso negativo —
                        a deteção vê o FECHO da janela, não o pagamento): o caminho
                        do comprovativo continua acessível daqui. */}
                    <button
                      type="button"
                      onClick={declararPagamento}
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
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

                {/* ── PASSO: MB Way (cabeçalho e voltar estão na zona fixa) ── */}
                {passo === "mbway" && (
                  <EcranMbWay
                    claro={claro}
                    valorText={VALOR_INSCRICAO_TEXT}
                    valorCopiar={String(VALOR_INSCRICAO)}
                    whatsappHref={linkWhatsAppPagamento("mbway")}
                    aoDeclararPagamento={declararPagamento}
                    textoBotaoDeclarar="Já fiz o pagamento"
                    textoPassoFinal="Depois de pagar, envia o comprovativo para garantirmos o teu lugar."
                  />
                )}

                {/* ── PASSO: Transferência (cabeçalho e voltar estão na zona fixa) ── */}
                {passo === "transferencia" && (
                  <EcranTransferencia
                    claro={claro}
                    valorText={VALOR_INSCRICAO_TEXT}
                    valorCopiar={String(VALOR_INSCRICAO)}
                    whatsappHref={linkWhatsAppPagamento("transferencia")}
                    aoDeclararPagamento={declararPagamento}
                    textoBotaoDeclarar="Já fiz a transferência"
                    referencia={`${primeiroNome} · Além do Espelho 2026`}
                  />
                )}

                {/* ── PASSO: comprovativo (cabeçalho e voltar estão na zona fixa) ── */}
                {passo === "comprovativo" && (
                  <div>
                    {/* Parabéns curto + aviso do email (spec Lucas, 06/09) — no
                        topo, antes de qualquer talk de upload: a pagante chega
                        aqui logo depois de pagar e o que muda de vida é o
                        email que vai receber, não o ficheiro. */}
                    <p
                      className={`mt-4 text-[0.9375rem] font-medium ${
                        claro ? "text-vinho" : "text-creme"
                      }`}
                    >
                      🎉 Pagamento declarado — falta só a prova.
                    </p>
                    <p
                      className={`mt-3 rounded-sm border px-4 py-3 text-[0.875rem] leading-relaxed ${
                        claro
                          ? "border-dourado-claro/40 bg-dourado-claro/[0.07] text-carvao/80"
                          : "border-dourado-claro/30 bg-dourado-claro/[0.07] text-creme/85"
                      }`}
                    >
                      Vais receber um email com o comprovativo da tua inscrição.
                    </p>

                    <p
                      className={`mt-4 text-[0.9375rem] leading-relaxed ${
                        claro ? "text-carvao/75" : "text-creme/75"
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
                          posseToken={posseToken}
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

  return montado ? (
    <>
      {createPortal(dialogo, document.body)}
      <ConfirmacaoSaidaModal
        aberto={aberto && confirmarSaida}
        manter={() => {
          confirmarSaidaRef.current = false;
          setConfirmarSaida(false);
        }}
        sair={() => {
          confirmarSaidaRef.current = false;
          setConfirmarSaida(false);
          fechar();
        }}
      />
    </>
  ) : null;
}
