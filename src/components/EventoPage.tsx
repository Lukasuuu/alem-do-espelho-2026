"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Experience from "@/components/Experience";
import Anfitria from "@/components/Anfitria";
import Gallery from "@/components/Gallery";
import Realizacao from "@/components/Realizacao";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";
import { definirAberturaModal } from "@/lib/modal";

/**
 * Versão do evento, a landing completa, com o formulário em modal.
 * Vive em /alem-do-espelho-2026 (após o corte da lista de espera).
 */
export default function EventoPage() {
  const [modalAberto, setModalAberto] = useState(false);

  const abrirModal = useCallback(() => setModalAberto(true), []);
  const fecharModal = useCallback(() => setModalAberto(false), []);

  // O skip-link "Saltar para a inscrição" (layout) abre o modal via registo global.
  useEffect(() => {
    definirAberturaModal(abrirModal);
    return () => definirAberturaModal(null);
  }, [abrirModal]);

  return (
    <>
      <Header abrirModal={abrirModal} />
      <main>
        <Hero abrirModal={abrirModal} />
        <Experience />
        <Anfitria />
        <Gallery />
        <Realizacao />
      </main>
      <Footer abrirModal={abrirModal} />
      <WaitlistModal aberto={modalAberto} fechar={fecharModal} />
    </>
  );
}
