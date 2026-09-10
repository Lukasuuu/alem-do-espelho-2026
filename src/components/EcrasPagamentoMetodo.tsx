"use client";

import { MbWayIcon, TransferenciaIcon, WhatsAppIcon } from "./icons";
import BotaoCopiar from "./BotaoCopiar";
import { MBWAY_NUMERO, MBWAY_NUMERO_COPIAR, TRANSFERENCIA, formatarIban } from "@/lib/pagamento";

/**
 * Ecrãs de instrução dos métodos de pagamento — EXTRAÍDOS de PagamentoModal
 * para garantir paridade visual REAL entre os fluxos de inscrição e de
 * patrocínio (decisão da Vitória: os ecrãs de Transferência e MB Way do
 * patrocínio são IGUAIS aos das inscrições — mesmo componente, mesmo layout,
 * mesmos botões). Só muda por props:
 *   - valor (texto a mostrar + valor exato a copiar) — 40€ vs 75/150/200€;
 *   - referência da transferência ("NOME · Além do Espelho 2026" vs
 *     "NOME · Patrocínio Além do Espelho 2026");
 *   - copy do passo final (lugar vs patrocínio);
 *   - link WhatsApp pré-preenchido (mensagens distintas por fluxo);
 *   - o que o botão "Já fiz…" faz (na inscrição leva ao comprovativo; no
 *     patrocínio abre o Agradecimento — decidido pelo pai via callback).
 */

/** Props comuns dos dois ecrãs de instrução de pagamento. */
export type EcranMetodoProps = {
  /** Tema claro (modal de leitura legal) ou vinho (fluxo normal). */
  claro: boolean;
  /** Valor formatado à escala PT (ex.: "40,00 €", "75,00 €"). */
  valorText: string;
  /** Valor EXATO a copiar sem espaços (ex.: "40", "75"). */
  valorCopiar: string;
  /** Link wa.me pré-preenchido do fluxo (inscrição vs patrocínio). */
  whatsappHref: string;
  /** Ação do botão declarar (comprovativo na inscrição; Agradecimento no patrocínio). */
  aoDeclararPagamento: () => void;
  /** Etiqueta do botão declarar ("Já fiz o pagamento" / "Já fiz a transferência"). */
  textoBotaoDeclarar: string;
};

/** Classes dos cartões de dados — idênticas em qualquer fluxo. */
function cartaoDado(claro: boolean) {
  return `rounded-sm border px-4 py-3 ${
    claro ? "border-vinho/15 bg-creme-profundo/60" : "border-creme/20 bg-creme/5"
  }`;
}
function etiquetaDado(claro: boolean) {
  return `eyebrow ${claro ? "text-vinho/50" : "text-creme/60"}`;
}
function valorDado(claro: boolean) {
  return `mt-1 flex items-center justify-between gap-3 ${claro ? "text-carvao/85" : "text-creme/85"}`;
}

/**
 * Ecrã MB WAY — 3 passos + Número/Valor/Titular com Copiar + WhatsApp verde
 * + botão declarar. Idêntico à inscrição; o pai só parametriza os dados.
 */
export function EcranMbWay({
  claro,
  valorText,
  valorCopiar,
  whatsappHref,
  aoDeclararPagamento,
  textoBotaoDeclarar,
  /** Copy do 3.º passo: inscrição fala do lugar, patrocínio da confirmação. */
  textoPassoFinal,
}: EcranMetodoProps & { textoPassoFinal: string }) {
  return (
    <div>
      <ol
        className={`mt-4 space-y-4 text-[0.9375rem] leading-relaxed ${
          claro ? "text-carvao/75" : "text-creme/75"
        }`}
      >
        <li className="flex gap-3">
          <span className="font-medium text-blush">1.</span>
          Abre a app MB Way e escolhe pagar por número de telemóvel.
        </li>
        <li className="flex gap-3">
          <span className="font-medium text-blush">2.</span>
          Confere os dados abaixo e confirma o pagamento.
        </li>
        <li className="flex gap-3">
          <span className="font-medium text-blush">3.</span>
          {textoPassoFinal}
        </li>
      </ol>

      <dl className="mt-6 space-y-3">
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>Número</dt>
          <dd className={valorDado(claro)}>
            <span className="font-medium tabular-nums tracking-wide">{MBWAY_NUMERO}</span>
            <BotaoCopiar texto={MBWAY_NUMERO_COPIAR} claro={claro} />
          </dd>
        </div>
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>Valor</dt>
          <dd className={valorDado(claro)}>
            <span className="font-medium tabular-nums">{valorText}</span>
            <BotaoCopiar texto={valorCopiar} claro={claro} />
          </dd>
        </div>
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>Titular</dt>
          <dd className={valorDado(claro)}>
            <span className="font-medium">{TRANSFERENCIA.beneficiario}</span>
          </dd>
        </div>
      </dl>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-whatsapp px-7 py-4 text-[0.9375rem] font-medium text-white transition-all duration-300 hover:brightness-105"
      >
        <WhatsAppIcon className="h-4.5 w-4.5" />
        Combinar confirmação por WhatsApp
      </a>

      <button
        type="button"
        onClick={aoDeclararPagamento}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
          claro
            ? "border-vinho/25 text-vinho hover:border-vinho/45"
            : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
        }`}
      >
        {textoBotaoDeclarar}
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Ecrã TRANSFERÊNCIA BANCÁRIA — IBAN/Beneficiário/BIC/Instituição/Valor com
 * Copiar, referência, nota SEPA, WhatsApp verde e botão declarar. Idêntico
 * à inscrição em tudo o que o pai não parametriza.
 */
export function EcranTransferencia({
  claro,
  valorText,
  valorCopiar,
  whatsappHref,
  aoDeclararPagamento,
  textoBotaoDeclarar,
  referencia,
}: EcranMetodoProps & { referencia: string }) {
  return (
    <div>
      <dl className="mt-4 space-y-3">
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>IBAN</dt>
          <dd className={valorDado(claro)}>
            <span className="font-medium tabular-nums tracking-wide">
              {formatarIban(TRANSFERENCIA.iban)}
            </span>
            <BotaoCopiar texto={TRANSFERENCIA.iban} claro={claro} />
          </dd>
        </div>
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>Beneficiário</dt>
          <dd className={`mt-1 font-medium ${claro ? "text-carvao/85" : "text-creme/85"}`}>
            {TRANSFERENCIA.beneficiario}
          </dd>
        </div>
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>BIC / SWIFT</dt>
          <dd className={`mt-1 font-medium tabular-nums ${claro ? "text-carvao/85" : "text-creme/85"}`}>
            {TRANSFERENCIA.bic}
          </dd>
        </div>
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>Instituição</dt>
          <dd className={`mt-1 font-medium ${claro ? "text-carvao/85" : "text-creme/85"}`}>
            {TRANSFERENCIA.instituicao}
          </dd>
        </div>
        <div className={cartaoDado(claro)}>
          <dt className={etiquetaDado(claro)}>Valor</dt>
          <dd className={valorDado(claro)}>
            <span className="font-medium tabular-nums">{valorText}</span>
            <BotaoCopiar texto={valorCopiar} claro={claro} />
          </dd>
        </div>
      </dl>

      <p
        className={`mt-4 text-[0.8125rem] leading-relaxed ${
          claro ? "text-carvao/60" : "text-creme/70"
        }`}
      >
        Referência da transferência: <span className="font-medium">{referencia}</span>
      </p>

      <p
        className={`mt-3 text-[0.75rem] leading-relaxed ${
          claro ? "text-carvao/50" : "text-creme/65"
        }`}
      >
        IBAN irlandês (SumUp) — transferência SEPA, sem custos adicionais na maioria dos bancos
        portugueses.
      </p>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-whatsapp px-7 py-4 text-[0.9375rem] font-medium text-white transition-all duration-300 hover:brightness-105"
      >
        <WhatsAppIcon className="h-4.5 w-4.5" />
        Combinar confirmação por WhatsApp
      </a>

      <button
        type="button"
        onClick={aoDeclararPagamento}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-7 py-4 text-[0.9375rem] font-medium transition-colors duration-300 ${
          claro
            ? "border-vinho/25 text-vinho hover:border-vinho/45"
            : "border-creme/25 text-creme/80 hover:border-creme/50 hover:bg-creme/5"
        }`}
      >
        {textoBotaoDeclarar}
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/** Reexportado para os fluxos que só precisam do ícone nos cabeçalhos. */
export { MbWayIcon, TransferenciaIcon };