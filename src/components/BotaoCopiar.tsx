"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Botão de copiar (navigator.clipboard) — extraído de PagamentoModal para
 * ser partilhado pelos fluxos de inscrição e de patrocínio (paridade visual
 * dos ecrãs de pagamento). Usado nos passos MB Way e transferência para
 * colar o valor EXATO SEM espaços (nº MB Way, IBAN, "40", "75").
 * Estados: "Copiar" → "Copiado!"; falha de clipboard (contexto não seguro)
 * → silêncio, não rebenta o fluxo.
 */
export default function BotaoCopiar({
  texto,
  claro,
}: {
  /** Valor exato a colar (ex.: "928400069", "IE60SUMU…", "40", "75"). */
  texto: string;
  claro?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Limpa o timeout do "Copiado!" se a modal desmontar a meio.
  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return; // clipboard indisponível → não bloquear o pagamento por causa disto
    }
    setCopiado(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopiado(false), 2000);
  }

  const borda = copiado
    ? "border-[#4fce5d]/60"
    : claro
      ? "border-vinho/25 text-vinho/75 hover:border-vinho/45 hover:text-vinho"
      : "border-creme/30 text-creme/70 hover:border-creme/50 hover:text-creme";
  const textoEstado = copiado ? (claro ? "text-[#2f9e3a]" : "text-[#6fd97b]") : "";

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${texto}`}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition-colors duration-300 ${borda} ${textoEstado}`}
    >
      {copiado && <Check className="h-3.5 w-3.5" aria-hidden />}
      {copiado ? "Copiado!" : "Copiar"}
    </button>
  );
}