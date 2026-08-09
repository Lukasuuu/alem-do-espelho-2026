"use client";

import { useState, useCallback } from "react";
import Header from "./Header";
import Footer from "./Footer";
import CausaSocial from "./CausaSocial";

/**
 * Wrapper client-side da página /causa-social — adiciona Header e Footer
 * à secção CausaSocial, seguindo o padrão de EventoPage e ListaEsperaPage.
 */
type Props = { faseInscricaoAtiva: boolean };

export default function CausaSocialPage({ faseInscricaoAtiva }: Props) {
  const [modalAberto, setModalAberto] = useState(false);
  const abrirModal = useCallback(() => setModalAberto(true), []);

  return (
    <>
      <Header abrirModal={abrirModal} />
      <main>
        <CausaSocial faseInscricaoAtiva={faseInscricaoAtiva} />
      </main>
      <Footer abrirModal={abrirModal} />
    </>
  );
}
