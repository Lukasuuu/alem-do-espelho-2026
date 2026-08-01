"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Experience from "@/components/Experience";
import Gallery from "@/components/Gallery";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";

export default function Page() {
  const [modalAberto, setModalAberto] = useState(false);

  const abrirModal = useCallback(() => setModalAberto(true), []);
  const fecharModal = useCallback(() => setModalAberto(false), []);

  return (
    <>
      <Header abrirModal={abrirModal} />
      <main>
        <Hero abrirModal={abrirModal} />
        <Experience />
        <Gallery />
      </main>
      <Footer abrirModal={abrirModal} />
      <WaitlistModal aberto={modalAberto} fechar={fecharModal} />
    </>
  );
}
