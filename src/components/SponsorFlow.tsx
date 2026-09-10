"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import PatrocinioPagamentoModal from "./PatrocinioPagamentoModal";
import AgradecimentoSponsorModal from "./AgradecimentoSponsorModal";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import CartaoPatrocinadora from "./CartaoPatrocinadora";
import { patrocinadoresVisiveis } from "@/lib/patrocinadores";
import type { MetodoSponsor, NivelParceria } from "@/lib/validation";

/** Largura do modal por breakpoint (desktop/tablet). Mobile <768 não toca. */
function larguraModal() {
  if (typeof window === "undefined") return "64rem";
  const w = window.innerWidth;
  if (w >= 1440) return "84rem";      // 1344px
  if (w >= 1280) return "76rem";      // 1216px
  if (w >= 1024) return "68rem";      // 1088px
  if (w >= 768) return "44rem";       // 704px — 1 coluna
  return "64rem";                      // mobile: não tocar, mantém atual
}

/**
 * Fluxo "Quero Patrocinar" — SIMPLIFICADO (3 passos, como a inscrição):
 *
 *   A. apresentação + cadastro → quem já é patrocinadora (2 cartões),
 *      convocatória e FORM (nome/telemóvel/email/empresa opcional) com o
 *      NÍVEL DE PARCERIA ESCOLHIDO INLINE (rádio 75/150/200€). O POST
 *      /api/sponsor guarda logo o nível (p_nivel).
 *   B. pagamento → MB Way / transferência APENAS (sem cartão, sem QR), com
 *      os MESMOS ecrãs partilhados da inscrição (EcrasPagamentoMetodo). A
 *      escolha do método faz PATCH /api/sponsor/metodo
 *      (definir_metodo_sponsor) e "Já fiz a transferência/pagamento" termina.
 *   C. AGRADECIMENTO → AgradecimentoSponsorModal: recap dos dados de
 *      depósito + CTA WhatsApp verde para enviar o comprovativo à Vitória.
 *
 * Cada modal abre POR CIMA do anterior, que fica aberto — o contador de
 * scroll-lock chega à profundidade 3 (o fundo só destrava quando TODOS fecham).
 * Comportamento de fecho: X / clique fora fecham só o modal do topo → volta
 * ao passo anterior (com confirmação quando há progresso a perder). Sem
 * comprovativo na app e sem email por agora (ponto de extensão do EmailJS
 * marcado no Agradecimento). Nunca afirma pagamento confirmado — a Vitória
 * verifica à mão.
 */
export default function SponsorFlow() {
  const [apresentacaoAberto, setApresentacaoAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);

  // Fecho A com confirmação (r3, padrão InscricaoModal): o clique fora não
  // fecha e, com o formulário já preenchido, X e ESC pedem confirmação em vez
  // de descartar dados.
  const [sujo, setSujo] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const [nivel, setNivel] = useState<NivelParceria | null>(null);
  const [metodo, setMetodo] = useState<MetodoSponsor | null>(null);
  const [sponsorId, setSponsorId] = useState("");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState<string | null>(null);

  const [agradecimentoAberto, setAgradecimentoAberto] = useState(false);

  function fecharTudo() {
    setApresentacaoAberto(false);
    setPagamentoAberto(false);
  }

  // Cada abertura começa limpa (o formulário desmonta com a modal, mas o
  // estado daqui fica — repor para não confirmar saída com o form vazio).
  useEffect(() => {
    if (apresentacaoAberto) {
      setSujo(false);
      setConfirmarSaida(false);
    }
  }, [apresentacaoAberto]);

  /** X/ESC da modal A: com progresso a perder, pede confirmação primeiro. */
  function pedirFechar() {
    // Confirmação aberta → o ESC do fundo não faz nada: quem reage é a
    // confirmação (o ESC aí é "cancelar saída").
    if (confirmarSaida) return;
    if (sujo) {
      setConfirmarSaida(true);
      return;
    }
    setApresentacaoAberto(false);
  }

  /** Fim do fluxo: fecha o Agradecimento e limpa o estado para o próximo. */
  function fecharAgradecimento() {
    setAgradecimentoAberto(false);
    setNivel(null);
    setMetodo(null);
    setSponsorId("");
    setNome("");
    setEmpresa(null);
  }

  // Largura do modal responsiva + controle de layout colunas
  const [larguraModalAtual, setLarguraModalAtual] = useState("64rem");
  const [duasColunas, setDuasColunas] = useState(true);

  useEffect(() => {
    function atualizar() {
      setLarguraModalAtual(larguraModal());
      setDuasColunas(duasColunasModal());
    }
    atualizar();
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, []);

  function duasColunasModal() {
    if (typeof window === "undefined") return true;
    const w = window.innerWidth;
    if (w >= 768) return true;
    return false;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setApresentacaoAberto(true)}
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-vinho px-8 py-4 text-sm font-medium text-creme transition-colors duration-300 hover:bg-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        Quero Patrocinar
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </button>

      {/* ── A. APRESENTAÇÃO + CADASTRO (com nível inline no formulário) ── */}
      <Modal
        aberto={apresentacaoAberto}
        fechar={pedirFechar}
        titulo="Junta-te aos patrocinadores do Além do Espelho"
        eyebrow="Quero Patrocinar"
        larguraMax={larguraModalAtual}
        focoInicial={duasColunas ? "input:not([disabled])" : "h2"}
        fecharAoClicarFora={false}
      >
        <div
          data-modal-patrocinadores-grelha
          className={`flex flex-col gap-6 ${
            duasColunas
              ? "md:grid md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] md:gap-10"
              : ""
          }`}
        >
          {/* ESQUERDA — UMA SÓ LISTA com barra de rolagem para TODOS os
              patrocinadores (manter, não mexer), ordem por tier ouro → prata
              → bronze SEM badge (a ordem basta; campo destaque dos dados).
              Único scroll interno da coluna (≥768); <768 rola com o corpo da
              modal, sem max-height. */}
          <div className="min-w-0" data-coluna-patrocinadores>
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              O Além do Espelho é uma campanha que leva uma mensagem de coragem e
              recomeço a mais mulheres. Já há quem esteja nesta missão — regista-te
              abaixo e escolhe como queres apoiar.
            </p>

            <div
              data-lista-patrocinadores-scroll
              // Scroll NATIVO (sem JS): touch-action pan-y + momentum iOS vêm
              // do .scroll-ouro em globals.css; o cap dvh (≥768) também lá
              // está — aqui não há max-height para não brigar com o CSS.
              tabIndex={0}
              role="region"
              aria-label="Lista de patrocinadores (rolável)"
              className="scroll-ouro mt-6 space-y-4 overflow-y-auto overscroll-contain pr-1"
            >
              {[...patrocinadoresVisiveis()]
                .sort((a, b) => a.destaque - b.destaque)
                .map((p) => (
                  <CartaoPatrocinadora key={p.id} patrocinador={p} tom="escuro" />
                ))}
            </div>
          </div>

          {/* DIREITA — instrução + wizard de 2 sub-passos (r4: dados →
              nível+RGPD, no MESMO painel WaitlistForm). ≥768 tem cap dvh +
              scroll PRÓPRIO (globals.css [data-coluna-formulario]) — o
              formulário nunca rola dentro do scroll dos cards. A coluna é
              flex para o painel esticar e o CTA "Continuar" ancorar no fundo
              (mesma posição nos dois sub-passos). <768 rola com o corpo. */}
          <div className="min-w-0 md:flex md:flex-col" data-coluna-formulario>
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              Deixa os teus dados, escolhe o nível de parceria e o método de
              pagamento — tudo aqui, em menos de dois minutos.
            </p>

            <div className="mt-6 md:flex md:flex-1 md:flex-col">
              <WaitlistForm
                variant="sponsor"
                onSujoChange={setSujo}
                onSucesso={(dados) => {
                  if (!dados || dados.nivel === undefined || dados.nivel === null) return;
                  setSponsorId(dados.id);
                  setNome(dados.nome);
                  setEmpresa(dados.empresa ?? null);
                  setNivel(dados.nivel);
                  setPagamentoAberto(true); // a modal A fica aberta por baixo
                }}
              />
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmacaoSaidaModal
        aberto={apresentacaoAberto && confirmarSaida}
        manter={() => setConfirmarSaida(false)}
        sair={() => {
          setConfirmarSaida(false);
          setApresentacaoAberto(false);
        }}
        texto="Os dados do patrocínio ainda não foram guardados e perdem-se ao sair."
      />

      {/* ── B. PAGAMENTO (MB Way / transferência — sem cartão) ─────── */}
      {nivel !== null && sponsorId !== "" && (
        <PatrocinioPagamentoModal
          aberto={pagamentoAberto}
          fechar={() => setPagamentoAberto(false)}
          sponsorId={sponsorId}
          nome={nome}
          empresa={empresa}
          nivel={nivel}
          onDeclararPagamento={(metodoEscolhido) => {
            setMetodo(metodoEscolhido);
            fecharTudo(); // a cadeia A/pagamento fecha — o Agradecimento fica sozinho no topo
            setAgradecimentoAberto(true);
          }}
        />
      )}

      {/* ── C. AGRADECIMENTO — fecha o fluxo de patrocínio ─────────────── */}
      {metodo !== null && nivel !== null && (
        <AgradecimentoSponsorModal
          aberto={agradecimentoAberto}
          fechar={fecharAgradecimento}
          metodo={metodo}
          nivel={nivel}
          nome={nome}
          empresa={empresa}
        />
      )}
    </>
  );
}