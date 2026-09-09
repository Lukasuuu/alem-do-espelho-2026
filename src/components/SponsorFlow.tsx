"use client";

import { useState, useEffect } from "react";
import { Check, ChevronRight } from "lucide-react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import PatrocinioPagamentoModal from "./PatrocinioPagamentoModal";
import ParabensModal from "./ParabensModal";
import ConfirmacaoSaidaModal from "./ConfirmacaoSaidaModal";
import CartaoPatrocinadora from "./CartaoPatrocinadora";
import { patrocinadoresVisiveis } from "@/lib/patrocinadores";
import { NIVEIS_PARCERIA_COPY, linkWhatsAppPatrocinio } from "@/lib/sponsor";
import { NIVEIS_PARCERIA, type MetodoSponsor, type NivelParceria } from "@/lib/validation";

/** Largura do modal por breakpoint (desktop/tablet). Mobile <768 não toca. */
function larguraModal() {
  if (typeof window === "undefined") return "64rem";
  const w = window.innerWidth;
  if (w >= 1440) return "84rem";      // 1344px
  if (w >= 1280) return "76rem";      // 1216px
  if (w >= 1024) return "68rem";      // 1088px
  // 768–1023 (tablet, muitas vezes portrait): aqui JÁ há 2 colunas (duasColunasModal
  // é true desde 768), portanto o painel não pode ser o 44rem antigo (704px esmagava
  // o formulário em ~300px) — preenche o viewport até 64rem. O overlay já dá 1rem
  // de respiro de cada lado (padding horizontal de .modal-overlay), por isso
  // calc(100vw - 2rem) é exatamente o máximo disponível.
  if (w >= 768) return "min(64rem, calc(100vw - 2rem))";
  return "64rem";                      // mobile: não tocar, mantém atual
}

/**
 * Fluxo "Quero Patrocinar" (FASE5, CORREÇÃO nº3) — cadeia de 3 modais EMPILHADOS:
 *
 *   A. apresentação + cadastro → quem já é patrocinadora (2 cartões), convocatória
 *      e FORM (nome/telemóvel/email/empresa opcional/consentimento RGPD). O nível
 *      NÃO é escolhido aqui — o POST /api/sponsor guarda o registo com nivel null.
 *   B. confirmação + escolha do nível → texto da CORREÇÃO nº5, 3 níveis estilo
 *      "anexo2" com benefícios e badge MAIS PROCURADO; PATCH /api/sponsor/nivel.
 *   C. pagamento → MB Way / transferência apenas (sem cartão, sem QR); a escolha
 *      do método faz PATCH /api/sponsor/metodo e "Já fiz o pagamento" fecha a cadeia.
 *
 * Cada modal abre POR CIMA do anterior, que fica aberto — o contador de
 * scroll-lock chega à profundidade 3 (o fundo só destrava quando TODOS fecham).
 * Comportamento de fecho (igual ao anterior, agora a 3 modais):
 *   - ✕ / clique fora fecham só o modal do topo → volta ao passo anterior;
 *   - ESC fecha a cadeia toda (todos os modais escutam ESC ao mesmo tempo).
 * O fluxo fecha no PARABÉNS partilhado (ParabensModal, contexto "patrocinio"):
 * o "Já fiz o pagamento" abre-o por cima e termina a cadeia. Sem comprovativo
 * e sem email por agora (ponto de extensão do EmailJS marcado no ParabensModal).
 * Nunca afirma pagamento confirmado — a Vitória verifica à mão.
 */
export default function SponsorFlow() {
  const [apresentacaoAberto, setApresentacaoAberto] = useState(false);
  const [nivelAberto, setNivelAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);

  // Fecho A com confirmação (r3, padrão InscricaoModal): o clique fora não
  // fecha e, com o formulário já preenchido, X e ESC pedem confirmação em vez
  // de descartar dados.
  const [sujo, setSujo] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const [nivel, setNivel] = useState<NivelParceria | null>(null);
  const [sponsorId, setSponsorId] = useState("");
  const [nome, setNome] = useState("");

  const [escolhendoNivel, setEscolhendoNivel] = useState(false);
  const [erroNivel, setErroNivel] = useState<string | null>(null);

  const [parabensAberto, setParabensAberto] = useState(false);
  const [metodo, setMetodo] = useState<MetodoSponsor | null>(null);

  function fecharTudo() {
    setApresentacaoAberto(false);
    setNivelAberto(false);
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

  /** Fim do fluxo: fecha o Parabéns e limpa o estado para o próximo patrocínio. */
  function fecharParabens() {
    setParabensAberto(false);
    setNivel(null);
    setSponsorId("");
    setNome("");
    setMetodo(null);
  }

  /** Passo B: marca o nível no registo (POST ainda tinha nivel null). */
  async function escolherNivel(valor: NivelParceria) {
    setEscolhendoNivel(true);
    setErroNivel(null);
    try {
      const resposta = await fetch("/api/sponsor/nivel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, nivel: valor }),
      });
      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setErroNivel(dados.mensagem ?? "Não conseguimos guardar o nível. Tenta novamente.");
        return;
      }

      setNivel(valor);
      setPagamentoAberto(true); // o modal B fica aberto por baixo
    } catch {
      setErroNivel("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setEscolhendoNivel(false);
    }
  }

  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";

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

      {/* ── A. APRESENTAÇÃO + CADASTRO — lista única com scroll (correção
              pós-r3): card HORIZONTAL de produção + 3 deltas (foto maior,
              logo menor, MISSÃO em toggle). Ordem por tier ouro → prata →
              bronze sem badge; fecho só pelo X + ConfirmaçãoSaida. ── */}
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
              ? "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10"
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
              // do .scroll-ouro em globals.css; ≥768 a lista enche o resto da
              // altura da coluna (flex-1, ver grelha em globals.css).
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

          {/* DIREITA — instrução + formulário. ≥768 as duas colunas ficam com
              a MESMA altura (grelha minmax(0,1fr) em globals.css) e o
              formulário rola SÓ aqui dentro quando transborda — nunca dentro
              do scroll dos cards. <768 rola com o corpo. */}
          <div className="min-w-0" data-coluna-formulario>
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              Deixa os teus dados para começares. A seguir escolhes o nível de
              parceria e o método de pagamento — tudo aqui, em menos de dois minutos.
            </p>

            <div className="mt-6">
              <WaitlistForm
                variant="sponsor"
                onSujoChange={setSujo}
                onSucesso={(dados) => {
                  if (!dados) return;
                  setSponsorId(dados.id);
                  setNome(dados.nome);
                  setNivelAberto(true); // o modal A fica aberto por baixo
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

      {/* ── B. CONFIRMAÇÃO + ESCOLHA DO NÍVEL ──────────────────────── */}
      <Modal
        aberto={nivelAberto}
        fechar={() => setNivelAberto(false)}
        titulo="Escolhe o teu nível de parceria"
        eyebrow="Quero Patrocinar"
        larguraMax="34rem"
        fecharAoClicarFora={false}
      >
        <p className="text-[0.9375rem] leading-relaxed text-creme/70">
          {primeiroNome ? `${primeiroNome}, recebemos os teus dados.` : "Recebemos os teus dados."}{" "}
          Escolhe o nível de parceria e conclui o pagamento para confirmares o
          teu patrocínio.
        </p>

        <div className="mt-6 space-y-3">
          {NIVEIS_PARCERIA.map((valor) => {
            const copy = NIVEIS_PARCERIA_COPY[valor];
            return (
              <button
                key={valor}
                type="button"
                onClick={() => escolherNivel(valor)}
                disabled={escolhendoNivel}
                className="group flex w-full items-start gap-4 rounded-sm border border-creme/20 bg-creme/5 p-4 text-left transition-all duration-300 hover:border-creme/40 hover:bg-creme/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="display shrink-0 text-3xl text-blush tabular-nums">
                  {valor}€
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9375rem] font-medium text-creme">
                      {copy.titulo}
                    </span>
                    {copy.maisProcurado && (
                      <span className="rounded-full border border-dourado/50 bg-dourado/10 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-dourado-claro">
                        Mais procurado
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[0.8125rem] leading-relaxed text-creme/60">
                    {copy.descricao}
                  </span>
                  {copy.vagas && (
                    <span className="mt-2 block text-[0.75rem] font-medium text-dourado-claro/80">
                      Apenas {copy.vagas} {copy.vagas === 1 ? "vaga" : "vagas"}
                    </span>
                  )}
                  {copy.beneficios.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {copy.beneficios.map((beneficio) => (
                        <li
                          key={beneficio}
                          className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-creme/65"
                        >
                          <Check
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blush"
                            aria-hidden
                          />
                          {beneficio}
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
                <ChevronRight
                  className="mt-1 h-4 w-4 shrink-0 text-creme/40 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        {erroNivel && (
          <p
            role="alert"
            className="mt-4 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
          >
            {erroNivel}
          </p>
        )}
      </Modal>

      {/* ── C. PAGAMENTO (MB Way / transferência — sem cartão) ─────── */}
      {nivel !== null && sponsorId !== "" && (
        <PatrocinioPagamentoModal
          aberto={pagamentoAberto}
          fechar={() => setPagamentoAberto(false)}
          sponsorId={sponsorId}
          nome={nome}
          nivel={nivel}
          onPago={(metodoEscolhido) => {
            setMetodo(metodoEscolhido);
            fecharTudo(); // a cadeia A/B/C fecha — o Parabéns fica sozinho no topo
            setParabensAberto(true);
          }}
        />
      )}

      {/* ── PARABÉNS (partilhado) — fecha o fluxo de patrocínio ─────────── */}
      {metodo !== null && nivel !== null && (
        <ParabensModal
          aberto={parabensAberto}
          fechar={fecharParabens}
          contexto="patrocinio"
          nivelLabel={NIVEIS_PARCERIA_COPY[nivel].titulo}
          ctaWhatsApp={linkWhatsAppPatrocinio(metodo, nivel)}
        />
      )}
    </>
  );
}

