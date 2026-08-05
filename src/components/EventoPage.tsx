"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Experience from "@/components/Experience";
import Anfitria from "@/components/Anfitria";
import Gallery from "@/components/Gallery";
import Realizacao from "@/components/Realizacao";
import Footer from "@/components/Footer";
import InscricaoModal from "@/components/InscricaoModal";
import PagamentoModal from "@/components/PagamentoModal";
import { definirAberturaModal } from "@/lib/modal";

/**
 * Versão do evento, a landing completa. Inscrição paga em duas modais:
 * o formulário (InscricaoModal) e, após submeter, o pagamento (PagamentoModal).
 * Vive em /alem-do-espelho-2026 (após o corte da lista de espera).
 */
export default function EventoPage() {
  const [inscricaoAberto, setInscricaoAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [inscricao, setInscricao] = useState<{ id: string; nome: string } | null>(null);

  const abrirInscricao = useCallback(() => setInscricaoAberto(true), []);
  const fecharInscricao = useCallback(() => setInscricaoAberto(false), []);

  // O formulário gravou a inscrição: fecha-o e abre o pagamento.
  const aoInscricaoSucesso = useCallback((id: string, nome: string) => {
    setInscricaoAberto(false);
    setInscricao({ id, nome });
    setPagamentoAberto(true);
  }, []);

  const fecharPagamento = useCallback(() => {
    setPagamentoAberto(false);
    setInscricao(null);
  }, []);

  // O skip-link "Saltar para a inscrição" (layout) abre o formulário via registo global.
  useEffect(() => {
    definirAberturaModal(abrirInscricao);
    return () => definirAberturaModal(null);
  }, [abrirInscricao]);

  return (
    <>
      <Header abrirModal={abrirInscricao} />
      <main>
        <Hero abrirModal={abrirInscricao} />
        <Experience />
        <Anfitria />
        <Gallery />
        <Realizacao />
      </main>
      <Footer abrirModal={abrirInscricao} />
      <InscricaoModal aberto={inscricaoAberto} fechar={fecharInscricao} onSucesso={aoInscricaoSucesso} />
      {inscricao && (
        <PagamentoModal
          aberto={pagamentoAberto}
          fechar={fecharPagamento}
          inscricaoId={inscricao.id}
          nome={inscricao.nome}
        />
      )}
    </>
  );
}
