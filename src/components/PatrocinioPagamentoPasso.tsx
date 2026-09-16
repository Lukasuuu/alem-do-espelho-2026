"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MbWayIcon, TransferenciaIcon } from "./icons";
import { EcranMbWay, EcranTransferencia } from "./EcrasPagamentoMetodo";
import { linkWhatsAppPatrocinio } from "@/lib/sponsor";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

type Props = {
  sponsorId: string;
  /** Nome completo (o 1.º nome entra na referência da transferência). */
  nome: string;
  /** Empresa/marca, opcional — entra na mensagem do WhatsApp (Bloco J r2). */
  empresa?: string | null;
  /** Nível de parceria escolhido INLINE no formulário (75 / 150 / 200€). */
  nivel: NivelParceria;
  /**
   * Fim do fluxo de pagamento: a pessoa marcou "Já fiz a
   * transferência/pagamento". O pai fecha a modal A e abre o Agradecimento.
   * Nunca se afirma pagamento confirmado — a Vitória confirma à parte.
   */
  onDeclararPagamento?: (metodo: MetodoSponsor) => void;
  /** Navega de volta ao formulário (substitui o X da antiga modal). */
  onVoltar: () => void;
};

type Passo = "metodos" | "dados";

/**
 * Etapa de pagamento do patrocínio — EMBUTIDA no painel do formulário da
 * modal "Quero Patrocinar" (r7): substitui a antiga PatrocinioPagamentoModal
 * (portal, focus-trap e scroll-lock próprios), que abria POR CIMA com outra
 * geometria. Agora vive no MESMO contentor persistente do formulário
 * ([data-coluna-formulario]) — a troca formulário ⇄ pagamento não muda a
 * largura, a altura nem a posição do painel (a grelha de painéis mede a
 * altura pelos 3 cards e não muda com o passo).
 *
 * O painel raiz replica as classes do <form> do WaitlistForm (espelho
 * rounded-sm p-6 sm:p-9) para a etapa ter a MESMA área visual; min-h-full +
 * min-height:auto do flex faz o painel encher a coluna quando o conteúdo é
 * curto (o "Já fiz…" ancora no fundo) e crescer quando é longo (a coluna
 * rola — todos os campos e botões continuam acessíveis).
 *
 * FLUXO (2 passos, igual à antiga modal):
 *   1. MÉTODOS — MB Way ou transferência (PATCH /api/sponsor/metodo →
 *      RPC definir_metodo_sponsor, 2-arg — a viva em produção).
 *   2. INSTRUÇÕES — os MESMOS ecrãs partilhados da inscrição
 *      (EcrasPagamentoMetodo). "Já fiz…" → onDeclararPagamento.
 *
 * Sem comprovativo na app, sem upload, sem polling: o comprovativo vai à
 * Vitória por WhatsApp (como na inscrição). O foco entra no 1.º botão da
 * etapa e o painel alinha-se ao topo da coluna (mobile: a modal rola até lá).
 */
export default function PatrocinioPagamentoPasso({
  sponsorId,
  nome,
  empresa,
  nivel,
  onDeclararPagamento,
  onVoltar,
}: Props) {
  const raizRef = useRef<HTMLDivElement>(null);
  const [passo, setPasso] = useState<Passo>("metodos");
  const [marcando, setMarcando] = useState(false);
  const [erroMetodo, setErroMetodo] = useState<string | null>(null);
  const [metodoEscolhido, setMetodoEscolhido] = useState<MetodoSponsor | null>(null);

  // Ao entrar na etapa: foco no 1.º botão (o scroll acompanha o foco —
  // necessário no mobile, onde a coluna/formulário está abaixo da lista) e
  // painel alinhado ao topo da coluna.
  useEffect(() => {
    const t = window.setTimeout(() => {
      raizRef.current
        ?.querySelector<HTMLElement>("button:not([disabled]), a[href]")
        ?.focus();
      raizRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

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
      // Novo passo → o foco volta ao topo da etapa (o botão "Voltar").
      window.setTimeout(() => {
        raizRef.current
          ?.querySelector<HTMLElement>("button:not([disabled]), a[href]")
          ?.focus();
      }, 60);
    } catch {
      setErroMetodo("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setMarcando(false);
    }
  }

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
        className="group flex w-full items-center gap-4 rounded-sm border border-creme/20 bg-creme/5 p-4 text-left transition-all duration-300 hover:border-creme/40 hover:bg-creme/[0.08] disabled:cursor-wait disabled:opacity-60"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-creme/25 text-blush"
          aria-hidden
        >
          {icone}
        </span>
        <span className="flex-1">
          {/* r4 — cor explícita: text-inherit puxava o carvão do body e
              deixava os títulos MB Way/Transferência escuros sobre o vinho. */}
          <span className="block text-[0.9375rem] font-medium text-creme">{titulo}</span>
          <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-creme/60">
            {descricao}
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-creme/40 transition-transform duration-300 group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>
    );
  }

  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";

  // Dados partilhados dos ecrãs de instrução — IGUAIS aos da inscrição, só
  // muda o valor (nível) e a copy "para confirmarmos o teu patrocínio".
  const valorText = `${nivel.toFixed(2).replace(".", ",")} €`;
  const valorCopiar = String(nivel);
  const whatsappHref =
    metodoEscolhido !== null
      ? linkWhatsAppPatrocinio(metodoEscolhido, nivel, nome, empresa)
      : "";

  return (
    /* MESMA área visual do painel do formulário: mesmas classes do <form>
       do WaitlistForm (espelho rounded-sm p-6 sm:p-9, flex-col). min-h-full
       enche a coluna quando o conteúdo é curto (o painel do formulário
       também enche — md:flex-1) e o conteúdo cresce em fluxo quando é longo
       (a coluna [data-coluna-formulario] é quem rola, como no formulário). */
    <div
      ref={raizRef}
      data-painel-pagamento
      className="espelho flex min-h-full flex-col rounded-sm p-6 sm:p-9"
    >
      {/* ── PASSO: métodos ── */}
      {passo === "metodos" && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-4">
            <span className="eyebrow text-dourado-claro/70">Patrocínio</span>
            <span className="display text-3xl text-blush tabular-nums">{nivel}€</span>
          </div>

          <h2 className="display mt-4 text-[1.75rem] leading-[1.05] text-creme sm:text-[2.125rem]">
            Escolhe a forma de pagamento
          </h2>

          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-creme/70">
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

          {/* Nota ancorada ao fundo do painel (mt-auto), como na antiga
              modal — só alinhamento, copy intacta. */}
          <p className="mt-auto pt-8 text-center text-[0.75rem] leading-relaxed text-creme/45">
            Sem cartão no site — transferência bancária ou MB Way.
          </p>
        </div>
      )}

      {/* ── PASSO: instruções — MESMOS ecrãs da inscrição (componente
             partilhado), com o valor do nível e a copy de patrocínio. ── */}
      {passo === "dados" && metodoEscolhido !== null && (
        <div className="flex flex-1 flex-col">
          {/* "Voltar" substitui o X da antiga modal: navega de volta ao
              formulário (que continua montado no mesmo contentor — nenhum
              dado se perde; o método já ficou guardado no PATCH). */}
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex min-h-11 items-center gap-2 text-[0.8125rem] text-creme/60 hover:text-creme"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao formulário
          </button>

          <h2 className="display mt-5 flex items-center gap-3 text-[1.75rem] leading-[1.05] text-creme sm:text-[2.125rem]">
            {metodoEscolhido === "mbway" ? (
              <MbWayIcon className="h-7 w-7 text-blush" />
            ) : (
              <TransferenciaIcon className="h-7 w-7 text-blush" />
            )}
            {metodoEscolhido === "mbway" ? "MB Way" : "Transferência bancária"}
          </h2>

          <p className="mt-4 text-[0.9375rem] leading-relaxed text-creme/75">
            {metodoEscolhido === "mbway"
              ? `Efetua o pagamento de ${nivel}€ pelo MB Way para confirmarmos o teu patrocínio.`
              : `Efetua a transferência de ${nivel}€ para confirmarmos o teu patrocínio.`}
          </p>

          {metodoEscolhido === "mbway" ? (
            <EcranMbWay
              claro={false}
              valorText={valorText}
              valorCopiar={valorCopiar}
              whatsappHref={whatsappHref}
              aoDeclararPagamento={() => onDeclararPagamento?.(metodoEscolhido)}
              textoBotaoDeclarar="Já fiz o pagamento"
              textoPassoFinal="Volta aqui e marca “Já fiz o pagamento”."
              ancorarBotaoFundo
            />
          ) : (
            <EcranTransferencia
              claro={false}
              valorText={valorText}
              valorCopiar={valorCopiar}
              whatsappHref={whatsappHref}
              aoDeclararPagamento={() => onDeclararPagamento?.(metodoEscolhido)}
              textoBotaoDeclarar="Já fiz a transferência"
              referencia={`${primeiroNome} · Patrocínio Além do Espelho 2026`}
              ancorarBotaoFundo
            />
          )}
        </div>
      )}
    </div>
  );
}