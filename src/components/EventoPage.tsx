"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Cronograma from "@/components/Cronograma";
import Experience from "@/components/Experience";
import Anfitria from "@/components/Anfitria";
import Gallery from "@/components/Gallery";
import Realizacao from "@/components/Realizacao";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";
import InscricaoModal from "@/components/InscricaoModal";
import PagamentoModal from "@/components/PagamentoModal";
import ParabensModal from "@/components/ParabensModal";
import { definirAberturaModal } from "@/lib/modal";
import { faseForcada } from "@/lib/fase";
import { FIM_CAMPANHA_ISO, MENSAGEM_INSCRICAO, SALON_WHATSAPP } from "@/lib/campanha";
import { VALOR_INSCRICAO_TEXT } from "@/lib/pagamento";
import { linkWhatsApp, ORG_EMAIL } from "@/lib/site";
import { enviarEmailNotificacao, enviarEmailOrganizacao } from "@/lib/email";

const fimCampanhaMs = new Date(FIM_CAMPANHA_ISO).getTime();

/**
 * Bloco E — regista o resultado de um envio de email via RPC registar_envio_email
 * (0010), por POST a /api/inscricao/email-registo. Fire-and-forget: falhas desta
 * chamada NUNCA chegam à pessoa — só ao console. A fonte de verdade de "quem
 * pagou" é a base, nunca o inbox. B1: o dono valida-se pelo posse_token.
 */
function registarEnvioEmail(
  inscricaoId: string,
  posseToken: string,
  destino: "cliente" | "org",
  ok: boolean
): void {
  void fetch("/api/inscricao/email-registo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inscricaoId, posseToken, destino, ok }),
  }).catch((erro) => {
    console.error("[evento] falha ao registar envio de email:", erro);
  });
}

/**
 * Versão do evento, a landing completa. Fluxo de inscrição com gate de fase:
 *  - antes de FIM_CAMPANHA_ISO (10/08, 10:00) → a lista de espera
 *    (WaitlistModal);
 *  - a partir de FIM_CAMPANHA_ISO → a inscrição paga (InscricaoModal)
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
  const [waitlistAberto, setWaitlistAberto] = useState(false);
  const [inscricaoAberto, setInscricaoAberto] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  // B1: o posseToken vive AQUI, só em memória (estado React) — nem
  // sessionStorage/localStorage/cookie, nem logs, nem URL/SumUp. Fechou o
  // browser, morreu com a tab: a reentrada é re-submeter o formulário
  // (UPDATE → token NOVO no POST).
  const [inscricaoDados, setInscricaoDados] = useState<{
    id: string;
    nome: string;
    email: string;
    posseToken: string;
  } | null>(null);
  const [parabensDados, setParabensDados] = useState<{ comprovativoOk: boolean } | null>(null);
  // Guard anti-duplicado: o email de confirmação envia-se UMA vez por inscrição,
  // mesmo que o fluxo do comprovativo passe por aqui mais do que uma vez.
  const emailConfirmacaoEnviadoRef = useRef<string | null>(null);
  // Guard do email à ORGANIZAÇÃO (Bloco E): o mesmo por id — consulta de
  // email_org_ok "antes" no que a app consegue fazer sem leitura à base
  // (RLS anon bloqueia SELECT; duplicado cross-session exigiria re-submeter
  // o formulário e voltar ao sucesso, coberto por estes guards na sessão).
  const emailOrgEnviadoRef = useRef<string | null>(null);

  // Override de teste (lista|inscricao) — constante por build, lido no client.
  const fase = faseForcada();
  // Lista gratuita aberta: antes de FIM_CAMPANHA.
  const listaAberta = Date.now() < fimCampanhaMs;

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
    if (listaAberta) {
      // Lista gratuita ainda aberta (antes de FIM_CAMPANHA).
      setWaitlistAberto(true);
      return;
    }
    // ≥ FIM_CAMPANHA → a inscrição paga é o fluxo ativo.
    setInscricaoAberto(true);
  }, [fase, listaAberta]);

  const fecharWaitlist = useCallback(() => setWaitlistAberto(false), []);
  const fecharInscricao = useCallback(() => setInscricaoAberto(false), []);
  const fecharPagamento = useCallback(() => {
    setPagamentoAberto(false);
    setInscricaoDados(null);
  }, []);

  // Inscrição submetida → fecha o formulário e abre o pagamento com os dados
  // (id + posse_token — capability da inscrição, B1/0009).
  const aoInscricaoSucesso = useCallback((id: string, nome: string, email: string, posseToken: string) => {
    setInscricaoAberto(false);
    setInscricaoDados({ id, nome, email, posseToken });
    setPagamentoAberto(true);
  }, []);

  // Directiva §3: o email "recebemos a tua inscrição" dispara no momento em que
  // o ecrã de PARABÉNS da inscrição é mostrado — DEPOIS de o upload do
  // comprovativo responder OK (PagamentoModal → onComprovativoSucesso) ou de a
  // pessoa declarar o pagamento por link SumUp (decisão E: mesmo callback). O
  // upload falhou → aoComprovativoFalha mostra o Parabéns SEM email (é o
  // WhatsApp que resolve). Fire-and-forget — nunca bloqueia nem reverte a
  // inscrição. Guard por id: UM email por inscrição.
  const aoComprovativoSucesso = useCallback(() => {
    if (!inscricaoDados) return;
    const { id, nome, email, posseToken } = inscricaoDados;
    setPagamentoAberto(false);
    setInscricaoDados(null);
    setParabensDados({ comprovativoOk: true });

    // Data/hora da notificação à organização — Europe/Lisbon (Braga), pt-PT.
    const dataHora = new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Lisbon",
    }).format(new Date());

    if (emailConfirmacaoEnviadoRef.current !== id) {
      emailConfirmacaoEnviadoRef.current = id;
      void enviarEmailNotificacao({
        to_name: nome,
        to_email: email,
        amount: VALOR_INSCRICAO_TEXT,
        order_id: id,
        event_link: "https://essenceofbeautysalon.com/alem-do-espelho-2026",
      }).then((okEnvio) => registarEnvioEmail(id, posseToken, "cliente", okEnvio));
    }

    // Notificação operacional mínima (decisão do Lucas, 06/09): a Vitória só
    // quer saber que houve inscrição paga — data/hora + referência de 8 chars
    // (o mesmo formato curto da mensagem de WhatsApp da recuperação). Sem
    // nome, método, email, telemóvel nem comprovativo (decisão RGPD).
    if (emailOrgEnviadoRef.current !== id) {
      emailOrgEnviadoRef.current = id;
      void enviarEmailOrganizacao({
        to_email: ORG_EMAIL,
        data_hora: dataHora,
        referencia: id.slice(0, 8),
      }).then((okEnvio) => registarEnvioEmail(id, posseToken, "org", okEnvio));
    }
  }, [inscricaoDados]);

  // Upload falhou (ou a pessoa prefere o WhatsApp): o Parabéns mostra-se na
  // mesma, com a linha de fallback a pedir o comprovativo pelo WhatsApp. SEM
  // email — o comprovativo não chegou; é o WhatsApp que o resolve. A pessoa
  // já pagou: nunca fica sem confirmação por causa de um upload.
  const aoComprovativoFalha = useCallback(() => {
    if (!inscricaoDados) return;
    setPagamentoAberto(false);
    setInscricaoDados(null);
    setParabensDados({ comprovativoOk: false });
  }, [inscricaoDados]);

  const fecharParabens = useCallback(() => setParabensDados(null), []);

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
        <Cronograma />
        <Experience />
        <Anfitria />
        <Gallery />
        <Realizacao faseInscricaoAtiva={faseInscricaoAtiva} />
      </main>
      <Footer abrirModal={abrirFluxo} />
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
          posseToken={inscricaoDados.posseToken}
          onComprovativoSucesso={aoComprovativoSucesso}
          onComprovativoFalha={aoComprovativoFalha}
        />
      )}
      <ParabensModal
        aberto={!!parabensDados}
        fechar={fecharParabens}
        contexto="inscricao"
        comprovativoOk={parabensDados?.comprovativoOk ?? true}
        ctaWhatsApp={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_INSCRICAO)}
      />
    </>
  );
}
