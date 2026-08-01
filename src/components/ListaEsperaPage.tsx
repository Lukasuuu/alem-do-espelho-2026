"use client";

import { useCallback, useEffect } from "react";
import Header from "./Header";
import ListaEsperaHero from "./ListaEsperaHero";
import ListaEsperaInscricao from "./ListaEsperaInscricao";
import Experience from "./Experience";
import Anfitria from "./Anfitria";
import Gallery from "./Gallery";
import Footer from "./Footer";
import { definirAberturaModal } from "@/lib/modal";

/**
 * Página de pré-inscrição — reutiliza Header, Experience, Anfitria, Gallery e
 * Footer tal como estão. Em vez de um modal, o formulário vive inline na
 * secção #inscricao; todos os CTAs (incluindo o skip-link do layout) rolam
 * até ela.
 */
export default function ListaEsperaPage() {
  const irParaInscricao = useCallback(() => {
    const alvo = document.getElementById("inscricao");
    if (!alvo) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
  }, []);

  // O skip-link "Saltar para a inscrição" (layout) rola até ao formulário.
  useEffect(() => {
    definirAberturaModal(irParaInscricao);
    return () => definirAberturaModal(null);
  }, [irParaInscricao]);

  return (
    <>
      <Header abrirModal={irParaInscricao} />
      <main>
        <ListaEsperaHero irParaInscricao={irParaInscricao} />
        <ListaEsperaInscricao />
        <Experience />
        <Anfitria />
        <Gallery />
      </main>
      <Footer abrirModal={irParaInscricao} />
    </>
  );
}
