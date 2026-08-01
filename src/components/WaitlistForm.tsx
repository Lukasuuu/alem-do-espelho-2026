"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { paises, site } from "@/lib/site";
import { normalizarNome, validarTelefone } from "@/lib/validation";

type Estado = "inativo" | "a-enviar" | "sucesso" | "erro";
type Erros = Partial<Record<"fullName" | "email" | "phone" | "consent" | "form", string>>;

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

export default function WaitlistForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<string>("PT");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [estado, setEstado] = useState<Estado>("inativo");
  const [erros, setErros] = useState<Erros>({});
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [posicao, setPosicao] = useState<number | null>(null);
  const [jaInscrita, setJaInscrita] = useState(false);

  const montadoEm = useRef<number>(Date.now());
  const regiaoEstado = useRef<HTMLDivElement>(null);

  useEffect(() => {
    montadoEm.current = Date.now();
  }, []);

  // Depois do mount — o servidor nunca decide se a lista está fechada.
  const [listaFechada, setListaFechada] = useState(false);
  useEffect(() => {
    setListaFechada(Date.now() >= new Date(site.listaEspera.fecha).getTime());
  }, []);

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
      const resposta = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: normalizarNome(fullName),
          email: email.trim().toLowerCase(),
          phone,
          phoneCountry,
          consent: true,
          website,
          elapsedMs: Date.now() - montadoEm.current,
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
          utm: lerUtm(),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setEstado("erro");
        setErros({ ...(dados.campos ?? {}), form: dados.mensagem ?? "Algo correu mal." });
        regiaoEstado.current?.focus();
        return;
      }

      setPosicao(dados.posicao ?? null);
      setJaInscrita(dados.status === "already_registered");
      setEstado("sucesso");
    } catch {
      setEstado("erro");
      setErros({ form: "Sem ligação ao servidor. Verifica a internet e tenta novamente." });
    }
  }

  const mensagemPartilha = encodeURIComponent(
    `Acabei de entrar na lista de espera do ${site.nome} — ${site.subtitulo}. ${site.data.extenso}, ${site.local.completo}. Entra também: ${site.url}`
  );

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
          {jaInscrita ? "Já estavas connosco." : "Estás na lista."}
        </h3>

        <p className="mx-auto mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-creme/70">
          {jaInscrita
            ? "Este email já estava registado — atualizámos os teus dados. Continuas entre as primeiras a saber."
            : "Vais receber o aviso antes de todos, assim que as inscrições abrirem. Guarda o nosso email."}
        </p>

        {posicao !== null && (
          <p className="mt-7">
            <span className="eyebrow text-creme/40">A tua posição</span>
            <span className="display mt-2 block text-5xl text-blush tabular-nums">
              {String(posicao).padStart(2, "0")}
            </span>
          </p>
        )}

        <div className="fio mx-auto mt-9 max-w-[12rem] text-creme" aria-hidden />

        <p className="mt-8 text-[0.9375rem] text-creme/70">
          Conheces alguém que precisa de estar nesta sala?
        </p>
        <a
          href={`https://wa.me/?text=${mensagemPartilha}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-creme/25 px-7 py-3.5 text-[0.875rem] font-medium text-creme transition-colors duration-300 hover:border-creme/50 hover:bg-creme/5"
        >
          Convidar por WhatsApp
          <span aria-hidden>→</span>
        </a>
      </motion.div>
    );
  }

  /* ── Formulário ──────────────────────────────────────────── */
  const campoInvalido = (campo: keyof Erros) => Boolean(tocados[campo] && erros[campo]);

  return (
    <form onSubmit={submeter} noValidate className="espelho rounded-sm p-6 sm:p-9">
      {/* Lista fechada — aviso em vez de formulário ativo */}
      {listaFechada && (
        <div className="mb-6 rounded-sm border border-creme/25 bg-creme/5 px-4 py-3 text-[0.875rem] leading-relaxed text-creme/75">
          As inscrições na lista de espera estão fechadas.
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

        {/* Honeypot — invisível para pessoas, irresistível para robôs */}
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
              Autorizo o {site.anfitria.empresa.replace("CEO e fundadora do ", "")} a
              contactar-me por email e telemóvel sobre o {site.nome}. Podes cancelar quando
              quiseres.
            </span>
          </label>
          {campoInvalido("consent") && (
            <p className="mt-2 text-[0.8125rem] text-[#f3c0c0]">{erros.consent}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={estado === "a-enviar" || listaFechada}
        className="group mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(186,121,132,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
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
            Quero a minha vaga
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>

    </form>
  );
}
