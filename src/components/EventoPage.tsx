"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Experience from "@/components/Experience";
import Anfitria from "@/components/Anfitria";
import Gallery from "@/components/Gallery";
import Realizacao from "@/components/Realizacao";
import Footer from "@/components/Footer";
import EcobagModal from "@/components/EcobagModal";
import { contarModaisAbertos } from "@/lib/scroll-lock";
import WaitlistModal from "@/components/WaitlistModal";
import InscricaoModal from "@/components/InscricaoModal";
import PagamentoModal from "@/components/PagamentoModal";
import { definirAberturaModal } from "@/lib/modal";
import { faseForcada } from "@/lib/fase";
import { FIM_CAMPANHA_ISO, LIMITE_BONUS, CAMPAIGN_POLL_MS } from "@/lib/campanha";

const fimCampanhaMs = new Date(FIM_CAMPANHA_ISO).getTime();

/**
 * Versão do evento, a landing completa. Fluxo de pré-inscrição com gate de fase:
 *  - campanha "Ecobag Bónus" ativa → abre primeiro a modal informativa, depois
 *    a lista de espera (WaitlistModal);
 *  - após FIM_CAMPANHA_ISO (10/08, 10:00) → a inscrição paga (InscricaoModal)
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
  const [bonusAberto, setBonusAberto] = useState(false);
  const [waitlistAberto, setWaitlistAberto] = useState(false);
  const [inscricaoAberto, setInscricaoAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [inscricaoDados, setInscricaoDados] = useState<{ id: string; nome: string } | null>(null);
  const [inscritos, setInscritos] = useState<number | null>(null);
  const [encerrado, setEncerrado] = useState(false);

  // Override de teste (lista|inscricao) — constante por build, lido no client.
  const fase = faseForcada();
  // Campanha ecobag ativa: bónus não esgotou E antes de FIM_CAMPANHA.
  const campanhaEcobag = !encerrado && Date.now() < fimCampanhaMs;
  // Lista gratuita aberta: qualquer momento antes de FIM_CAMPANHA (independente do bónus).
  const listaAberta = Date.now() < fimCampanhaMs;

  // ── Polling do counter da campanha (vive aqui para o disclaimer do pagamento
  //    também saber quando a campanha deixa de estar ativa). ──
  const buscarCount = useCallback(async () => {
    try {
      const res = await fetch("/api/campanha/inscritos", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && typeof data.inscritos === "number") {
        setInscritos(data.inscritos);
        if (data.inscritos >= LIMITE_BONUS) setEncerrado(true);
      }
    } catch {
      // Silencioso — tenta novamente no próximo ciclo
    }
    if (Date.now() >= fimCampanhaMs) setEncerrado(true);
  }, []);

  useEffect(() => {
    buscarCount();
    const id = setInterval(buscarCount, CAMPAIGN_POLL_MS);
    return () => clearInterval(id);
  }, [buscarCount]);

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
    if (campanhaEcobag) {
      setBonusAberto(true);
      return;
    }
    if (listaAberta) {
      // Campanha ecobag já esgotou mas a lista gratuita ainda está aberta.
      setWaitlistAberto(true);
      return;
    }
    // ≥ FIM_CAMPANHA → a inscrição paga é o fluxo ativo.
    setInscricaoAberto(true);
  }, [fase, campanhaEcobag, listaAberta]);

  const fecharBonus = useCallback(() => setBonusAberto(false), []);
  const fecharWaitlist = useCallback(() => setWaitlistAberto(false), []);
  const fecharInscricao = useCallback(() => setInscricaoAberto(false), []);
  const fecharPagamento = useCallback(() => {
    setPagamentoAberto(false);
    setInscricaoDados(null);
  }, []);

  // Inscrição submetida → fecha o formulário e abre o pagamento com os dados.
  const aoInscricaoSucesso = useCallback((id: string, nome: string) => {
    setInscricaoAberto(false);
    setInscricaoDados({ id, nome });
    setPagamentoAberto(true);
  }, []);

  // "Quero fazer parte" na modal do bónus: fecha-a e abre a lista de espera.
  const aoQueroFazerParte = useCallback(() => {
    setBonusAberto(false);
    setWaitlistAberto(true);
  }, []);

  const aoCampanhaEncerrar = useCallback(() => setEncerrado(true), []);

  // ── Auto-abertura do EcobagModal ~3 s após carregar (só ecobag ativa;
  //    o override pago nunca abre o bónus por cima do fluxo de inscrição). ──
  // Se já houver outro modal aberto (ex. fluxo de patrocínio), não abrir o
  // bónus por cima: o auto-foco roubaria o campo em uso e dispararia validação
  // sem o utilizador tocar em nada (contador partilhado em lib/scroll-lock).
  useEffect(() => {
    if (fase === "inscricao" || !campanhaEcobag) return;
    const t = window.setTimeout(() => {
      if (contarModaisAbertos() > 0) return;
      setBonusAberto(true);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [fase, campanhaEcobag]);

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
      <EcobagModal
        aberto={bonusAberto}
        fechar={fecharBonus}
        inscritos={inscritos}
        encerrado={encerrado}
        onEncerrado={aoCampanhaEncerrar}
        onQueroFazerParte={aoQueroFazerParte}
        onPular={fecharBonus}
      />
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
          campanhaAtiva={campanhaEcobag}
        />
      )}
    </>
  );
}
