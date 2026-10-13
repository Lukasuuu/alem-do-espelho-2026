"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { focaveis } from "./Modal";
import LocalImage from "./LocalImage";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import { SALON_WHATSAPP } from "@/lib/campanha";
import { linkWhatsApp, site } from "@/lib/site";
import { destravarScroll, travarScroll } from "@/lib/scroll-lock";
import {
  MENSAGEM_VAQUINHA_WHATSAPP,
  MENSAGENS_VAQUINHA,
  VAQUINHA_PAGAMENTO,
  formatarEuros,
  formatarEurosComCentimos,
  type TotaisVaquinha,
} from "@/lib/vaquinha";

type Passo = "metodos" | "mbway" | "transferencia" | "agradecimento";

type Pedido = { id: string; referencia: string; posseToken: string };

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Valor escolhido no cartão, em cêntimos. */
  valorCents: number;
  /** Chamado quando a declaração corre bem, com os totais já atualizados. */
  onDeclarada?: (totais: TotaisVaquinha | null) => void;
};

const TITULO_ID = "vaquinha-titulo";

/** Texto partilhado — verbatim do LEIA-ME (revisão 5) e sem a referência nem o
    valor doado: o que se partilha é a causa, não a contribuição de quem dá. */
const PARTILHA = {
  titulo: "Juntos por Angola",
  texto:
    "Contribuí para a vaquinha solidária da ONG Atos, no Além do Espelho. Cada contribuição, a partir de 5 €, apoia as mulheres apoiadas pela ONG Atos em Angola. Contribui também:",
};
const PARTILHA_URL = `${site.url}/alem-do-espelho-2026/vaquinha`;
const PARTILHA_DOMINIO = site.url.replace(/^https?:\/\//, "").toUpperCase();

/**
 * Folha da vaquinha (V4): método → dados + «Já fiz a doação» no mesmo ecrã →
 * agradecimento. SEM passo de comprovativo (decisão de 13/10: a referência é o
 * que a organização usa para confirmar) e SEM fecho automático no agradecimento
 * — em 5 s ninguém lê a pré-visualização nem carrega em «Partilhar a vaquinha»,
 * e a partilha é o objetivo daquele ecrã.
 *
 * Reutiliza o shell da folha de pagamento da inscrição (modal-pagamento-overlay
 * + modal-pagamento-conteudo, globals.css) DE PROPÓSITO: foi o fix de 13/10 em
 * produção (c0bb06f) — sem estas classes a folha era cortada em baixo a 390 px.
 * Se nascer com outra estrutura, o bug volta.
 *
 * Só se abre a confirmação de saída depois de /iniciar (ecrã de dados): quem
 * fecha na escolha do método ainda não começou nada e sai sem pergunta.
 */
export default function FolhaVaquinha({ aberto, fechar, valorCents, onDeclarada }: Props) {
  const [passo, setPasso] = useState<Passo>("metodos");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [totais, setTotais] = useState<TotaisVaquinha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [sairPendente, setSairPendente] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);
  const aberturaEm = useRef<number>(0);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  // Cada abertura começa do princípio (o valor vem do cartão).
  useEffect(() => {
    if (!aberto) return;
    setPasso("metodos");
    setPedido(null);
    setTotais(null);
    setErro(null);
    setMarcando(false);
    setSairPendente(false);
    aberturaEm.current = Date.now();
  }, [aberto]);

  /** Fechar passa pela confirmação só depois de haver pedido criado. */
  const pedirFecho = useCallback(() => {
    if (passo === "metodos" || passo === "agradecimento") {
      fechar();
      return;
    }
    setSairPendente(true);
  }, [passo, fechar]);

  // Trava de scroll, ESC, foco circular e devolução do foco — o mesmo contrato
  // do shell da inscrição.
  useEffect(() => {
    if (!aberto) return;
    abridorRef.current = document.activeElement as HTMLElement;
    travarScroll();

    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pedirFecho();
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

    const t = window.setTimeout(() => {
      painelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", aoTecla);
      window.clearTimeout(t);
      destravarScroll();
      abridorRef.current?.focus();
    };
  }, [aberto, pedirFecho]);

  /** Escolher método → /iniciar cria a doação e devolve referência + token. */
  async function escolher(metodo: "mbway" | "transferencia") {
    setErro(null);
    setMarcando(true);
    try {
      const r = await fetch("/api/vaquinha/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valorCents,
          metodo,
          // Chave anti duplo clique, gerada aqui e por cada tentativa.
          idemKey: crypto.randomUUID(),
          // Anti-bot: o campo invisível vai vazio e o tempo é o desta folha.
          website: "",
          elapsedMs: Date.now() - aberturaEm.current,
        }),
      });
      const dados = (await r.json()) as {
        ok: boolean;
        mensagem?: string;
        id?: string;
        referencia?: string;
        posseToken?: string;
      };
      if (!r.ok || !dados.ok || !dados.id || !dados.posseToken) {
        setErro(dados.mensagem ?? MENSAGENS_VAQUINHA.servidor);
        return;
      }
      setPedido({ id: dados.id, referencia: dados.referencia ?? "", posseToken: dados.posseToken });
      setPasso(metodo);
    } catch {
      setErro(MENSAGENS_VAQUINHA.servidor);
    } finally {
      setMarcando(false);
    }
  }

  /** «Já fiz a doação» → /declarar. O travão dos 10 s vive na base: se cair
      aqui, mostra-se a mensagem POR BAIXO do botão sem sair do ecrã. */
  async function declarar() {
    if (!pedido) return;
    setErro(null);
    setMarcando(true);
    try {
      const r = await fetch("/api/vaquinha/declarar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedido.id, posseToken: pedido.posseToken }),
      });
      const dados = (await r.json()) as { ok: boolean; mensagem?: string; totais?: TotaisVaquinha };
      if (!r.ok || !dados.ok) {
        setErro(dados.mensagem ?? MENSAGENS_VAQUINHA.servidor);
        return;
      }
      setTotais(dados.totais ?? null);
      setPasso("agradecimento");
      onDeclarada?.(dados.totais ?? null);
    } catch {
      setErro(MENSAGENS_VAQUINHA.servidor);
    } finally {
      setMarcando(false);
    }
  }

  const meta = totais?.meta_cents ?? 0;
  const confirmado = totais?.confirmado_cents ?? 0;
  const aConfirmar = totais?.contar_pendentes ? (totais?.a_confirmar_cents ?? 0) : 0;
  const pctC = meta > 0 ? Math.min(1, confirmado / meta) : 0;
  const pctP = meta > 0 ? Math.min(1 - pctC, aConfirmar / meta) : 0;

  const ctaRodape = (rotulo: string, aoClicar: () => void, comVisto = true) => (
    <button
      type="button"
      onClick={aoClicar}
      disabled={marcando}
      className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-vinho text-base font-semibold text-creme-neon transition-colors duration-300 hover:bg-vinho-claro disabled:cursor-wait disabled:opacity-70"
    >
      {comVisto && <Check className="h-[18px] w-[18px]" aria-hidden />}
      {rotulo}
    </button>
  );

  const linkWhats = (
    <a
      href={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_VAQUINHA_WHATSAPP)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex min-h-11 items-center justify-center gap-2 text-[0.84375rem] font-medium text-vinho"
    >
      <WhatsAppIcone />
      Tive um problema — falar no WhatsApp
    </a>
  );

  /** Linha de dados com botão de copiar (ícone só, 44 px), como na referência. */
  const linhaDados = (
    rotulo: string,
    valor: string,
    aCopiar: string,
    opcoes: { italico?: boolean; espacado?: boolean; tamanho?: string } = {}
  ) => (
    <div className="flex items-center gap-3 border-b border-[#f0e4d8] px-2 py-3 pl-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tinta-suave">
          {rotulo}
        </p>
        <p
          className={`mt-[3px] ${opcoes.tamanho ?? "text-[1.125rem]"} font-semibold ${
            opcoes.italico ? "font-medium italic text-tinta-suave" : "text-vinho"
          } ${opcoes.espacado ? "tracking-[0.08em]" : ""}`}
        >
          {valor}
        </p>
      </div>
      <BotaoCopiarIcone texto={aCopiar} rotulo={`Copiar ${rotulo.toLowerCase()}`} />
    </div>
  );

  const dialogo = (
    <AnimatePresence>
      {aberto && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay modal-overlay-top modal-pagamento-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => {
            if (e.target === overlayRef.current) pedirFecho();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={TITULO_ID}
        >
          <motion.div
            ref={painelRef}
            className="modal-content modal-pagamento-conteudo"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl bg-creme-neon text-vinho md:rounded-sm">
              {/* ── Cabeçalho fixo (não sai com o scroll; é aqui que vive o X) ── */}
              <div
                className={`relative z-10 flex-none pr-[76px] ${
                  passo === "agradecimento"
                    ? "px-5 pt-2"
                    : "border-b border-[#ecdccc] px-5 pb-3.5 pt-[18px]"
                }`}
              >
                {passo === "metodos" && (
                  <div className="flex items-center justify-between gap-3">
                    <h2 id={TITULO_ID} className="display m-0 text-[1.5rem] font-medium leading-[1.15]">
                      A tua contribuição
                    </h2>
                    <span className="display whitespace-nowrap text-[1.625rem] font-semibold">
                      {formatarEurosComCentimos(valorCents)}
                    </span>
                  </div>
                )}

                {(passo === "mbway" || passo === "transferencia") && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPasso("metodos")}
                      className="-ml-1 inline-flex min-h-9 items-center gap-1.5 text-[0.8125rem] text-tinta-suave"
                    >
                      <ChevronEsquerda />
                      Escolher outro método
                    </button>
                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <h2
                        id={TITULO_ID}
                        className="display m-0 flex items-center gap-2.5 text-[1.625rem] font-medium leading-[1.1]"
                      >
                        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-[#eadccd] bg-white">
                          <LocalImage
                            src={passo === "mbway" ? "/icone/mbway.webp" : "/icone/mb-transferencia.webp"}
                            alt=""
                            width={256}
                            height={256}
                            className="h-[26px] w-[26px] object-contain"
                          />
                        </span>
                        {passo === "mbway" ? "MB Way" : "Transferência"}
                      </h2>
                      <span className="display whitespace-nowrap text-[1.625rem] font-semibold">
                        {formatarEurosComCentimos(valorCents)}
                      </span>
                    </div>
                  </>
                )}

                {passo === "agradecimento" && (
                  <h2 id={TITULO_ID} className="sr-only">
                    Obrigada pela tua contribuição
                  </h2>
                )}

                <button
                  type="button"
                  onClick={pedirFecho}
                  aria-label="Fechar"
                  className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-areia text-vinho"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* ── Conteúdo (com o CTA encostado ao fundo, como na referência) ── */}
              <div className="modal-pagamento-scroll min-h-0 flex-1 overflow-y-auto px-5">
                <div className="flex min-h-full flex-col pb-6 pt-[18px]">
                  {passo === "metodos" && (
                    <>
                      <p className="m-0 mb-0.5 text-[0.875rem] text-tinta-suave">
                        Escolhe como queres pagar.
                      </p>

                      <CartaoMetodoVaquinha
                        titulo="MB Way"
                        descricao="Pagas no telemóvel"
                        iconeSrc="/icone/mbway.webp"
                        onClick={() => escolher("mbway")}
                        disabled={marcando}
                      />
                      <CartaoMetodoVaquinha
                        titulo="Transferência"
                        descricao="IBAN direto"
                        iconeSrc="/icone/mb-transferencia.webp"
                        onClick={() => escolher("transferencia")}
                        disabled={marcando}
                      />

                      <p className="mt-1.5 rounded-[10px] bg-blush/30 px-3.5 py-3 text-[0.8125rem] leading-[1.5]">
                        No passo seguinte vês os dados para pagar e confirmas lá mesmo. Sem
                        comprovativo.
                      </p>

                      {erro && (
                        <p role="alert" className="mt-3 text-[0.8125rem] font-medium text-vinho-profundo">
                          {erro}
                        </p>
                      )}

                      <div className="mt-8 flex min-h-14 items-center gap-3 border-t border-[#ecdccc] pt-3.5">
                        <LocalImage
                          src="/causa/ong-atos-icone.webp"
                          alt=""
                          width={256}
                          height={256}
                          className="w-[34px]"
                        />
                        <span className="text-[0.75rem] font-semibold tracking-[0.12em] text-malva">
                          VAQUINHA SOLIDÁRIA · ONG ATOS
                        </span>
                      </div>

                      <a
                        href={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_VAQUINHA_WHATSAPP)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 flex min-h-11 items-center gap-2.5 text-[0.875rem] font-medium text-vinho"
                      >
                        <WhatsAppIcone />
                        Precisas de ajuda? Fala connosco no WhatsApp
                      </a>
                    </>
                  )}

                  {passo === "mbway" && (
                    <>
                      <ol className="m-0 list-decimal pl-5 text-[0.90625rem] leading-[1.55]">
                        <li>
                          Na app MB Way, escolhe <strong>Enviar dinheiro</strong>.
                        </li>
                        <li className="mt-1">
                          Envia <strong>{formatarEurosComCentimos(valorCents)}</strong> para o número
                          abaixo.
                        </li>
                        <li className="mt-1">
                          Na mensagem, escreve a <strong>referência</strong>.
                        </li>
                      </ol>

                      <div className="mt-4 rounded-xl border border-selo-borda bg-white">
                        {linhaDados(
                          "Número MB Way",
                          VAQUINHA_PAGAMENTO.mbwayNumero ?? "[número de doações]",
                          (VAQUINHA_PAGAMENTO.mbwayNumero ?? "").replace(/\s/g, ""),
                          { italico: !VAQUINHA_PAGAMENTO.mbwayNumero }
                        )}
                        {linhaDados("Valor", formatarEurosComCentimos(valorCents), String(valorCents / 100))}
                        {linhaDados("Referência — escreve na mensagem", pedido?.referencia ?? "—", pedido?.referencia ?? "", {
                          espacado: true,
                        })}
                      </div>

                      <p className="mt-3.5 text-[0.8125rem] leading-[1.5] text-tinta-suave">
                        A referência ajuda-nos a confirmar a tua contribuição. Não precisas de enviar
                        comprovativo.
                      </p>

                      <div className="mt-auto pt-4">
                        {ctaRodape("Já fiz a doação", declarar)}
                        {erro && (
                          <p
                            role="alert"
                            className="mt-2 text-center text-[0.8125rem] font-medium text-vinho-profundo"
                          >
                            {erro}
                          </p>
                        )}
                        {linkWhats}
                      </div>
                    </>
                  )}

                  {passo === "transferencia" && (
                    <>
                      <p className="m-0 text-[0.90625rem] leading-[1.5]">
                        Faz a transferência no teu banco com estes dados e põe a{" "}
                        <strong>referência no descritivo</strong>.
                      </p>

                      <div className="mt-3.5 rounded-xl border border-selo-borda bg-white">
                        {linhaDados(
                          "Beneficiário",
                          VAQUINHA_PAGAMENTO.transferencia?.beneficiario ?? "[nome do titular da conta]",
                          VAQUINHA_PAGAMENTO.transferencia?.beneficiario ?? "",
                          { italico: !VAQUINHA_PAGAMENTO.transferencia, tamanho: "text-base" }
                        )}
                        {linhaDados(
                          "IBAN",
                          VAQUINHA_PAGAMENTO.transferencia?.iban ?? "[IBAN de doações]",
                          (VAQUINHA_PAGAMENTO.transferencia?.iban ?? "").replace(/\s/g, ""),
                          { italico: !VAQUINHA_PAGAMENTO.transferencia, tamanho: "text-base" }
                        )}
                        {linhaDados("Valor", formatarEurosComCentimos(valorCents), String(valorCents / 100), {
                          tamanho: "text-[1.0625rem]",
                        })}
                        {linhaDados("Descritivo", pedido?.referencia ?? "—", pedido?.referencia ?? "", {
                          espacado: true,
                          tamanho: "text-[1.0625rem]",
                        })}
                      </div>

                      <p className="mt-3.5 text-[0.8125rem] leading-[1.5] text-tinta-suave">
                        A referência ajuda-nos a confirmar a tua contribuição. Não precisas de enviar
                        comprovativo.
                      </p>

                      <div className="mt-auto pt-4">
                        {ctaRodape("Já fiz a doação", declarar)}
                        {erro && (
                          <p
                            role="alert"
                            className="mt-2 text-center text-[0.8125rem] font-medium text-vinho-profundo"
                          >
                            {erro}
                          </p>
                        )}
                        {linkWhats}
                      </div>
                    </>
                  )}

                  {passo === "agradecimento" && (
                    <div className="flex flex-1 flex-col items-center text-center">
                      <LocalImage
                        src="/causa/ong-atos-lockup.webp"
                        alt="ONG Atos"
                        width={256}
                        height={256}
                        className="w-[58px]"
                      />
                      <h3 className="display mt-2.5 text-[2.75rem] font-medium leading-none">Obrigada!</h3>
                      <p className="mt-2 text-base leading-[1.45]">
                        A tua contribuição de <strong>{formatarEuros(valorCents)}</strong> já aparece na
                        barra.
                      </p>
                      {pedido?.referencia && (
                        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-blush/30 px-3.5 py-1.5 text-[0.8125rem]">
                          Referência{" "}
                          <strong className="tracking-[0.08em]">{pedido.referencia}</strong>
                        </p>
                      )}

                      <div className="mt-3.5 w-full rounded-xl border border-[#ecdccc] bg-white px-4 py-3 text-left">
                        <div className="flex items-baseline justify-between">
                          <span className="display text-[1.625rem] font-semibold leading-none">
                            {formatarEuros(confirmado)}
                          </span>
                          <span className="text-[0.78125rem] text-tinta-suave">
                            meta {formatarEuros(meta)}
                          </span>
                        </div>
                        <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-blush">
                          <span
                            aria-hidden
                            className="absolute inset-0 origin-left rounded-full bg-vinho"
                            style={{ transform: `scaleX(${pctC})` }}
                          />
                          <span
                            aria-hidden
                            className="absolute inset-0 origin-left"
                            style={{
                              transform: `translateX(${pctC * 100}%) scaleX(${pctP})`,
                              backgroundImage:
                                "repeating-linear-gradient(45deg, var(--color-rosa) 0 3.5px, var(--color-risca) 3.5px 7px)",
                            }}
                          />
                        </div>
                        <p className="mt-[7px] text-[0.75rem] leading-[1.4] text-tinta-suave">
                          O valor arrecadado atualiza quando confirmarmos o recebimento.
                        </p>
                      </div>

                      <div className="mt-4 w-full text-left">
                        <p className="m-0 text-[0.71875rem] font-semibold tracking-[0.1em] text-tinta-suave">
                          AJUDA A CHEGAR MAIS LONGE
                        </p>
                        <p className="mt-[3px] text-[0.78125rem] text-tinta-suave">
                          É isto que vai aparecer a quem receber o teu link:
                        </p>

                        {/* Pré-visualização ESTÁTICA do que sai na partilha — não é
                            um componente de terceiros, é o desenho da 07. */}
                        <div className="mt-2 overflow-hidden rounded-xl border border-selo-borda bg-white">
                          <div className="flex h-[92px] items-center border-b border-[#ecdccc] bg-creme-neon">
                            <div className="flex h-[92px] w-[92px] flex-none items-center justify-center border-r border-selo-borda bg-blush/30">
                              <LocalImage
                                src="/causa/ong-atos-icone.webp"
                                alt=""
                                width={256}
                                height={256}
                                className="w-14"
                              />
                            </div>
                            <div className="px-3.5">
                              <p className="m-0 text-[0.53125rem] font-semibold tracking-[0.18em] text-malva">
                                VAQUINHA SOLIDÁRIA · ONG ATOS
                              </p>
                              <p className="display mt-1 text-[1.5625rem] font-medium leading-none">
                                Juntos por Angola
                              </p>
                            </div>
                          </div>
                          <div className="px-3 pb-2.5 pt-[9px]">
                            <p className="m-0 text-[0.84375rem] font-semibold leading-[1.3]">
                              Juntos por Angola — Vaquinha solidária da ONG Atos
                            </p>
                            <p className="mt-0.5 text-[0.75rem] leading-[1.4] text-tinta-suave">
                              Contribui a partir de 5 € e ajuda as mulheres apoiadas pela ONG Atos, em
                              Angola.
                            </p>
                            <p className="mt-[3px] text-[0.65625rem] tracking-[0.06em] text-tinta-suave">
                              {PARTILHA_DOMINIO}
                            </p>
                          </div>
                        </div>

                        <BotaoPartilhar />
                        <p className="mt-1.5 text-center text-[0.75rem] text-tinta-suave">
                          Escolhes onde: WhatsApp, Instagram, Facebook e outras.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={fechar}
                        className="mt-auto h-[46px] w-full rounded-full border border-vinho text-[0.9375rem] font-medium text-vinho"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {montado ? createPortal(dialogo, document.body) : null}
      <ConfirmacaoSaidaModal
        aberto={sairPendente}
        manter={() => setSairPendente(false)}
        sair={() => {
          setSairPendente(false);
          fechar();
        }}
        texto="A tua contribuição fica por declarar — podes voltar e retomar daqui a pouco."
      />
    </>
  );
}

/* ── Peças locais (não existem no projeto com esta forma; ver notas) ──────────
   O BotaoCopiar partilhado mostra texto ("Copiar"/"Copiado!"); a referência
   pede um botão só com ícone. Em vez de mexer no componente partilhado (usado
   nos ecrãs de pagamento da inscrição, três dias antes do evento), fica aqui
   uma versão só-ícone, com a mesma lógica de clipboard.

   O ícone da Atos vem por LocalImage: a forma em "V" e a palavra são contorno
   escuro — só funcionam sobre fundo claro, nunca sobre o bordô. */

function BotaoCopiarIcone({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (t.current !== null) window.clearTimeout(t.current);
    },
    []
  );
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={!texto}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(texto)
          .then(() => {
            setCopiado(true);
            if (t.current !== null) window.clearTimeout(t.current);
            t.current = window.setTimeout(() => setCopiado(false), 1600);
          })
          .catch(() => {
            /* contexto não seguro: silêncio, como no BotaoCopiar partilhado */
          });
      }}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-selo-borda bg-creme-neon text-vinho disabled:opacity-50"
    >
      {copiado ? <Check className="h-[18px] w-[18px]" aria-hidden /> : <Copy className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}

function CartaoMetodoVaquinha({
  titulo,
  descricao,
  iconeSrc,
  onClick,
  disabled,
}: {
  titulo: string;
  descricao: string;
  iconeSrc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 flex min-h-[66px] w-full items-center gap-3 rounded-md border border-selo-borda bg-white p-3 text-left transition-colors duration-200 hover:border-vinho/40 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded border border-[#eadccd] bg-creme-neon">
        <LocalImage src={iconeSrc} alt="" width={256} height={256} className="h-[30px] w-[30px] object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-vinho">{titulo}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-tinta-suave">{descricao}</span>
      </span>
      <ChevronDireita />
    </button>
  );
}

/** Partilha: `navigator.share` e, onde ele não existe, cópia do texto + link. */
function BotaoPartilhar() {
  const [copiado, setCopiado] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const dados = {
            title: PARTILHA.titulo,
            text: PARTILHA.texto,
            url: PARTILHA_URL,
          };
          if (typeof navigator !== "undefined" && navigator.share) {
            try {
              await navigator.share(dados);
            } catch (erro) {
              // Fechar a folha sem escolher lança AbortError: não é erro.
              if ((erro as Error)?.name !== "AbortError") console.error("[vaquinha] partilha falhou:", erro);
            }
            return;
          }
          try {
            await navigator.clipboard.writeText(`${PARTILHA.texto} ${PARTILHA_URL}`);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2500);
          } catch {
            /* sem clipboard: fica só o botão; não rebenta o agradecimento */
          }
        }}
        className="mt-3 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-vinho text-base font-semibold text-creme-neon transition-colors duration-300 hover:bg-vinho-claro"
      >
        <PartilhaIcone />
        Partilhar a vaquinha
      </button>
      {copiado && (
        <p role="status" className="mt-1.5 text-center text-[0.8125rem] font-medium text-vinho">
          Mensagem copiada — cola onde quiseres.
        </p>
      )}
    </>
  );
}

/* Ícones inline: os traços dos mockups não têm equivalente exato no lucide com
   o peso certo (2–2.2), e estes são 5 linhas cada. */
const traco = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ChevronEsquerda = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden {...traco}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const ChevronDireita = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden
    className="flex-none text-tinta-suave"
    {...traco}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const WhatsAppIcone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="flex-none" {...traco} stroke="#1f9e4f">
    <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12z" />
  </svg>
);
const PartilhaIcone = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...traco}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);
