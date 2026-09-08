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
      {/* Navegação própria: esta página não tem Experience (#o-que-te-espera)
          nem cronograma (#o-evento) — só âncoras que aqui existem. */}
      <Footer
        abrirModal={abrirModal}
        navegacao={[
          { rotulo: "Início", href: "#topo" },
          { rotulo: "Causa social", href: "#alem-de-mim" },
          { rotulo: "Contactos", href: "#contactos" },
        ]}
      />
    </>
  );
}
