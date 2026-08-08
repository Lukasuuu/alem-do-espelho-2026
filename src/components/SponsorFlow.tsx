"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import PatrocinioPagamentoModal from "./PatrocinioPagamentoModal";
import { NIVEIS_PARCERIA_COPY, linkWhatsAppPatrocinio } from "@/lib/sponsor";
import { NIVEIS_PARCERIA, type MetodoSponsor, type NivelParceria } from "@/lib/validation";

/**
 * Fluxo "Quero Patrocinar" (FASE5) — cadeia de 4 modais EMPILHADOS:
 *
 *   1. nível      → "Escolhe o teu nível de parceria" (75/150/200€)
 *   2. dados      → WaitlistForm variant="sponsor" (com o nível em badge)
 *   3. pagamento  → MB Way / transferência apenas (sem cartão neste fluxo)
 *   4. obrigado   → "Patrocínio registado!" + atalho WhatsApp
 *
 * Cada modal abre POR CIMA do anterior, que fica aberto — propositadamente,
 * para exercitar o contador de scroll-lock a profundidade 4 (o fundo só
 * destrava quando TODOS fecham). Comportamento de fecho:
 *   - ✕ / clique fora fecham só o modal do topo → volta ao nível anterior;
 *   - ESC fecha a cadeia toda (todos os modais escutam ESC ao mesmo tempo).
 */
export default function SponsorFlow() {
  const [nivelAberto, setNivelAberto] = useState(false);
  const [dadosAberto, setDadosAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [obrigadoAberto, setObrigadoAberto] = useState(false);

  const [nivel, setNivel] = useState<NivelParceria | null>(null);
  const [sponsorId, setSponsorId] = useState("");
  const [nome, setNome] = useState("");
  const [metodo, setMetodo] = useState<MetodoSponsor | null>(null);

  function escolherNivel(valor: NivelParceria) {
    setNivel(valor);
    setDadosAberto(true); // o modal de nível fica aberto por baixo
  }

  function fecharTudo() {
    setNivelAberto(false);
    setDadosAberto(false);
    setPagamentoAberto(false);
    setObrigadoAberto(false);
  }

  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setNivelAberto(true)}
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-vinho px-8 py-4 text-sm font-medium text-creme transition-colors duration-300 hover:bg-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        Quero Patrocinar
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </button>

      {/* ── 1/4 NÍVEL ─────────────────────────────────────────────── */}
      <Modal
        aberto={nivelAberto}
        fechar={() => setNivelAberto(false)}
        titulo="Escolhe o teu nível de parceria"
        eyebrow="Quero Patrocinar"
        larguraMax="30rem"
      >
        <p className="text-[0.9375rem] leading-relaxed text-creme/70">
          Com este contributo ajudas a levar o Além do Espelho a mais mulheres. Depois dos
          dados, escolhes como pagar — MB Way ou transferência.
        </p>

        <div className="mt-6 space-y-3">
          {NIVEIS_PARCERIA.map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => escolherNivel(valor)}
              className="group flex w-full items-center gap-4 rounded-sm border border-creme/20 bg-creme/5 p-4 text-left transition-all duration-300 hover:border-creme/40 hover:bg-creme/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50"
            >
              <span className="display text-3xl text-blush tabular-nums">{valor}€</span>
              <span className="flex-1">
                <span className="block text-[0.9375rem] font-medium text-creme">
                  {NIVEIS_PARCERIA_COPY[valor].titulo}
                </span>
                <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-creme/60">
                  {NIVEIS_PARCERIA_COPY[valor].descricao}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-creme/40 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </Modal>

      {/* ── 2/4 DADOS ─────────────────────────────────────────────── */}
      <Modal
        aberto={dadosAberto}
        fechar={() => setDadosAberto(false)}
        titulo="Os teus dados"
        eyebrow="Quero Patrocinar"
        larguraMax="30rem"
        focoInicial="input:not([disabled])"
      >
        <p className="text-[0.9375rem] leading-relaxed text-creme/70">
          Regista-te com o nível escolhido. Podes pagar logo a seguir, por MB Way ou
          transferência bancária.
        </p>
        <div className="mt-6">
          {/* key={nivel}: mudar de nível recomeça o formulário em branco. */}
          <WaitlistForm
            key={nivel ?? undefined}
            variant="sponsor"
            nivel={nivel}
            onSucesso={(dados) => {
              if (!dados || !nivel) return;
              setSponsorId(dados.id);
              setNome(dados.nome);
              setPagamentoAberto(true); // o modal de dados fica aberto por baixo
            }}
          />
        </div>
      </Modal>

      {/* ── 3/4 PAGAMENTO (MB Way / transferência — sem cartão) ───── */}
      {nivel !== null && sponsorId !== "" && (
        <PatrocinioPagamentoModal
          aberto={pagamentoAberto}
          fechar={() => setPagamentoAberto(false)}
          sponsorId={sponsorId}
          nome={nome}
          nivel={nivel}
          onPago={(m) => {
            setMetodo(m);
            setObrigadoAberto(true); // o pagamento fica aberto por baixo
          }}
        />
      )}

      {/* ── 4/4 OBRIGADO ───────────────────────────────────────────── */}
      <Modal
        aberto={obrigadoAberto}
        fechar={() => setObrigadoAberto(false)}
        titulo="Patrocínio registado!"
        larguraMax="26rem"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-blush/40 bg-blush/10">
            <Check className="h-6 w-6 text-blush" aria-hidden />
          </div>

          <p className="mt-5 max-w-[24rem] text-[0.9375rem] leading-relaxed text-creme/70">
            {primeiroNome ? `${primeiroNome}, assim que` : "Assim que"} o pagamento for
            confirmado, o teu patrocínio fica garantido.
          </p>

          <a
            href={linkWhatsAppPatrocinio(metodo ?? "mbway", nivel ?? 75)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-colors duration-300 hover:bg-rosa-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-vinho"
          >
            Falar com a Vitória
            <span aria-hidden>→</span>
          </a>

          <button
            type="button"
            onClick={fecharTudo}
            className="mt-4 text-[0.875rem] text-creme/50 transition-colors duration-300 hover:text-creme/80"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
}
