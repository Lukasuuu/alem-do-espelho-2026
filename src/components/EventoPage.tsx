"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
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
import { VALOR_INSCRICAO_TEXT } from "@/lib/pagamento";
import { linkWhatsApp } from "@/lib/site";
import { enviarEmailNotificacao } from "@/lib/email";

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
  const [inscricaoDados, setInscricaoDados] = useState<{
    id: string;
    nome: string;
    email: string;
  } | null>(null);
  const [parabensDados, setParabensDados] = useState<{ comprovativoOk: boolean } | null>(null);
  // Guard anti-duplicado: o email de confirmação envia-se UMA vez por inscrição,
  // mesmo que o fluxo do comprovativo passe por aqui mais do que uma vez.
  const emailConfirmacaoEnviadoRef = useRef<string | null>(null);

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

  // Inscrição submetida → fecha o formulário e abre o pagamento com os dados.
  const aoInscricaoSucesso = useCallback((id: string, nome: string, email: string) => {
    setInscricaoAberto(false);
    setInscricaoDados({ id, nome, email });
    setPagamentoAberto(true);
  }, []);

  // Directiva §3: o email "recebemos a tua inscrição" dispara no momento em que
  // o ecrã de PARABÉNS da inscrição é mostrado — DEPOIS de o upload do
  // comprovativo responder OK (PagamentoModal → onComprovativoSucesso). O
  // upload falhou → aoComprovativoFalha mostra o Parabéns SEM email (é o
  // WhatsApp que resolve). Fire-and-forget — nunca bloqueia nem reverte a
  // inscrição. Guard por id: UM email por inscrição.
  const aoComprovativoSucesso = useCallback(() => {
    if (!inscricaoDados) return;
    const { id, nome, email } = inscricaoDados;
    setPagamentoAberto(false);
    setInscricaoDados(null);
    setParabensDados({ comprovativoOk: true });

    if (emailConfirmacaoEnviadoRef.current === id) return;
    emailConfirmacaoEnviadoRef.current = id;
    void enviarEmailNotificacao({
      to_name: nome,
      to_email: email,
      amount: VALOR_INSCRICAO_TEXT,
      order_id: id,
      event_link: "https://essenceofbeautysalon.com/alem-do-espelho-2026",
    });
  }, [inscricaoDados]);

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
      <Header abrirModal={abrirFluxo} />
      <main>
        <Hero abrirModal={abrirFluxo} />
        <Experience />
        <Anfitria />
        <Gallery />
        <Realizacao faseInscricaoAtiva={faseInscricaoAtiva} />
      </main>
      <Footer abrirModal={abrirFluxo} />
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
