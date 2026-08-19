"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Check, ChevronRight } from "lucide-react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import PatrocinioPagamentoModal from "./PatrocinioPagamentoModal";
import ParabensModal from "./ParabensModal";
import CartaoPatrocinadora from "./CartaoPatrocinadora";
import { NIVEIS_PARCERIA_COPY, linkWhatsAppPatrocinio } from "@/lib/sponsor";
import { NIVEIS_PARCERIA, type MetodoSponsor, type NivelParceria } from "@/lib/validation";
import { patrocinadoresVisiveis, type Patrocinador } from "@/lib/patrocinadores";

// ── D2 — refs partilhadas entre SponsorFlow e VerticalSponsorCarousel ─────
// cartaoLigiaRef: aponta para o wrapper do cartão da Lígia (zona fixa).
// colunaFormularioRef: aponta para o div direito (formulário) — ResizeObserver.
const cartaoLigiaRef = { current: null as HTMLDivElement | null };
const colunaFormularioRef = { current: null as HTMLDivElement | null };
const GAP_CARTAO_LIGIA = 24;

const EASE_SUAVE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* Entrada em cascata dos cartões (REESCRITA 2.5) — stagger ~0.15s, só transform+opacity. */
const variantesLista = {
  oculto: { opacity: 0, y: 12 },
  visivel: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.15, delayChildren: 0.05 },
  },
};
const variantesItem = {
  oculto: { opacity: 0, y: 12 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_SUAVE } },
};

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

/** Se grau 3 a par cabe em 2 colunas (min 200px cada) a 1024-1439px. */
function grau3DuasColunas() {
  if (typeof window === "undefined") return true;
  const w = window.innerWidth;
  if (w >= 1440) return true;  // 3 colunas
  if (w >= 1024) {
    // coluna esquerda ≈ 58% de (larguraModal - gap - padding)
    // larguraModal a 1024-1279 = 68rem = 1088px
    // 58% de ~1000px ≈ 580px; menos 2*gap(1.5rem=24px) + padding ≈ 530px; /2 = 265px > 200px ✓
    return true;
  }
  return false;
}

/** Patrocinadores visíveis para a Modal A (5 itens) */
const visiveis = patrocinadoresVisiveis();

/** Lígia (grau 1) — fixa no topo, NÃO entra no carrossel */
const ligia = visiveis.find((p) => p.destaque === 1);

/** Carrossel vertical: graus 2 e 3 (Andreia, Renata, Daniella, Lucas) */
const carrossel = visiveis.filter((p) => p.destaque !== 1);

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

  // Agrupar patrocinadores por destaque — memoizado para evitar re-renders
  const patrocinadoresPorDestaque = useMemo(() => {
    const visiveis = patrocinadoresVisiveis();
    const porDestaque = new Map<number, Patrocinador[]>();
    for (const p of visiveis) {
      if (!porDestaque.has(p.destaque)) porDestaque.set(p.destaque, []);
      porDestaque.get(p.destaque)!.push(p);
    }

    const ordemDestaque = [1, 2, 3] as const;
    return ordemDestaque
      .map((grau) => ({ grau, lista: porDestaque.get(grau) ?? [] }))
      .filter(({ lista }) => lista.length > 0);
  }, []);

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

      {/* ── A. APRESENTAÇÃO + CADASTRO — largura responsiva, scroll interno, header sticky ── */}
      <Modal
        aberto={apresentacaoAberto}
        fechar={() => setApresentacaoAberto(false)}
        titulo="Junta-te aos patrocinadores do Além do Espelho"
        eyebrow="Quero Patrocinar"
        larguraMax={larguraModalAtual}
        focoInicial={duasColunas ? "input:not([disabled])" : "h2"}
      >
        <div
          className={`flex flex-col gap-6 ${
            duasColunas
              ? "md:grid md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] md:items-start md:gap-10"
              : ""
          }`}
        >
          {/* ESQUERDA — Zona Fixa (Lígia) + Carrossel Vertical */}
          <div className="min-w-0" data-coluna-patrocinadores>
            {/* Header sticky: eyebrow + título + subtítulo */}
            <div className="sticky top-0 z-10 bg-vinho pb-4 sm:pb-6">
              <p className="text-[0.9375rem] leading-relaxed text-creme/70 pr-4">
                O Além do Espelho é uma campanha que leva uma mensagem de coragem e
                recomeço a mais mulheres. Já há quem esteja nesta missão — regista-te
                abaixo e escolhe como queres apoiar.
              </p>
            </div>

            {/* ── ZONA FIXA: Lígia Santos (grau 1) — NÃO entra no carrossel ── */}
            {ligia && (
              <div ref={cartaoLigiaRef}>
                <CartaoPatrocinadora
                  key={ligia.id}
                  patrocinador={ligia}
                  tom="escuro"
                />
              </div>
            )}

            {/* ── CARROSSEL VERTICAL: graus 2 e 3 (Andreia, Renata, Daniella, Lucas) ── */}
            <VerticalSponsorCarousel
              patrocinadores={carrossel}
              cartaoLigiaRef={cartaoLigiaRef}
              colunaFormularioRef={colunaFormularioRef}
            />
          </div>

          {/* DIREITA — instrução + formulário */}
          <div className="min-w-0" data-coluna-formulario>
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              Deixa os teus dados para começares. A seguir escolhes o nível de
              parceria e o método de pagamento — tudo aqui, em menos de dois minutos.
            </p>

            <div className="mt-6">
              <WaitlistForm
                variant="sponsor"
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

      {/* ── B. CONFIRMAÇÃO + ESCOLHA DO NÍVEL ──────────────────────── */}
      <Modal
        aberto={nivelAberto}
        fechar={() => setNivelAberto(false)}
        titulo="Escolhe o teu nível de parceria"
        eyebrow="Quero Patrocinar"
        larguraMax="34rem"
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

/**
 * Carrossel Vertical Infinito de Patrocinadores (Modal A)
 *
 * Adaptado do padrão validado em MarqueeLogos.tsx:
 * - Web Animations API com translateY(0 → -50%)
 * - Track = 2× o bloco base (costura perfeita)
 * - Repetições calculadas para a metade encher sempre a janela
 * - Travão de veludo (rAF + decaimento exponencial, ~400ms)
 * - Pausas: pointerenter/leave, focusin/out, IntersectionObserver, visibilitychange
 * - Hover no cartão → destaque (foto scale + fio luminosidade + outros opacity)
 * - Pausa em hover/focus satisfaz WCAG 2.2.2 (sem gate de reduced-motion — alinhado com MarqueeLogos)
 * - Cleanup completo: cancelar rAF, animation.cancel(), desligar observers/listeners
 */
function VerticalSponsorCarousel({
  patrocinadores,
  cartaoLigiaRef,
  colunaFormularioRef,
}: {
  patrocinadores: Patrocinador[];
  cartaoLigiaRef: { current: HTMLDivElement | null };
  colunaFormularioRef: { current: HTMLDivElement | null };
}) {
  const [montado, setMontado] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [repeticoes, setRepeticoes] = useState(2);
  const [janelaAltura, setJanelaAltura] = useState(320);
  const [blocoBaseAltura, setBlocoBaseAltura] = useState(0);
  const hoveredIndexRef = useRef<number | null>(null);
  // Refs para callbacks de hover (acessíveis no JSX)
  const onCartaoEnterRef = useRef<((index: number) => void) | null>(null);
  const onCartaoLeaveRef = useRef<(() => void) | null>(null);

  // Parâmetros do carrossel
  const VELOCIDADE_PX_S = 20; // 18–24 px/s (mais lento: texto exige leitura)
  const TAU_MS = 105; // travão de veludo
  const TOLERANCIA = 0.02;
  const MIN_REPETICOES = 2;
  const ALTURA_MIN_JANELA = 320; // D2: limite inferior explícito do utilizador
  const GAP_CARTAO = 12; // gap entre cartões no carrossel

  // 1) Marcar como montado
  useEffect(() => {
    setMontado(true);
  }, []);

  // 2) D2 — medir a coluna do formulário e derivar a altura da janela do
  //    carrossel. Mede DEPOIS de as imagens decodificarem. ResizeObserver
  //    recalcula sempre que a coluna muda de altura (erros de validação,
  //    banners, consentimento, etc.).
  const medirColunaFormulario = useCallback(async () => {
    // Mobile (<768px): layout em 1 coluna — a D2 foi desenhada para 2 colunas
    // (alinhar o carrossel com o formulário à direita). Aqui não há coluna à
    // direita, pelo que se fixa a janela em 280px (~1,5 cartões de 221px).
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setJanelaAltura(280);
      return;
    }
    const coluna =
      colunaFormularioRef.current ??
      (document.querySelector("[data-coluna-formulario]") as HTMLElement | null);
    if (!coluna) return;
    // Esperar imagens decodificarem — sem isto a altura vem errada.
    const imgs = Array.from(coluna.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.decode?.().catch(() => undefined) ?? Promise.resolve(undefined)
      )
    );
    const alturaFormulario = coluna.getBoundingClientRect().height;
    const alturaLigia =
      cartaoLigiaRef.current?.getBoundingClientRect().height ?? 0;
    const vh = window.innerHeight;
    // CASO 2: o teto desconta o TOPO REAL da janela (header sticky + cartão da
    // Lígia acima do carrossel), não um fixo vh-192. Sem isto, em viewports
    // <1200px de altura o fundo da janela ultrapassava o viewport
    // (bottomOk=false em 5/7 breakpoints). 24px de respiro inferior.
    const topoJanela = containerRef.current?.getBoundingClientRect().top ?? 0;
    const maxVh = vh - topoJanela - 24;
    // tetoConteudo = alinhar com a coluna do formulário (espaço abaixo da
    // Lígia e altura total da coluna). O min() com espacoPorColuna é redundante
    // (espacoAbaixoLigia < espacoPorColuna sempre) mas mantém-se explícito.
    const espacoAbaixoLigia = alturaFormulario - alturaLigia - GAP_CARTAO_LIGIA;
    const tetoConteudo = Math.min(espacoAbaixoLigia, alturaFormulario);
    // O piso só se aplica se houver altura para ele; caso contrário o maxVh
    // (viewport) vence — garante bottomOk sem sacrificar o piso no geral.
    const alvo = Math.min(maxVh, Math.max(ALTURA_MIN_JANELA, tetoConteudo));
    setJanelaAltura(alvo);
  }, [cartaoLigiaRef, colunaFormularioRef, containerRef]);

  useEffect(() => {
    if (!montado) return;
    medirColunaFormulario();
    const coluna = document.querySelector(
      "[data-coluna-formulario]"
    ) as HTMLElement | null;
    if (!coluna) return;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      // Debounce de 50ms para evitar flickering durante fade-in do modal.
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        medirColunaFormulario();
      }, 50);
    });
    ro.observe(coluna);
    window.addEventListener("resize", medirColunaFormulario);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medirColunaFormulario);
      if (debounceId) clearTimeout(debounceId);
    };
  }, [montado, medirColunaFormulario]);

  // 3) Medir altura do bloco base (uma passada pelos patrocinadores) — NÃO o track completo
  //    Estratégia: no primeiro mount, o track renderiza com MIN_REPETICOES (2) × 2 = 4 blocos totais.
  //    A altura de UM bloco base = scrollHeight total / 4. Essa medição é estável.
  useEffect(() => {
    if (!montado || !trackRef.current) return;

    const track = trackRef.current;
    // O track tem (repeticoes * 2) blocos. No primeiro mount, repeticoes = MIN_REPETICOES = 2,
    // logo totalBlocos = 4. A altura de um bloco = scrollHeight / 4.
    const totalBlocos = repeticoes * 2;
    if (totalBlocos > 0) {
      const alturaUmBloco = track.scrollHeight / totalBlocos;
      if (alturaUmBloco > 0 && Math.abs(alturaUmBloco - blocoBaseAltura) > 1) {
        setBlocoBaseAltura(alturaUmBloco);
      }
    }
  }, [montado, repeticoes, blocoBaseAltura]);

  // 4) Repetições calculadas — a pista enche sempre a janela
  //    Baseado na altura de UM bloco base (não do track completo)
  useEffect(() => {
    if (!montado || blocoBaseAltura <= 0) return;

    const calcular = () => {
      const n = Math.max(MIN_REPETICOES, Math.ceil(janelaAltura / blocoBaseAltura));
      setRepeticoes((anterior) => (anterior === n ? anterior : n));
    };
    calcular();
    // Não precisamos de ResizeObserver aqui porque blocoBaseAltura já é estável
    // (a altura de um bloco não muda com resize da janela)
  }, [montado, janelaAltura, blocoBaseAltura]);

  // 4) Animação WAAPI + travão de veludo + pausas
  useEffect(() => {
    if (!montado) return;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const elContainer: HTMLDivElement = container;
    const elTrack: HTMLDivElement = track;

    let animacao: Animation | null = null;
    let alturaAtual = 0;
    let rafId = 0;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    let destruido = false;

    let velocidade = 1;
    let alvoVelocidade = 1;
    let pausadoFora = false;
    let foraEcrã = false;

    function criarAnimacao() {
      const distancia = elTrack.scrollHeight / 2;
      if (distancia <= 0) return;
      const duracao = (distancia / VELOCIDADE_PX_S) * 1000;

      const durSpec = animacao?.effect?.getTiming().duration;
      const durAntiga = typeof durSpec === "number" ? durSpec : 0;
      const proporcao =
        animacao && durAntiga > 0
          ? (Number(animacao.currentTime) % durAntiga) / durAntiga
          : 0;

      animacao?.cancel();
      animacao = elTrack.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }],
        { duration: duracao, iterations: Infinity, easing: "linear" }
      );
      if (proporcao > 0) {
        // re-criação (RO: imagens carregaram / scrollHeight mudou): manter o
        // progresso actual para o utilizador não ver um salto.
        animacao.currentTime = proporcao * duracao;
      } else {
        // arranque novo: offset aleatório para a modal abrir com os cartões já
        // a meio do ciclo (não ver o arranque alinhado no topo).
        animacao.currentTime = Math.random() * duracao;
      }
      animacao.updatePlaybackRate(velocidade);
    }

    function passo(alvo: number) {
      if (rafId) cancelAnimationFrame(rafId);
      let ultimoT = performance.now();
      const tick = (agora: number) => {
        const dt = Math.min(agora - ultimoT, 100);
        ultimoT = agora;
        if (Math.abs(velocidade - alvo) < TOLERANCIA) {
          velocidade = alvo;
          animacao?.updatePlaybackRate(alvo);
          return;
        }
        velocidade += (alvo - velocidade) * (1 - Math.exp(-dt / TAU_MS));
        animacao?.updatePlaybackRate(velocidade);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    function aplicar() {
      if (pausadoFora) {
        if (rafId) cancelAnimationFrame(rafId);
        animacao?.pause();
        return;
      }
      if (rafId) cancelAnimationFrame(rafId);
      animacao?.play();
      passo(alvoVelocidade);
    }

    function definirAlvo(alvo: number) {
      if (alvo === alvoVelocidade) return;
      alvoVelocidade = alvo;
      aplicar();
    }

    function definirPausaFora(valor: boolean) {
      if (pausadoFora === valor) return;
      const saiuDePausa = pausadoFora && !valor;
      pausadoFora = valor;
      if (saiuDePausa) velocidade = alvoVelocidade;
      aplicar();
    }

    // Interação com cartão individual (hover destaca esse cartão)
    // Atribuídos às refs para serem acessíveis no JSX
    onCartaoEnterRef.current = (index: number) => {
      hoveredIndexRef.current = index;
      definirAlvo(0);
    };
    onCartaoLeaveRef.current = () => {
      hoveredIndexRef.current = null;
      definirAlvo(1);
    };

    // Ponteiro no contentor (pausa geral)
    const aoEntrar = () => definirAlvo(0);
    const aoSair = () => definirAlvo(1);
    const aoCancelar = () => definirAlvo(1);
    const aoSairJanela = () => {
      if (!document.hasFocus()) definirAlvo(1);
    };

    // Foco por teclado (WCAG): só pausa se o foco estiver DENTRO da janela
    // do carrossel. Foco no formulário (à direita) não pausa — está fora do
    // containerRef e o utilizador quer ler/escrever enquanto o carrossel
    // continua o seu loop.
    const aoFoco = (e: FocusEvent) => {
      if (elContainer.contains(e.target as Node)) definirAlvo(0);
    };
    const aoSairFoco = (e: FocusEvent) => {
      if (!elContainer.contains(e.relatedTarget as Node | null)) definirAlvo(1);
    };

    // Pausa fora de ecrã / tab oculta
    const aoVisibilidade = () => {
      definirPausaFora(document.hidden || foraEcrã);
    };

    // Arranque: a animação é translateY em % do track — só precisa de o track
    // ter altura (layout), NÃO de as imagens decodificarem. Os cartões reservam
    // o espaço das imagens, pelo que o track já tem scrollHeight no mount; o
    // ResizeObserver recria a animação quando as imagens carregarem (preser-
    // vando o progresso). Antes esperava-se img.decode() com fallback de 2500ms
    // — o que causava ~2,5s de carrossel parado ao abrir a modal, mesmo com o
    // track já laid out (medido: track scrollHeight=3672px a t=0ms).
    let iniciado = false;
    function iniciar() {
      if (destruido || iniciado) return;
      iniciado = true;
      alturaAtual = elTrack.scrollHeight;
      criarAnimacao();

      ro = new ResizeObserver(() => {
        const h = elTrack.scrollHeight;
        if (h === alturaAtual) return;
        alturaAtual = h;
        criarAnimacao();
      });
      ro.observe(elTrack);

      io = new IntersectionObserver(
        (entradas) => {
          foraEcrã = !entradas[0]?.isIntersecting;
          definirPausaFora(document.hidden || foraEcrã);
        },
        { threshold: 0.01 }
      );
      io.observe(elContainer);

      elContainer.addEventListener("pointerenter", aoEntrar);
      elContainer.addEventListener("pointerleave", aoSair);
      elContainer.addEventListener("pointercancel", aoCancelar);
      elContainer.addEventListener("focusin", aoFoco);
      elContainer.addEventListener("focusout", aoSairFoco);
      window.addEventListener("blur", aoSairJanela);
      window.addEventListener("pointerleave", aoSairJanela);
      document.addEventListener("visibilitychange", aoVisibilidade);
    }

    const rafIniciar = requestAnimationFrame(() => iniciar());

    return () => {
      destruido = true;
      cancelAnimationFrame(rafIniciar);
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      elContainer.removeEventListener("pointerenter", aoEntrar);
      elContainer.removeEventListener("pointerleave", aoSair);
      elContainer.removeEventListener("pointercancel", aoCancelar);
      elContainer.removeEventListener("focusin", aoFoco);
      elContainer.removeEventListener("focusout", aoSairFoco);
      window.removeEventListener("blur", aoSairJanela);
      window.removeEventListener("pointerleave", aoSairJanela);
      document.removeEventListener("visibilitychange", aoVisibilidade);
      animacao?.cancel();
    };
  }, [montado, repeticoes]);

  // Fallback antes de montar no client
  if (!montado) {
    return (
      <div className="space-y-3" role="list" aria-label="Patrocinadores em carrossel" data-carrossel-modo="pre-mount">
        {patrocinadores.map((p) => (
          <CartaoPatrocinadora key={p.id} patrocinador={p} tom="escuro" />
        ))}
      </div>
    );
  }

  // Carrossel vertical ativo
  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Patrocinadores do Além do Espelho — rolagem automática, pausa ao passar o rato"
      className="relative overflow-clip [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]"
      style={{ height: janelaAltura }}
      data-carrossel-modo="animado"
    >
      <div ref={trackRef} className="flex flex-col" data-carrossel-track>
        {Array.from({ length: repeticoes * 2 }).map((_, bloco) => (
          <div key={bloco} className="flex flex-col" style={{ gap: 12 }} aria-hidden={bloco !== 0 || undefined}>
            {patrocinadores.map((p, idx) => (
              <CartaoPatrocinadora
                key={`${bloco}-${p.id}`}
                patrocinador={p}
                tom="escuro"
                emDestaque={hoveredIndexRef.current === idx}
                onMouseEnter={() => onCartaoEnterRef.current?.(idx)}
                onMouseLeave={() => onCartaoLeaveRef.current?.()}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
