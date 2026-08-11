"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { linkWhatsApp, paises, site } from "@/lib/site";
import { FIM_CAMPANHA_ISO, MENSAGEM_LISTA, SALON_WHATSAPP } from "@/lib/campanha";
import { MENSAGENS, normalizarNome, validarTelefone } from "@/lib/validation";
import { WhatsAppIcon } from "./icons";
import PrivacidadeModal from "./PrivacidadeModal";

type Estado = "inativo" | "a-enviar" | "sucesso" | "erro";
type Erros = Partial<Record<"fullName" | "email" | "phone" | "consent" | "form", string>>;
type Variante = "waitlist" | "sponsor";

type Props = {
  /** waitlist (padrão) ou sponsor, muda textos, endpoint e sucesso. */
  variant?: Variante;
  /**
   * Chamado quando a submissão sponsor é aceite. Entrega o id do registo para
   * o pai abrir o passo B (escolha do nível) por cima. O waitlist não usa
   * este callback.
   */
  onSucesso?: (dados?: { id: string; nome: string }) => void;
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

export default function WaitlistForm({ variant = "waitlist", onSucesso }: Props) {
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
  const [website, setWebsite] = useState(""); // honeypot
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);

  const [estado, setEstado] = useState<Estado>("inativo");
  const [erros, setErros] = useState<Erros>({});
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [posicao, setPosicao] = useState<number | null>(null);
  const [jaInscrita, setJaInscrita] = useState(false);
  /** FIX-3: falha de servidor/ligação — mostra o caminho humano (WhatsApp). */
  const [falhaServidor, setFalhaServidor] = useState(false);

  const montadoEm = useRef<number>(Date.now());
  const regiaoEstado = useRef<HTMLDivElement>(null);

  useEffect(() => {
    montadoEm.current = Date.now();
  }, []);

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

  function validar(): Erros {
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

    if (!consent) novos.consent = "Precisamos da tua autorização para te contactar.";

    return novos;
  }

  function aoSair(campo: string) {
    setTocados((anterior) => ({ ...anterior, [campo]: true }));
    setErros(validar());
  }

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    if (listaFechada) return;

    const novos = validar();
    setErros(novos);
    setTocados({ fullName: true, email: true, phone: true, consent: true });

    if (Object.keys(novos).length > 0) {
      const primeiro = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      primeiro?.focus();
      return;
    }

    setEstado("a-enviar");

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
          // Só no patrocínio: nome da empresa/marca (opcional). O nível NÃO
          // entra aqui — é escolhido no passo B (PATCH /api/sponsor/nivel).
          empresa: ehSponsor ? empresa.trim() : undefined,
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
        // O fluxo de patrocínio mantém este modal aberto e abre o passo B
        // (escolha do nível) por cima, entregando o id do registo ao pai.
        setEstado("inativo");
        onSucesso?.({
          id: dados.id,
          nome: normalizarNome(fullName),
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
    <form onSubmit={submeter} noValidate className="espelho rounded-sm p-6 sm:p-9">
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
              {falhaServidor && (
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

      <div className="space-y-5">
        {/* Nome */}
        <div>
          <label htmlFor="fullName" className="eyebrow mb-2.5 block text-creme/55">
            Nome completo
          </label>
          <input
            id="fullName"
            name="fullName"
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

        {/* Telemóvel */}
        <div>
          <label htmlFor="phone" className="eyebrow mb-2.5 block text-creme/55">
            Telemóvel
          </label>
          <div className="flex gap-2.5">
            <div className="relative shrink-0">
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
              className="campo disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Email */}
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

        {/* Empresa / marca — só no patrocínio, opcional (CORREÇÃO nº6) */}
        {ehSponsor && (
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

        {/* Consentimento */}
        <div className="pt-1">
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
            className="mt-2 rounded-sm text-[0.8125rem] font-medium text-creme/60 underline decoration-rosa/40 underline-offset-2 transition-colors hover:text-creme/85 hover:decoration-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Política de Privacidade
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={estado === "a-enviar" || listaFechada || !consent}
        className="group mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(186,121,132,0.7)] active:scale-[0.985] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {estado === "a-enviar" ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
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
            {config.botao}
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>

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
