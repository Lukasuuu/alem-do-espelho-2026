"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "./Header";
import ListaEsperaHero from "./ListaEsperaHero";
import Experience from "./Experience";
import Anfitria from "./Anfitria";
import Gallery from "./Gallery";
import Realizacao from "./Realizacao";
import Footer from "./Footer";
import WaitlistModal from "./WaitlistModal";
import { definirAberturaModal } from "@/lib/modal";

/**
 * Página de pré-inscrição, reutiliza Header, Experience, Anfitria, Gallery e
 * Footer. Todos os CTAs abrem a WaitlistModal (mesma lógica da EventoPage),
 * sem formulário inline no corpo da página.
 */
export default function ListaEsperaPage() {
  const [modalAberto, setModalAberto] = useState(false);
  const abrirModal = useCallback(() => setModalAberto(true), []);

  // O skip-link "Saltar para a inscrição" (layout) abre a modal.
  useEffect(() => {
    definirAberturaModal(abrirModal);
    return () => definirAberturaModal(null);
  }, [abrirModal]);

  return (
    <>
      <Header abrirModal={abrirModal} />
      <main>
        <ListaEsperaHero irParaInscricao={abrirModal} />
        <Experience />
        <Anfitria />
        <Gallery />
        <Realizacao />
      </main>
      <Footer abrirModal={abrirModal} />
      <WaitlistModal aberto={modalAberto} fechar={() => setModalAberto(false)} />
    </>
  );
}
