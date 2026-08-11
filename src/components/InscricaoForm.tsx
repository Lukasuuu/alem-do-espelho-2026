"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { linkWhatsApp, paises, site } from "@/lib/site";
import { SALON_WHATSAPP } from "@/lib/campanha";
import { MENSAGENS, normalizarNome, validarTelefone } from "@/lib/validation";
import { WhatsAppIcon } from "./icons";
import PrivacidadeModal from "./PrivacidadeModal";

type Estado = "inativo" | "a-enviar" | "erro";
type Erros = Partial<Record<"nome" | "email" | "phone" | "consent" | "form", string>>;

/**
 * Consentimento RGPD (Lucas, 11/08): checkbox nunca pré-marcada, obrigatória.
 * O texto identifica o responsável, a finalidade, o prazo de conservação e o
 * direito de eliminação — derivado do site config para o número de WhatsApp
 * nunca voltar a divergir. A caixa é separada de qualquer outra aceitação.
 */
const TEXTO_CONSENTIMENTO = `Autorizo a ${site.anfitria.empresa.replace(
  "CEO e fundadora do ",
  ""
)} a usar o meu nome, email e telemóvel exclusivamente para gerir a minha inscrição no ${
  site.nome
}. Os dados não são partilhados com terceiros e são eliminados até 6 meses após o evento. Posso pedir a eliminação a qualquer momento pelo WhatsApp ${SALON_WHATSAPP.replace(
  /^351/,
  ""
)}.`;

type Props = {
  /** Chamado com id, nome e email da inscrição registada, para abrir a modal de pagamento. */
  onSucesso: (inscricaoId: string, nome: string, email: string) => void;
};

const NOME_COMPLETO = /^\p{L}[\p{L}'’.-]{1,}(?:\s+\p{L}[\p{L}'’.-]{1,})+$/u;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/**
 * Formulário de inscrição paga: nome, email e telemóvel (DDI +351 por defeito,
 * validado em E.164) + honeypot. Ao submeter grava a inscrição (status
 * 'pendente') e o pai abre a modal de pagamento.
 */
export default function InscricaoForm({ onSucesso }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<string>("PT");
  const [website, setWebsite] = useState(""); // honeypot
  /** RGPD: nunca pré-marcada (defaultChecked seria inválido). */
  const [consent, setConsent] = useState(false);
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);

  const [estado, setEstado] = useState<Estado>("inativo");
  const [erros, setErros] = useState<Erros>({});
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  /** FIX-3: falha de servidor/ligação — mostra o caminho humano (WhatsApp). */
  const [falhaServidor, setFalhaServidor] = useState(false);

  const montadoEm = useRef<number>(Date.now());
  const regiaoEstado = useRef<HTMLDivElement>(null);

  useEffect(() => {
    montadoEm.current = Date.now();
  }, []);

  const paisSelecionado = useMemo(
    () => paises.find((p) => p.code === phoneCountry) ?? paises[0],
    [phoneCountry]
  );

  function validar(): Erros {
    const novos: Erros = {};

    const nomeLimpo = normalizarNome(nome);
    if (!nomeLimpo) novos.nome = "Indica o teu nome completo.";
    else if (!NOME_COMPLETO.test(nomeLimpo)) novos.nome = "Escreve o nome e o apelido.";

    const mail = email.trim().toLowerCase();
    if (!mail) novos.email = "Indica o teu email.";
    else if (!EMAIL.test(mail)) novos.email = "Este email não parece válido.";

    if (!phone.trim()) novos.phone = "Indica o teu telemóvel.";
    else {
      const resultado = validarTelefone(phone, phoneCountry);
      if (!resultado.ok) novos.phone = resultado.erro;
    }

    if (!consent) novos.consent = "Precisamos da tua autorização para tratar da tua inscrição.";

    return novos;
  }

  function aoSair(campo: string) {
    setTocados((anterior) => ({ ...anterior, [campo]: true }));
    setErros(validar());
  }

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();

    const novos = validar();
    setErros(novos);
    setTocados({ nome: true, email: true, phone: true, consent: true });

    if (Object.keys(novos).length > 0) {
      const primeiro = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      primeiro?.focus();
      return;
    }

    setEstado("a-enviar");

    try {
      const resposta = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: normalizarNome(nome),
          email: email.trim().toLowerCase(),
          phone,
          phoneCountry,
          // RGPD: o valor real da caixa (true quando marcada). O servidor
          // exige literal(true) e a DB lança exceção se receber false.
          consent: consent,
          website,
          elapsedMs: Date.now() - montadoEm.current,
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
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
              "Não conseguimos guardar a tua inscrição agora. Para não perderes o teu lugar, fala connosco no WhatsApp e resolvemos contigo.",
          });
          regiaoEstado.current?.focus();
          return;
        }

        if (tipo === "fase") {
          setEstado("erro");
          setFalhaServidor(false);
          setErros({
            form:
              "A campanha mudou de fase e as inscrições estão neste momento fechadas. Se já tinhas começado, fala connosco no WhatsApp.",
          });
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

      setEstado("inativo");
      onSucesso(dados.id as string, normalizarNome(nome), email.trim().toLowerCase());
    } catch {
      setEstado("erro");
      setFalhaServidor(true);
      setErros({
        form:
          "Sem ligação ao servidor. Verifica a internet e tenta novamente — ou fala connosco no WhatsApp.",
      });
    }
  }

  const campoInvalido = (campo: keyof Erros) => Boolean(tocados[campo] && erros[campo]);

  return (
    <form onSubmit={submeter} noValidate className="espelho rounded-sm p-6 sm:p-9">
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
                    "Olá! Ao inscrever-me no Além do Espelho 2026 a gravação falhou e preciso de ajuda para garantir o meu lugar."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir conversa no WhatsApp para tratar da minha inscrição"
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
          <label htmlFor="nome" className="eyebrow mb-2.5 block text-creme/55">
            Nome completo
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            autoComplete="name"
            enterKeyHint="next"
            className="campo"
            placeholder="Maria Fernandes"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => aoSair("nome")}
            aria-invalid={campoInvalido("nome")}
            aria-describedby={campoInvalido("nome") ? "erro-nome" : undefined}
          />
          {campoInvalido("nome") && (
            <p id="erro-nome" className="mt-2 text-[0.8125rem] text-[#f3c0c0]">
              {erros.nome}
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
            className="campo"
            placeholder="maria@exemplo.com"
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
                className="campo cursor-pointer appearance-none pr-9 [&>option]:bg-carvao [&>option]:text-creme"
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
              className="campo"
              placeholder={paisSelecionado.code === "PT" ? "912 345 678" : "Número"}
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

        {/* Honeypot: invisível para pessoas, irresistível para robôs */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {/* Consentimento RGPD: caixa própria, nunca pré-marcada, obrigatória.
            O botão de submissão fica desativado enquanto não estiver marcada. */}
        <div className="pt-1">
          <label htmlFor="consent" className="flex cursor-pointer items-start gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (tocados.consent) setErros(validar());
              }}
              onBlur={() => aoSair("consent")}
              aria-invalid={campoInvalido("consent")}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-rosa"
            />
            <span className="text-[0.8125rem] leading-relaxed text-creme/60">
              {TEXTO_CONSENTIMENTO}
            </span>
          </label>
          {campoInvalido("consent") && (
            <p className="mt-2 text-[0.8125rem] text-[#f3c0c0]">{erros.consent}</p>
          )}
          <button
            type="button"
            onClick={() => setPrivacidadeAberta(true)}
            className="mt-2 rounded-sm text-[0.8125rem] font-medium text-creme/60 underline decoration-rosa/40 underline-offset-2 transition-colors hover:text-creme/85 hover:decoration-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50"
          >
            Política de Privacidade
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={estado === "a-enviar" || !consent}
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
            Reservar o meu lugar
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>

      <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-creme/45">
        Ao reservares, ficas com o lugar garantido assim que o pagamento for confirmado.
      </p>

      {/* O Modal usa createPortal ao <body>: renderizar aqui dentro do <form>
          no JSX é seguro — no DOM real o painel fica fora do form e os botões
          "Fechar" nunca disparam submissão. */}
      {/* RGPD (Lucas, 11/08): a modal é o documento legal do consentimento —
          contexto "inscricao" para a finalidade e os dados baterem certo com
          o formulário que a abriu. */}
      <PrivacidadeModal
        aberto={privacidadeAberta}
        fechar={() => setPrivacidadeAberta(false)}
        contexto="inscricao"
      />
    </form>
  );
}
