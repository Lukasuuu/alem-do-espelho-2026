"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import BannerOficial from "@/components/BannerOficial";
import BotaoWhatsApp from "@/components/BotaoWhatsApp";
import Experience from "@/components/Experience";
import Anfitria from "@/components/Anfitria";
import Gallery from "@/components/Gallery";
import Realizacao from "@/components/Realizacao";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";
import InscricaoModal from "@/components/InscricaoModal";
import PagamentoModal from "@/components/PagamentoModal";
import ParabensModal from "@/components/ParabensModal";
import { definirAberturaModal } from "@/lib/modal";
import { faseForcada } from "@/lib/fase";
import { FIM_CAMPANHA_ISO, MENSAGEM_INSCRICAO, SALON_WHATSAPP } from "@/lib/campanha";
import { linkWhatsApp } from "@/lib/site";

const fimCampanhaMs = new Date(FIM_CAMPANHA_ISO).getTime();

/**
 * Versão do evento, a landing completa. Fluxo de inscrição com gate de fase:
 *  - antes de FIM_CAMPANHA_ISO (10/08, 10:00) → a lista de espera
 *    (WaitlistModal);
 *  - a partir de FIM_CAMPANHA_ISO → a inscrição paga (InscricaoModal)
 *    e a modal de pagamento (PagamentoModal), o mesmo gate das APIs.
 * O override de teste NEXT_PUBLIC_FASE_OVERRIDE é respeitado no client
 * (faseForcada em lib/fase) para testar o fluxo pago antes de 10/08.
 * Vive em /alem-do-espelho-2026 (após o corte da lista de espera).
 *
 * faseInscricaoAtiva é decidido pelo SERVIDOR (page.tsx → cutover.inscricaoAtiva,
 * relógio + override) e apenas encadeado aqui até à secção de patrocinadores —
 * o client não recalcula com Date.now().
 */
type Props = { faseInscricaoAtiva: boolean };

export default function EventoPage({ faseInscricaoAtiva }: Props) {
  const [waitlistAberto, setWaitlistAberto] = useState(false);
  const [inscricaoAberto, setInscricaoAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  // B1: o posseToken vive AQUI, só em memória (estado React) — nem
  // sessionStorage/localStorage/cookie, nem logs, nem URL/SumUp. Fechou o
  // browser, morreu com a tab: a reentrada é re-submeter o formulário
  // (UPDATE → token NOVO no POST).
  const [inscricaoDados, setInscricaoDados] = useState<{
    id: string;
    nome: string;
    email: string;
    posseToken: string;
  } | null>(null);
  const [parabensDados, setParabensDados] = useState<{ comprovativoOk: boolean } | null>(null);

  // Override de teste (lista|inscricao) — constante por build, lido no client.
  const fase = faseForcada();
  // Lista gratuita aberta: antes de FIM_CAMPANHA.
  const listaAberta = Date.now() < fimCampanhaMs;

  // ── Fluxo de entrada, com consciência de fase (override de teste incluído). ──
  const abrirFluxo = useCallback(() => {
    if (fase === "inscricao") {
      // Override pago (teste pré-10/08): vai direto à inscrição paga.
      setInscricaoAberto(true);
      return;
    }
    if (fase === "lista") {
      // Override lista (teste pós-10/08): força a lista gratuita.
      setWaitlistAberto(true);
      return;
    }
    if (listaAberta) {
      // Lista gratuita ainda aberta (antes de FIM_CAMPANHA).
      setWaitlistAberto(true);
      return;
    }
    // ≥ FIM_CAMPANHA → a inscrição paga é o fluxo ativo.
    setInscricaoAberto(true);
  }, [fase, listaAberta]);

  const fecharWaitlist = useCallback(() => setWaitlistAberto(false), []);
  const fecharInscricao = useCallback(() => setInscricaoAberto(false), []);
  const fecharPagamento = useCallback(() => {
    setPagamentoAberto(false);
    setInscricaoDados(null);
  }, []);

  // Inscrição submetida → fecha o formulário e abre o pagamento com os dados
  // (id + posse_token — capability da inscrição, B1/0009).
  const aoInscricaoSucesso = useCallback((id: string, nome: string, email: string, posseToken: string) => {
    setInscricaoAberto(false);
    setInscricaoDados({ id, nome, email, posseToken });
    setPagamentoAberto(true);
  }, []);

  // R15 F4 — o browser NUNCA envia emails nem decide destinatários. Os emails
  // vivem na fila da base (emails_fila, 0012):
  //   • instruções + notificação à organização → enfileirados server-side pelo
  //     PATCH /api/inscricao/metodo (no clique do método);
  //   • "recebemos o teu comprovativo" → enfileirado server-side pela rota
  //     /api/comprovativo (substitui o email prematuro de "confirmação");
  //   • "pagamento confirmado" → trigger da base na transição para `confirmed`
  //     (confirmar_pagamento) — o frontend não o pode disparar nem falhar.
  // Este callback só acorda o worker (caminho rápido, best-effort — o cron é
  // a garantia) e mostra o Parabéns. No fluxo SumUp (decisão E) chega-se aqui
  // depois do POST a /api/inscricao/declarar-pagamento (adenda 2 §1.1), que
  // enfileira o "recebemos a tua declaração" a partir do servidor.
  const aoComprovativoSucesso = useCallback(() => {
    setPagamentoAberto(false);
    setInscricaoDados(null);
    setParabensDados({ comprovativoOk: true });

    void fetch("/api/emails/worker", { method: "POST" }).catch(() => {
      /* best-effort: o cron da FASE 5 drena a fila */
    });
  }, []);

  // Upload falhou (ou a pessoa prefere o WhatsApp): o Parabéns mostra-se na
  // mesma, com a linha de fallback a pedir o comprovativo pelo WhatsApp. SEM
  // email — o comprovativo não chegou; é o WhatsApp que o resolve. A pessoa
  // já pagou: nunca fica sem confirmação por causa de um upload.
  const aoComprovativoFalha = useCallback(() => {
    if (!inscricaoDados) return;
    setPagamentoAberto(false);
    setInscricaoDados(null);
    setParabensDados({ comprovativoOk: false });
  }, [inscricaoDados]);

  const fecharParabens = useCallback(() => setParabensDados(null), []);

  // O skip-link "Saltar para a inscrição" (layout) abre o fluxo via registo global.
  useEffect(() => {
    definirAberturaModal(abrirFluxo);
    return () => definirAberturaModal(null);
  }, [abrirFluxo]);

  return (
    <>
      {/* faseInscricaoAtiva controla também o link PATROCINADORES da navbar. */}
      <Header abrirModal={abrirFluxo} faseInscricaoAtiva={faseInscricaoAtiva} />
      <main>
        <Hero abrirModal={abrirFluxo} />
        {/* R6 — banner oficial + barra de horário no verde (herda id="o-evento"
            da faixa de chips que substituiu; destino do link EVENTO da navbar). */}
        <BannerOficial />
        <Experience />
        <Anfitria />
        <Gallery />
        <Realizacao faseInscricaoAtiva={faseInscricaoAtiva} abrirModal={abrirFluxo} />
      </main>
      <Footer abrirModal={abrirFluxo} />
      {/* H — bolha flutuante só nesta página (decisão do Lucas, 03/09). */}
      <BotaoWhatsApp />
      <WaitlistModal aberto={waitlistAberto} fechar={fecharWaitlist} />
      <InscricaoModal
        aberto={inscricaoAberto}
        fechar={fecharInscricao}
        onSucesso={aoInscricaoSucesso}
      />
      {inscricaoDados && (
        <PagamentoModal
          aberto={pagamentoAberto}
          fechar={fecharPagamento}
          inscricaoId={inscricaoDados.id}
          nome={inscricaoDados.nome}
          posseToken={inscricaoDados.posseToken}
          onComprovativoSucesso={aoComprovativoSucesso}
          onComprovativoFalha={aoComprovativoFalha}
        />
      )}
      <ParabensModal
        aberto={!!parabensDados}
        fechar={fecharParabens}
        contexto="inscricao"
        comprovativoOk={parabensDados?.comprovativoOk ?? true}
        ctaWhatsApp={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_INSCRICAO)}
      />
    </>
  );
}
