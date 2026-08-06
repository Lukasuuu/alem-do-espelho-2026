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
import WaitlistModal from "@/components/WaitlistModal";
import { definirAberturaModal } from "@/lib/modal";
import { FIM_CAMPANHA_ISO, LIMITE_BONUS, CAMPAIGN_POLL_MS } from "@/lib/campanha";

const fimCampanhaMs = new Date(FIM_CAMPANHA_ISO).getTime();

/**
 * Versão do evento, a landing completa. Fluxo de pré-inscrição em dois passos:
 * a campanha "Ecobag Bónus" abre primeiro numa modal informativa (quando ativa),
 * depois a lista de espera (WaitlistModal). A inscrição definitiva com pagamento
 * (InscricaoModal + PagamentoModal, ainda em código) reabre após FIM_CAMPANHA_ISO.
 * Vive em /alem-do-espelho-2026 (após o corte da lista de espera).
 */
export default function EventoPage() {
  const [bonusAberto, setBonusAberto] = useState(false);
  const [waitlistAberto, setWaitlistAberto] = useState(false);
  const [inscritos, setInscritos] = useState<number | null>(null);
  const [encerrado, setEncerrado] = useState(false);

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

  // ── Fluxo de entrada: campanha ativa abre o bónus, senão vai direto à inscrição. ──
  const abrirFluxo = useCallback(() => {
    if (!encerrado && Date.now() < fimCampanhaMs) setBonusAberto(true);
    else setWaitlistAberto(true);
  }, [encerrado]);

  const fecharBonus = useCallback(() => setBonusAberto(false), []);
  const fecharWaitlist = useCallback(() => setWaitlistAberto(false), []);

  // "Quero fazer parte" na modal do bónus: fecha-a e abre a lista de espera.
  const aoQueroFazerParte = useCallback(() => {
    setBonusAberto(false);
    setWaitlistAberto(true);
  }, []);

  const aoCampanhaEncerrar = useCallback(() => setEncerrado(true), []);

  // ── Auto-abertura do EcobagModal ~3 s após carregar (se campanha ativa). ──
  useEffect(() => {
    if (encerrado || Date.now() >= fimCampanhaMs) return;
    const t = window.setTimeout(() => setBonusAberto(true), 3000);
    return () => window.clearTimeout(t);
  }, [encerrado]);

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
        <Realizacao />
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
    </>
  );
}
