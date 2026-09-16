"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import PatrocinioPagamentoPasso from "./PatrocinioPagamentoPasso";
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
  // 768–1023 (tablet, muitas vezes portrait): aqui JÁ há 2 colunas (duasColunasModal
  // é true desde 768), portanto o painel não pode ser o 44rem antigo (704px esmagava
  // o formulário em ~300px) — preenche o viewport até 64rem. O overlay já dá 1rem
  // de respiro de cada lado (padding horizontal de .modal-overlay), por isso
  // calc(100vw - 2rem) é exatamente o máximo disponível.
  if (w >= 768) return "min(64rem, calc(100vw - 2rem))";
  return "64rem";                      // mobile: não tocar, mantém atual
}

/**
 * Fluxo "Quero Patrocinar" — SIMPLIFICADO (3 passos, como a inscrição):
 *
 *   A. apresentação + cadastro → quem já é patrocinadora (2 cartões),
 *      convocatória e FORM (nome/telemóvel/email/empresa opcional) com o
 *      NÍVEL DE PARCERIA ESCOLHIDO INLINE (rádio 75/150/200€). O POST
 *      /api/sponsor guarda logo o nível (p_nivel).
 *   B. pagamento → MB Way / transferência APENAS (sem cartão, sem QR), EMBUTIDO
 *      no painel do formulário (r7 — PatrocinioPagamentoPasso: o painel troca
 *      de conteúdo sem mudar de largura/altura/posição). A escolha do método
 *      faz PATCH /api/sponsor/metodo (definir_metodo_sponsor) e "Já fiz a
 *      transferência/pagamento" termina.
 *   C. AGRADECIMENTO → AgradecimentoSponsorModal: recap dos dados de
 *      depósito + CTA WhatsApp verde para enviar o comprovativo à Vitória.
 *
 * r7 — GEOMETRIA DA MODAL A (spec "3 cards"):
 *   - As frases de apresentação ficam FORA dos painéis (linha própria acima).
 *   - Uma grelha de painéis ([data-grelha-paineis]) com a janela da lista
 *     (esquerda) e o contentor persistente do formulário/etapa de pagamento
 *     (direita) — ambos com a MESMA altura externa, medida em runtime: o
 *     topo do 4.º cartão = 3 cartões recolhidos + 2 intervalos (var
 *     --tres-cards-h, ResizeObserver + resize, sem ciclos — só escreve
 *     quando o valor arredondado muda). NADA de slice/paginação: a lista
 *     inteira está no DOM; o 4.º cartão aparece ao rolar DENTRO da janela.
 *   - A modal inteira (.modal-content) rola quando o conjunto não cabe no
 *     viewport (mobile: apresentação → painel 3 cards → formulário). O gesto
 *     nunca fica preso: sem overscroll-contain na lista, ao chegar ao limite
 *     o scroll continua na modal.
 *
 * Comportamento de fecho: X / clique fora fecham só o passo do topo → volta
 * ao passo anterior (com confirmação quando há progresso a perder — dados
 * escritos no formulário OU método de pagamento já escolhido). Sem
 * comprovativo na app e sem email por agora (ponto de extensão do EmailJS
 * marcado no Agradecimento). Nunca afirma pagamento confirmado — a Vitória
 * verifica à mão.
 */
export default function SponsorFlow() {
  const [apresentacaoAberto, setApresentacaoAberto] = useState(false);
  // r7 — o passo de pagamento vive DENTRO da modal A (painel do formulário
  // troca de conteúdo; o formulário continua montado, só escondido).
  const [passoFluxo, setPassoFluxo] = useState<"form" | "pagamento">("form");

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
    setPassoFluxo("form");
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
    // Na etapa de pagamento há progresso a perder (método já PATCHado)
    // mesmo que o form não esteja "sujo" — confirma sempre aí também.
    if (sujo || passoFluxo === "pagamento") {
      setConfirmarSaida(true);
      return;
    }
    setApresentacaoAberto(false);
  }

  /** Fim do fluxo: fecha o Agradecimento e limpa o estado para o próximo. */
  function fecharAgradecimento() {
    setAgradecimentoAberto(false);
    setPassoFluxo("form");
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

  const listaRef = useRef<HTMLDivElement>(null);
  const grelhaPaineisRef = useRef<HTMLDivElement>(null);

  // r6 — pistas da lista (fade + "mais patrocinadores"): marcadas no fim.
  // Só escreve um atributo — o scroll continua 100% nativo, sem listeners
  // de wheel/touch nem preventDefault.
  const marcarFimDaLista = useCallback(() => {
    const el = listaRef.current;
    const col = el?.closest("[data-coluna-patrocinadores]");
    if (!el || !col) return;
    const noFim = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    col.setAttribute("data-atbottom", String(noFim));
  }, []);
  // medirTresCards chama marcarFimDaLista (a altura da janela muda com a
  // medição) — ref para não puxar dependências do callback de medição.
  const marcarFimDaListaRef = useRef(marcarFimDaLista);
  marcarFimDaListaRef.current = marcarFimDaLista;

  // r7 — FONTE COMUM DA ALTURA DOS PAINÉIS: o fundo do 3.º cartão, medido
  // em coordenadas de conteúdo da lista (rect diff + scrollTop), é exatamente
  // 3 cartões recolhidos + os 2 intervalos entre eles. Escrito como
  // --tres-cards-h na grelha de painéis; o CSS dá essa altura à janela da
  // lista E ao painel do formulário (iguais em TODAS as larguras). A medida
  // é independente da altura do contentor (o conteúdo flui por inteiro), por
  // isso mudar a var não altera o valor medido — sem ciclos.
  const medirTresCards = useCallback(() => {
    const lista = listaRef.current;
    const grelha = grelhaPaineisRef.current;
    if (!lista || !grelha) return;
    const cartoes = lista.querySelectorAll<HTMLElement>("[data-cartao-patrocinador]");
    if (cartoes.length < 3) return;
    // Fundo do 3.º cartão = 3 cartões recolhidos + os 2 intervalos ENTRE eles
    // (o topo do 4.º incluiria o 3.º intervalo — sobrava um oco de 16px no
    // fundo da janela). Em coordenadas de conteúdo (rect diff + scrollTop).
    const h3 =
      cartoes[2].getBoundingClientRect().bottom -
      lista.getBoundingClientRect().top +
      lista.scrollTop;
    // round(1px) filtra sub-pixel; comparar ANTES de escrever evita o loop
    // ResizeObserver → write → ResizeObserver.
    const proximo = `${Math.round(h3)}px`;
    if (grelha.style.getPropertyValue("--tres-cards-h") !== proximo) {
      grelha.style.setProperty("--tres-cards-h", proximo);
    }
    marcarFimDaListaRef.current();
  }, []);

  // Medição: ao abrir (estado inicial), em cada resize E quando o conteúdo
  // muda (imagens que carregam, fontes, acordeão da missão aberto/fechado —
  // a altura externa mantém-se, o valor dos 3 cards é que muda). Observar os
  // PRÓPRIOS cartões: a caixa da lista tem altura fixa (a var medida), por
  // isso só os cartões avisam quando o conteúdo interno muda de tamanho
  // (ex. troca de fonte). fonts.ready cobre o reflow tipográfico final.
  useEffect(() => {
    if (!apresentacaoAberto) return;
    medirTresCards();
    const ro = new ResizeObserver(() => medirTresCards());
    if (listaRef.current) ro.observe(listaRef.current);
    if (grelhaPaineisRef.current) ro.observe(grelhaPaineisRef.current);
    listaRef.current
      ?.querySelectorAll<HTMLElement>("[data-cartao-patrocinador]")
      .forEach((c) => ro.observe(c));
    document.fonts?.ready.then(() => medirTresCards()).catch(() => {});
    // Cinto e suspensório: alguns reflows tardios (swap de fonte local, decode
    // de imagens) não disparam o RO dos cartões — re-medir em 3 instantes
    // após a abertura cobre o período de estabilização. Escrita guardada
    // (compara antes) → sem ciclos; timeouts limpos no cleanup.
    const t1 = window.setTimeout(medirTresCards, 150);
    const t2 = window.setTimeout(medirTresCards, 500);
    const t3 = window.setTimeout(medirTresCards, 1200);
    window.addEventListener("resize", medirTresCards);
    return () => {
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("resize", medirTresCards);
    };
  }, [apresentacaoAberto, medirTresCards]);

  // Estado inicial das pistas (lista no topo) e re-verificação no resize e
  // na troca de passo: a lista transborda ou não conforme o viewport — sem
  // isto, uma lista que caiba inteira mostrava pistas de "há mais" falsas.
  useEffect(() => {
    if (apresentacaoAberto) marcarFimDaLista();
  }, [apresentacaoAberto, passoFluxo, duasColunas, marcarFimDaLista]);
  useEffect(() => {
    function aoRedimensionar() {
      marcarFimDaLista();
    }
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [marcarFimDaLista]);

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
          ref={grelhaPaineisRef}
          data-modal-patrocinadores-grelha
          className="flex flex-col gap-6"
        >
          {/* r7 — frases de apresentação FORA dos painéis de altura igual
              (linha própria acima da grelha, uma por coluna no ≥768). */}
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              O Além do Espelho é uma campanha que leva uma mensagem de coragem e
              recomeço a mais mulheres. Já há quem esteja nesta missão — regista-te
              abaixo e escolhe como queres apoiar.
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              Deixa os teus dados, escolhe o nível de parceria e o método de
              pagamento — tudo aqui, em menos de dois minutos.
            </p>
          </div>

          {/* r7 — GRELHA DE PAINÉIS: janela da lista (esquerda) e contentor
              persistente do formulário/etapa de pagamento (direita), com a
              MESMA altura externa (--tres-cards-h, acima). <768 empilha na
              ordem apresentação → patrocinadores → formulário e a modal
              inteira (.modal-content) rola até ao formulário. */}
          <div data-grelha-paineis className="grid gap-6 md:grid-cols-2 md:gap-10">
            {/* ESQUERDA — JANELA DA LISTA: mostra exatamente 3 cartões
                completos (a altura vem da medição); TODOS os patrocinadores
                estão no DOM (sem slice/paginação) — os restantes aparecem
                rolando DENTRO da janela. Ordens por tier ouro → prata →
                bronze SEM badge (a ordem basta; campo destaque dos dados).
                r7 — sem overscroll-contain: no limite da lista o gesto
                continua pela modal (spec — nunca prender o scroll). */}
            <div className="relative min-h-0 min-w-0" data-coluna-patrocinadores>
              <div
                ref={listaRef}
                data-lista-patrocinadores-scroll
                // Scroll NATIVO (sem JS): touch-action pan-y + momentum iOS
                // vêm do .scroll-ouro em globals.css. r6: onScroll só marca
                // as pistas (fade/hint) no fim da lista.
                onScroll={marcarFimDaLista}
                tabIndex={0}
                role="region"
                aria-label="Lista de patrocinadores (rolável)"
                className="scroll-ouro h-full space-y-4 overflow-y-auto pr-1"
              >
                {[...patrocinadoresVisiveis()]
                  .sort((a, b) => a.destaque - b.destaque)
                  .map((p) => (
                    <CartaoPatrocinadora key={p.id} patrocinador={p} tom="escuro" />
                  ))}
              </div>

              {/* r6 — pistas visuais de "há mais patrocinadores" (decorativas;
                  o fade usa o vinho real da modal, ver .pista-lista-fade em
                  globals.css; saem quando a lista chega ao fim). */}
              <div className="pista-lista-fade" aria-hidden="true" />
              <p className="pista-lista-hint" aria-hidden="true">
                ↓ Mais patrocinadores
              </p>
            </div>

            {/* DIREITA — CONTENTOR PERSISTENTE (r7): o formulário e a etapa
                de pagamento vivem NO MESMO painel — a troca de passo muda
                só o conteúdo interno; largura/altura/posição mantêm-se (a
                altura vem da grelha, não do passo). O formulário continua
                MONTADO quando a etapa de pagamento está ativa (display:none
                inline vence as classes Tailwind sem brigar com elas). */}
            <div className="min-h-0 min-w-0 md:flex md:flex-col" data-coluna-formulario>
              <div
                hidden={passoFluxo !== "form"}
                data-passo-formulario
                className="min-h-0 md:flex md:flex-1 md:flex-col"
                style={passoFluxo === "form" ? undefined : { display: "none" }}
              >
                <WaitlistForm
                  variant="sponsor"
                  onSujoChange={setSujo}
                  onSucesso={(dados) => {
                    if (!dados || dados.nivel === undefined || dados.nivel === null) return;
                    setSponsorId(dados.id);
                    setNome(dados.nome);
                    setEmpresa(dados.empresa ?? null);
                    setNivel(dados.nivel);
                    setPassoFluxo("pagamento"); // mesma área, outro conteúdo
                  }}
                />
              </div>

              {passoFluxo === "pagamento" && nivel !== null && sponsorId !== "" && (
                <PatrocinioPagamentoPasso
                  sponsorId={sponsorId}
                  nome={nome}
                  empresa={empresa}
                  nivel={nivel}
                  onVoltar={() => setPassoFluxo("form")}
                  onDeclararPagamento={(metodoEscolhido) => {
                    setMetodo(metodoEscolhido);
                    fecharTudo(); // a modal A fecha — o Agradecimento fica sozinho no topo
                    setAgradecimentoAberto(true);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* r7 — confirmação de saída da modal A, com texto conforme o passo:
          formulário preenchido OU etapa de pagamento aberta (método já
          guardado) são progresso a perder. */}
      <ConfirmacaoSaidaModal
        aberto={apresentacaoAberto && confirmarSaida}
        manter={() => setConfirmarSaida(false)}
        sair={() => {
          setConfirmarSaida(false);
          setApresentacaoAberto(false);
        }}
        texto={
          passoFluxo === "pagamento"
            ? "Escolheste o método de pagamento, mas o patrocínio ainda não está confirmado."
            : "Os dados do patrocínio ainda não foram guardados e perdem-se ao sair."
        }
      />

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