"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "./Header";
import ListaEsperaHero from "./ListaEsperaHero";
import ListaEsperaInscricao from "./ListaEsperaInscricao";
import Experience from "./Experience";
import Anfitria from "./Anfitria";
import Gallery from "./Gallery";
import Footer from "./Footer";
import WaitlistModal from "./WaitlistModal";
import { definirAberturaModal } from "@/lib/modal";

/**
 * Página de pré-inscrição — reutiliza Header, Experience, Anfitria, Gallery e
 * Footer. Todos os CTAs abrem a WaitlistModal (mesma lógica da EventoPage);
 * o formulário inline em #inscricao continua disponível como referência visual
 * e para SEO, mas a acção principal é via modal.
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
        <ListaEsperaInscricao />
        <Experience />
        <Anfitria />
        <Gallery />
      </main>
      <Footer abrirModal={abrirModal} />
      <WaitlistModal aberto={modalAberto} fechar={() => setModalAberto(false)} />
    </>
  );
}
