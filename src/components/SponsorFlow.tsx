"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import PatrocinioPagamentoModal from "./PatrocinioPagamentoModal";
import ParabensModal from "./ParabensModal";
import CartaoPatrocinadora from "./CartaoPatrocinadora";
import { NIVEIS_PARCERIA_COPY, linkWhatsAppPatrocinio } from "@/lib/sponsor";
import { NIVEIS_PARCERIA, type MetodoSponsor, type NivelParceria } from "@/lib/validation";
import { patrocinadores } from "@/lib/patrocinadores";

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
  // prefers-reduced-motion: sem cascata nem movimento (a cascata fica estática).
  const reduzido = useReducedMotion();

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

      {/* ── A. APRESENTAÇÃO + CADASTRO (REESCRITA 2.1: 2 colunas a partir de md) ── */}
      <Modal
        aberto={apresentacaoAberto}
        fechar={() => setApresentacaoAberto(false)}
        titulo="Junta-te aos patrocinadores do Além do Espelho"
        eyebrow="Quero Patrocinar"
        larguraMax="64rem"
        focoInicial="input:not([disabled])"
      >
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-10">
          {/* ESQUERDA — subtítulo + cartões dos patrocinadores (com foto, como sempre) */}
          <div className="min-w-0">
            <p className="text-[0.9375rem] leading-relaxed text-creme/70">
              O Além do Espelho é uma campanha que leva uma mensagem de coragem e
              recomeço a mais mulheres. Já há quem esteja nesta missão — regista-te
              abaixo e escolhe como queres apoiar.
            </p>

            {reduzido ? (
              <div className="mt-6 space-y-4">
                {patrocinadores.map((patrocinadora) => (
                  <CartaoPatrocinadora
                    key={patrocinadora.id}
                    patrocinador={patrocinadora}
                    tom="escuro"
                  />
                ))}
              </div>
            ) : (
              <motion.div
                className="mt-6 space-y-4"
                variants={variantesLista}
                initial="oculto"
                animate="visivel"
              >
                {patrocinadores.map((patrocinadora) => (
                  <motion.div key={patrocinadora.id} variants={variantesItem}>
                    <CartaoPatrocinadora
                      patrocinador={patrocinadora}
                      tom="escuro"
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* DIREITA — instrução + formulário */}
          <div className="min-w-0">
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
