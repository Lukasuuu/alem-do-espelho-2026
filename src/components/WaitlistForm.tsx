"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { linkWhatsApp, paises, site } from "@/lib/site";
import { FIM_CAMPANHA_ISO, MENSAGEM_LISTA, SALON_WHATSAPP } from "@/lib/campanha";
import {
  MENSAGENS,
  NIVEIS_PARCERIA,
  normalizarNome,
  validarTelefone,
  type NivelParceria,
} from "@/lib/validation";
import { NIVEIS_PARCERIA_COPY } from "@/lib/sponsor";
import { WhatsAppIcon } from "./icons";
import PrivacidadeModal from "./PrivacidadeModal";

type Estado = "inativo" | "a-enviar" | "sucesso" | "erro";
type Erros = Partial<Record<"fullName" | "email" | "phone" | "nivel" | "consent" | "form", string>>;
type Variante = "waitlist" | "sponsor";

type Props = {
  /** waitlist (padrão) ou sponsor, muda textos, endpoint e sucesso. */
  variant?: Variante;
  /**
   * Chamado quando a submissão sponsor é aceite. Entrega o id do registo e o
   * NÍVEL escolhido INLINE no formulário (rádio) — o pai abre o pagamento
   * por cima. O waitlist não usa este callback.
   */
  onSucesso?: (dados?: {
    id: string;
    nome: string;
    /** Empresa/marca (opcional) — entra na mensagem do WhatsApp (Bloco J r2). */
    empresa?: string;
    /** Nível de parceria escolhido inline (75/150/200€). */
    nivel: NivelParceria;
  }) => void;
  /**
   * r3 — progresso do formulário (ronda anti-fecho acidental): true à 1.ª
   * alteração, false quando o registo é aceite. Opcional — a lista de espera
   * não usa (a sua modal não tem confirmação de saída).
   */
  onSujoChange?: (sujo: boolean) => void;
};

const NOME_COMPLETO = /^\p{L}[\p{L}'’.-]{1,}(?:\s+\p{L}[\p{L}'’.-]{1,})+$/u;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Lê os UTMs do endereço para sabermos de onde veio cada inscrição. */
function lerUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const chave of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const valor = params.get(chave);
    if (valor) utm[chave] = valor.slice(0, 160);
  }
  return utm;
}

export default function WaitlistForm({
  variant = "waitlist",
  onSucesso,
  onSujoChange,
}: Props) {
  const ehSponsor = variant === "sponsor";
  const anfitria = site.anfitria.empresa.replace("CEO e fundadora do ", "");

  /** Textos e destino por variante, mesma lógica, sem duplicar código. */
  const config = ehSponsor
    ? {
        endpoint: "/api/sponsor",
        // Passo A → B: depois de guardar os dados a pessoa continua para a
        // escolha do nível. "Quero Patrocinar" já está no botão da página.
        botao: "Continuar",
        // RGPD (Lucas, 11/08): mesmo formato do texto da inscrição —
        // responsável, finalidade exclusiva, não partilhado com terceiros,
        // prazo de conservação e direito de eliminação. Número derivado de
        // SALON_WHATSAPP para nunca voltar a divergir.
        consentimento: `Autorizo a ${anfitria} a usar o meu nome, email e telemóvel exclusivamente para gerir a minha proposta de patrocínio do ${site.nome}. Os dados não são partilhados com terceiros e são eliminados até 6 meses após o evento. Posso pedir a eliminação a qualquer momento pelo WhatsApp ${SALON_WHATSAPP.replace(
          /^351/,
          ""
        )}.`,
        listaFechada: "O registo de patrocínio está temporariamente indisponível.",
      }
    : {
        endpoint: "/api/waitlist",
        botao: "Quero fazer parte",
        consentimento: `Autorizo o ${anfitria} a contactar-me por email e telemóvel sobre o ${site.nome}.`,
        listaFechada: "As inscrições na lista de espera estão fechadas.",
      };

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<string>("PT");
  const [consent, setConsent] = useState(false);
  const [empresa, setEmpresa] = useState(""); // só no patrocínio (opcional)
  const [nivel, setNivel] = useState<NivelParceria | null>(null); // só no patrocínio (rádio inline)
  const [website, setWebsite] = useState(""); // honeypot
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);

  const [estado, setEstado] = useState<Estado>("inativo");
  const [erros, setErros] = useState<Erros>({});
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [posicao, setPosicao] = useState<number | null>(null);
  const [jaInscrita, setJaInscrita] = useState(false);
  /** FIX-3: falha de servidor/ligação — mostra o caminho humano (WhatsApp). */
  const [falhaServidor, setFalhaServidor] = useState(false);
  /**
   * Bloco J r2 — anti-takeover: o email já tem patrocínio ativo/confirmado.
   * A modal A mostra o alerta com CTA para a Vitória (nunca abre o passo B).
   */
  const [jaExistenteSponsor, setJaExistenteSponsor] = useState(false);

  /**
   * r5 — wizard de 2 sub-passos (só na variante sponsor): "dados" (nome,
   * telemóvel, email, empresa + consentimento RGPD — Lucas: a autorização
   * vive no passo do formulário, a preencher o espaço abaixo da empresa)
   * → "nivel" (só os 3 cartões de parceria). O POST acontece só no fim do
   * sub-passo 2; o waitlist continua num passo único.
   */
  const [passo, setPasso] = useState<"dados" | "nivel">("dados");
  /** Slide curto + crossfade; com reduced-motion fica só no crossfade. */
  const reduzMovimento = useReducedMotion();
  /** Foco no 1.º campo do sub-passo a que a pessoa chegou (a11y do wizard). */
  const refCampoDados = useRef<HTMLInputElement>(null);
  const refCampoNivel = useRef<HTMLInputElement>(null);
  const primeiroEfeito = useRef(true);

  const montadoEm = useRef<number>(Date.now());
  const regiaoEstado = useRef<HTMLDivElement>(null);

  useEffect(() => {
    montadoEm.current = Date.now();
  }, []);

  // r4 — ao trocar de sub-passo, o foco vai para o 1.º campo do novo passo
  // (teclado/leitor de ecrã). Na 1.ª montagem a Modal já trata o foco inicial.
  useEffect(() => {
    if (!ehSponsor) return;
    if (primeiroEfeito.current) {
      primeiroEfeito.current = false;
      return;
    }
    (passo === "dados" ? refCampoDados : refCampoNivel).current?.focus();
  }, [passo, ehSponsor]);

  // r3 — sujo: qualquer dado introduzido marca progresso a perder. O sucesso
  // repor via chamada direta (abaixo); os campos mantêm os valores, mas o
  // registo já está guardado — fechar deixa de pedir confirmação.
  useEffect(() => {
    onSujoChange?.(
      fullName.trim() !== "" ||
        email.trim() !== "" ||
        phone.trim() !== "" ||
        empresa.trim() !== "" ||
        nivel !== null ||
        consent
    );
  }, [fullName, email, phone, empresa, nivel, consent, onSujoChange]);

  // Depois do mount, o servidor nunca decide se a lista está fechada.
  // O patrocínio não fecha com a lista de espera.
  // A lista aceita inscrições até ao fim da campanha (segunda, 10/08), quando
  // abrem as inscrições definitivas. O corte de rota (site.listaEspera.fecha)
  // já passou e não deve bloquear o formulário.
  const [listaFechada, setListaFechada] = useState(false);
  useEffect(() => {
    if (ehSponsor) return;
    setListaFechada(Date.now() >= new Date(FIM_CAMPANHA_ISO).getTime());
  }, [ehSponsor]);

  const paisSelecionado = useMemo(
    () => paises.find((p) => p.code === phoneCountry) ?? paises[0],
    [phoneCountry]
  );

  /** r4 — validação dos campos do sub-passo 1 (dados). */
  function validarDados(): Erros {
    const novos: Erros = {};

    const nome = normalizarNome(fullName);
    if (!nome) novos.fullName = "Indica o teu nome completo.";
    else if (!NOME_COMPLETO.test(nome)) novos.fullName = "Escreve o nome e o apelido.";

    const mail = email.trim().toLowerCase();
    if (!mail) novos.email = "Indica o teu email.";
    else if (!EMAIL.test(mail)) novos.email = "Este email não parece válido.";

    if (!phone.trim()) novos.phone = "Indica o teu telemóvel.";
    else {
      const resultado = validarTelefone(phone, phoneCountry);
      if (!resultado.ok) novos.phone = resultado.erro;
    }

    // r5 — o consentimento RGPD pertence ao sub-passo 1: o passo não avança
    // sem os dados obrigatórios E a autorização marcada (pedido do Lucas).
    if (!consent) novos.consent = "Precisamos da tua autorização para te contactar.";

    return novos;
  }

  function validar(): Erros {
    // r5 — validarDados já valida o consentimento (passo 1 do wizard); aqui
    // só falta o que é próprio do sub-passo 2.
    const novos = validarDados();

    // Patrocínio: o nível é obrigatório (sub-passo 2 do wizard r4).
    if (ehSponsor && nivel === null) {
      novos.nivel = "Escolhe um nível de parceria.";
    }

    return novos;
  }

  function aoSair(campo: string) {
    setTocados((anterior) => ({ ...anterior, [campo]: true }));
    setErros(validar());
  }

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    if (listaFechada) return;

    // r4 — wizard: o 1.º "Continuar" valida os dados + o consentimento
    // (r5: a autorização vive neste passo) e avança para a escolha do nível.
    // O POST (registar_sponsor) acontece só no fim do sub-passo 2 — um único
    // envio, como antes.
    if (ehSponsor && passo === "dados") {
      const dados = validarDados();
      setErros(dados);
      setTocados((anterior) => ({
        ...anterior,
        fullName: true,
        email: true,
        phone: true,
        consent: true,
      }));
      if (Object.keys(dados).length > 0) {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        return;
      }
      setPasso("nivel");
      return;
    }

    const novos = validar();
    setErros(novos);
    setTocados({ fullName: true, email: true, phone: true, nivel: true, consent: true });

    // r4 — segurança: se algum dado do sub-passo 1 ficar inválido (só por
    // alteração externa de estado), volta a mostrá-lo em vez de assinalar
    // campos que já não estão no ecrã.
    if (ehSponsor && (novos.fullName || novos.email || novos.phone || novos.consent)) {
      setPasso("dados");
      return;
    }

    if (Object.keys(novos).length > 0) {
      const primeiro = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      primeiro?.focus();
      return;
    }

    setEstado("a-enviar");
    setJaExistenteSponsor(false);

    try {
      const resposta = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: normalizarNome(fullName),
          email: email.trim().toLowerCase(),
          phone,
          phoneCountry,
          // RGPD: valor real da caixa — o servidor exige literal(true) e a DB
          // lança exceção se receber false. Nenhuma rota aceita passar por cima.
          consent: consent,
          website,
          elapsedMs: Date.now() - montadoEm.current,
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
          utm: lerUtm(),
          // Só no patrocínio: empresa/marca (opcional) e o nível escolhido
          // INLINE (rádio) — o POST guarda logo o nível via p_nivel.
          empresa: ehSponsor ? empresa.trim() : undefined,
          nivel: ehSponsor ? nivel : undefined,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        // FIX-3: o servidor classifica o erro (dados.tipo). Tipo ausente ou
        // desconhecido → "servidor" (default seguro): nunca deixar a pessoa
        // sem caminho humano quando algo corre mal do nosso lado.
        const tipo: string = dados.tipo ?? "servidor";

        if (tipo === "servidor") {
          setEstado("erro");
          setFalhaServidor(true);
          setErros({
            form:
              "Não conseguimos guardar o teu registo agora. Para não perderes o contacto, fala connosco no WhatsApp e tratamos de tudo.",
          });
          regiaoEstado.current?.focus();
          return;
        }

        if (tipo === "fase") {
          setEstado("erro");
          setFalhaServidor(false);
          setErros({ form: config.listaFechada });
          regiaoEstado.current?.focus();
          return;
        }

        if (tipo === "rate") {
          setEstado("erro");
          setFalhaServidor(false);
          setErros({ form: MENSAGENS.rateLimit });
          regiaoEstado.current?.focus();
          return;
        }

        // validacao / bot → comportamento actual: assinala os campos e mostra
        // a mensagem do servidor.
        setEstado("erro");
        setFalhaServidor(false);
        setErros({ ...(dados.campos ?? {}), form: dados.mensagem ?? "Algo correu mal." });
        regiaoEstado.current?.focus();
        return;
      }

      if (ehSponsor) {
        // Bloco J r2 — ANTI-TAKEOVER: a rota responde 200 com jaExistente
        // quando o email já tem um patrocínio com pagamento ativo ou
        // confirmado. NÃO há onSucesso (não abre o pagamento — sem reescrever
        // dados) e o alerta na modal A dá o caminho humano (Vitória), que
        // pode ver o registo do lado dela.
        if (dados.jaExistente === true) {
          setEstado("erro");
          setFalhaServidor(false);
          setJaExistenteSponsor(true);
          setErros({
            form:
              "Já recebemos um pedido de patrocínio com este email. Para continuar ou alterar algo, fala com a Vitória no WhatsApp.",
          });
          regiaoEstado.current?.focus();
          return;
        }

        // O fluxo de patrocínio mantém este modal aberto e abre o pagamento
        // por cima, entregando o id do registo e o nível escolhido ao pai.
        setEstado("inativo");
        // r3 — registo guardado: o fecho da modal A deixa de pedir confirmação.
        onSujoChange?.(false);
        onSucesso?.({
          id: dados.id,
          nome: normalizarNome(fullName),
          // Bloco J r2 — empresa entra na mensagem do WhatsApp da Vitória.
          empresa: empresa.trim() !== "" ? empresa.trim() : undefined,
          // Nível escolhido inline — o valor do pagamento deriva daqui.
          // (o validar() acima recusa submissão sem nível — nunca é null aqui)
          nivel: nivel as NivelParceria,
        });
      } else {
        setPosicao(dados.posicao ?? null);
        setJaInscrita(dados.status === "already_registered");
        setEstado("sucesso");
      }
    } catch {
      setEstado("erro");
      setFalhaServidor(true);
      setErros({
        form:
          "Sem ligação ao servidor. Verifica a internet e tenta novamente — ou fala connosco no WhatsApp.",
      });
    }
  }

  /* ── Ecrã de confirmação ─────────────────────────────────── */
  if (estado === "sucesso") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="espelho rounded-sm p-8 text-center sm:p-12"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-blush/40 bg-blush/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            className="h-6 w-6 text-blush"
            aria-hidden
          >
            <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h3 className="display mt-7 text-3xl text-creme sm:text-4xl">
          Parabéns por fazeres parte desta campanha!
        </h3>

        <p className="mx-auto mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-creme/70">
          {jaInscrita
            ? "Já fazias parte da lista. Fala connosco no WhatsApp para saberes tudo sobre a tua inscrição."
            : "A tua inscrição foi registada com sucesso. Fala connosco no WhatsApp para saberes tudo sobre a tua inscrição."}
        </p>

        {posicao !== null && (
          <p className="mt-7">
            <span className="eyebrow text-creme/40">A tua posição</span>
            <span className="display mt-2 block text-5xl text-blush tabular-nums">
              {String(posicao).padStart(2, "0")}
            </span>
          </p>
        )}

        <a
          href={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_LISTA)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir conversa no WhatsApp da Essence of Beauty"
          className="mt-9 inline-flex items-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(196,126,138,0.7)]"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Falar sobre a minha inscrição
        </a>
      </motion.div>
    );
  }

  /* ── Formulário ──────────────────────────────────────────── */
  const campoInvalido = (campo: keyof Erros) => Boolean(tocados[campo] && erros[campo]);

  return (
    <form
      onSubmit={submeter}
      noValidate
      className={`espelho rounded-sm p-6 sm:p-9 ${
        // r4 — sponsor: coluna flex para o CTA sticky ancorar no fundo do
        // painel (o pai .data-coluna-formulario é flex no ≥768).
        ehSponsor ? "flex flex-col md:flex-1" : ""
      }`}
    >
      {/* Lista fechada, aviso em vez de formulário ativo */}
      {listaFechada && (
        <div className="mb-6 rounded-sm border border-creme/25 bg-creme/5 px-4 py-3 text-[0.875rem] leading-relaxed text-creme/75">
          {config.listaFechada}
        </div>
      )}

      <div
        ref={regiaoEstado}
        tabIndex={-1}
        aria-live="assertive"
        className="focus:outline-none"
      >
        <AnimatePresence>
          {erros.form && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
            >
              {erros.form}
              {/* Bloco J r2 — anti-takeover: caminho humano direto à Vitória
                  (mensagem sem dados técnicos). */}
              {jaExistenteSponsor && (
                <a
                  href={linkWhatsApp(
                    SALON_WHATSAPP,
                    "Olá, Vitória. Já tinha submetido um pedido de patrocínio no site e quero continuar."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir conversa no WhatsApp para continuar o meu patrocínio"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#f3c0c0]/40 px-4 py-2 text-[0.8125rem] font-medium text-[#f3c0c0] transition-colors duration-300 hover:border-[#f3c0c0] hover:bg-[#f3c0c0]/10"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Falar com a Vitória
                </a>
              )}
              {falhaServidor && !jaExistenteSponsor && (
                <a
                  href={linkWhatsApp(
                    SALON_WHATSAPP,
                    "Olá! Ao preencher o formulário no site do Além do Espelho 2026 a gravação falhou e preciso de ajuda."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir conversa no WhatsApp para tratar do meu registo"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#f3c0c0]/40 px-4 py-2 text-[0.8125rem] font-medium text-[#f3c0c0] transition-colors duration-300 hover:border-[#f3c0c0] hover:bg-[#f3c0c0]/10"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Falar no WhatsApp
                </a>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* r4 — wizard: os blocos abaixo são os mesmos; o que muda é quais
          estão visíveis por sub-passo (sponsor) ou todos de uma vez
          (waitlist). key={passo} remonta o painel → AnimatePresence faz o
          crossfade + slide curto; reduced-motion fica só no crossfade. */}
      <div className="max-w-[26rem]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={ehSponsor ? passo : "unico"}
            initial={{ opacity: 0, x: reduzMovimento ? 0 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduzMovimento ? 0 : -20 }}
            transition={{ duration: reduzMovimento ? 0.12 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
        {/* Voltar — só no sub-passo 2 (h-11: alvo de toque 44px). */}
        {ehSponsor && passo === "nivel" && (
          <button
            type="button"
            onClick={() => setPasso("dados")}
            className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-[0.8125rem] font-medium text-creme/55 transition-colors hover:text-creme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50"
          >
            <span aria-hidden>←</span>
            Voltar aos dados
          </button>
        )}

        {/* Nome — sub-passo 1 (waitlist mostra sempre) */}
        {(!ehSponsor || passo === "dados") && (
        <div>
          <label htmlFor="fullName" className="eyebrow mb-2.5 block text-creme/55">
            Nome completo
          </label>
          <input
            id="fullName"
            name="fullName"
            ref={refCampoDados}
            type="text"
            autoComplete="name"
            enterKeyHint="next"
            className="campo disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Maria Fernandes"
            disabled={listaFechada}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => aoSair("fullName")}
            aria-invalid={campoInvalido("fullName")}
            aria-describedby={campoInvalido("fullName") ? "erro-fullName" : undefined}
          />
          {campoInvalido("fullName") && (
            <p id="erro-fullName" className="mt-2 text-[0.8125rem] text-[#f3c0c0]">
              {erros.fullName}
            </p>
          )}
        </div>
        )}

        {/* Telemóvel — indicativo + telefone na mesma linha (não quebrar) —
            sub-passo 1 */}
        {(!ehSponsor || passo === "dados") && (
        <div>
          <label htmlFor="phone" className="eyebrow mb-2.5 block text-creme/55">
            Telemóvel
          </label>
          <div className="flex gap-2.5 items-end">
            <div className="relative shrink-0 w-[8rem] min-w-[8rem]">
              <select
                aria-label="Indicativo do país"
                className="campo cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-carvao [&>option]:text-creme"
                disabled={listaFechada}
                value={phoneCountry}
                onChange={(e) => {
                  setPhoneCountry(e.target.value);
                  if (tocados.phone) setErros(validar());
                }}
              >
                {paises.map((pais) => (
                  <option key={pais.code} value={pais.code}>
                    {pais.flag} {pais.dial}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-creme/45"
              >
                ▾
              </span>
            </div>

            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              enterKeyHint="done"
              className="campo disabled:cursor-not-allowed disabled:opacity-50 flex-1 min-w-0"
              placeholder={paisSelecionado.code === "PT" ? "912 345 678" : "Número"}
              disabled={listaFechada}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => aoSair("phone")}
              aria-invalid={campoInvalido("phone")}
              aria-describedby={campoInvalido("phone") ? "erro-phone" : undefined}
            />
          </div>
          {campoInvalido("phone") && (
            <p id="erro-phone" className="mt-2 text-[0.8125rem] text-[#f3c0c0]">
              {erros.phone}
            </p>
          )}
        </div>
        )}

        {/* Email — sub-passo 1 */}
        {(!ehSponsor || passo === "dados") && (
        <div>
          <label htmlFor="email" className="eyebrow mb-2.5 block text-creme/55">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            className="campo disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="maria@exemplo.com"
            disabled={listaFechada}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => aoSair("email")}
            aria-invalid={campoInvalido("email")}
            aria-describedby={campoInvalido("email") ? "erro-email" : undefined}
          />
          {campoInvalido("email") && (
            <p id="erro-email" className="mt-2 text-[0.8125rem] text-[#f3c0c0]">
              {erros.email}
            </p>
          )}
        </div>
        )}

        {/* Empresa / marca — só no patrocínio (opcional, CORREÇÃO nº6) —
            sub-passo 1 */}
        {ehSponsor && passo === "dados" && (
          <div>
            <label htmlFor="empresa" className="eyebrow mb-2.5 block text-creme/55">
              Nome da empresa ou marca{" "}
              <span className="normal-case tracking-normal text-creme/40">
                (opcional)
              </span>
            </label>
            <input
              id="empresa"
              name="empresa"
              type="text"
              autoComplete="organization"
              enterKeyHint="next"
              className="campo disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="O teu negócio — ou deixa em branco se patrocinas a título individual"
              disabled={listaFechada}
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            />
          </div>
        )}

        {/* Nível de parceria — sub-passo 2 do wizard r4 (cartões de rádio;
            a escolha vai no POST p_nivel no fim deste passo). Copy dos
            níveis: lib/sponsor. */}
        {ehSponsor && passo === "nivel" && (
          <fieldset className="pt-2">
            <legend className="eyebrow mb-2.5 block text-creme/55">
              Nível de parceria
            </legend>
            <div className="space-y-3">
              {NIVEIS_PARCERIA.map((valor, indice) => {
                const copy = NIVEIS_PARCERIA_COPY[valor];
                const ativo = nivel === valor;
                return (
                  <label
                    key={valor}
                    className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition-all duration-300 ${
                      ativo
                        ? "border-rosa/60 bg-creme/[0.08]"
                        : "border-creme/20 bg-creme/5 hover:border-creme/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="nivel"
                      ref={indice === 0 ? refCampoNivel : undefined}
                      value={valor}
                      checked={ativo}
                      onChange={() => {
                        setNivel(valor);
                        // Escolher resolve o erro do campo à luz (padrão dos
                        // outros campos: revalida só se já saiu com erro).
                        if (tocados.nivel) {
                          setErros((anterior) => {
                            const resto = { ...anterior };
                            delete resto.nivel;
                            return resto;
                          });
                        }
                      }}
                      onBlur={() => aoSair("nivel")}
                      aria-invalid={campoInvalido("nivel")}
                      aria-describedby={campoInvalido("nivel") ? "erro-nivel" : undefined}
                      className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer accent-rosa"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="display text-2xl text-blush tabular-nums">
                          {valor}€
                        </span>
                        <span className="text-[0.9375rem] font-medium text-creme">
                          {copy.titulo}
                        </span>
                        {copy.maisProcurado && (
                          <span className="rounded-full border border-dourado/50 bg-dourado/10 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-dourado-claro">
                            Mais procurado
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[0.8125rem] leading-relaxed text-creme/60">
                        {copy.descricao}
                      </span>
                      {copy.beneficios.length > 0 && (
                        <span className="mt-2 block space-y-1">
                          {copy.beneficios.map((beneficio) => (
                            <span
                              key={beneficio}
                              className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-creme/65"
                            >
                              <span
                                aria-hidden
                                className="mt-0.5 shrink-0 text-blush"
                              >
                                ✓
                              </span>
                              {beneficio}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {campoInvalido("nivel") && (
              <p id="erro-nivel" className="mt-2 text-[0.8125rem] text-[#f3c0c0]">
                {erros.nivel}
              </p>
            )}
          </fieldset>
        )}

        {/* Honeypot: invisível para pessoas, irresistível para robôs */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            disabled={listaFechada}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {/* Consentimento — ≤4 linhas à largura do formulário — r5: passou
            para o sub-passo 1 (abaixo do campo empresa; o passo 2 fica só
            com os níveis). O waitlist mostra sempre. */}
        {(!ehSponsor || passo === "dados") && (
        <div className="pt-1 max-w-[26rem]">
          <label htmlFor="consent" className="flex cursor-pointer items-start gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={consent}
              disabled={listaFechada}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (tocados.consent) setErros(validar());
              }}
              onBlur={() => aoSair("consent")}
              aria-invalid={campoInvalido("consent")}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-rosa disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-[0.8125rem] leading-relaxed text-creme/60">
              {config.consentimento}
            </span>
          </label>
          {campoInvalido("consent") && (
            <p className="mt-2 text-[0.8125rem] text-[#f3c0c0]">{erros.consent}</p>
          )}
          <button
            type="button"
            onClick={() => setPrivacidadeAberta(true)}
            disabled={listaFechada}
            className="mt-2 inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-sm text-[0.8125rem] font-medium text-creme/60 underline decoration-rosa/40 underline-offset-2 transition-colors hover:text-creme/85 hover:decoration-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Política de Privacidade
          </button>
        </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* r4 — sponsor: o CTA vive numa faixa sticky no fundo do painel —
          exatamente a mesma posição nos dois sub-passos (≥768, onde a coluna
          do formulário é o scroll próprio; o conteúdo rola por baixo da
          faixa de vidro .faixa-rodape-wizard). <768 o corpo é quem rola —
          o sticky ficaria inerte dentro do painel — e o botão fica em fluxo,
          ancorado ao fundo do formulário. O waitlist mantém o botão simples. */}
      <div
        className={
          ehSponsor
            ? "faixa-rodape-wizard mt-8 md:sticky md:bottom-0 md:z-10 md:-mx-9 md:-mb-9 md:mt-auto md:px-9 md:pb-9 md:pt-3"
            : "mt-8"
        }
      >
      <button
        type="submit"
        // r5 — o consentimento é agora exigido no sub-passo 1, pelo que a
        // condição volta à forma simples (idêntica ao waitlist): sem
        // autorização, o botão não avança em nenhum passo.
        disabled={estado === "a-enviar" || listaFechada || !consent}
        className="group relative overflow-hidden flex w-full items-center justify-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(186,121,132,0.7)] active:scale-[0.985] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {/* Shimmer diagonal — ativo quando NÃO disabled e NÃO reduced-motion.
            r5: com o consentimento no passo 1, a condição é a mesma nos dois
            sub-passos (autorização dada). */}
        {estado !== "a-enviar" && !listaFechada && consent && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer-diagonal"
            style={{ animationDuration: "4s" }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id="shimmerGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                  <stop offset="40%" stopColor="currentColor" stopOpacity="0.08" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.12" />
                  <stop offset="60%" stopColor="currentColor" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100" height="100" fill="url(#shimmerGrad)" />
            </svg>
          </span>
        )}

        {estado === "a-enviar" ? (
          <>
            <svg
              className="h-4 w-4 animate-spin relative z-10"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            A guardar…
          </>
        ) : (
          <>
            <span className="relative z-10">{config.botao}</span>
            <span aria-hidden className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>
      </div>

      {/* Modal usa createPortal ao <body>: aqui dentro do form no JSX é
          seguro — no DOM real o painel sai do form e o "Fechar" nunca submete.
          RGPD (Lucas, 11/08): o contexto ajusta a finalidade ao formulário
          que abriu — o patrocínio recolhe a empresa, a lista não. */}
      <PrivacidadeModal
        aberto={privacidadeAberta}
        fechar={() => setPrivacidadeAberta(false)}
        contexto={ehSponsor ? "patrocinio" : "lista"}
      />
    </form>
  );
}
