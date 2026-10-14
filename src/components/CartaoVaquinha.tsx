"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import LocalImage from "./LocalImage";
import {
  MENSAGENS_VAQUINHA,
  VALORES_RAPIDOS,
  VAQUINHA_TRANSPARENCIA,
  VALOR_MAX_CENTS,
  VALOR_MIN_CENTS,
  formatarEuros,
  prazoDoFim,
  type TotaisComEstado,
} from "@/lib/vaquinha";

type Props = {
  /** Totais do primeiro render, lidos no servidor (page.tsx). null = sem base. */
  totaisIniciais: TotaisComEstado | null;
  /**
   * Abre a folha de doação. O `elapsedMs` é o tempo desde que ESTE cartão montou
   * (ou seja, desde que a página carregou) e vai no corpo do /iniciar para a
   * armadilha anti-bot: quem escreve um script carrega a página e dispara logo,
   * uma pessoa tem o cartão à frente muito antes de decidir. Medir desde a
   * abertura da folha era agressivo de mais — quem decide depressa escolhia o
   * método em menos de 2,5 s e levava com «não conseguimos validar esta
   * submissão», sem ter feito nada de errado.
   */
  onContribuir?: (valorCents: number, elapsedMs: number) => void;
};

const INTERVALO_POLL_MS = 15_000;

/**
 * Cartão da Vaquinha ONG Atos — ocupa o lugar do cronómetro no hero depois do
 * evento começar. Reproduz docs/vaquinha/referencia-visual/01 e 02 (aprovadas:
 * «tem de ficar exatamente assim»).
 *
 * Três coisas que este componente NUNCA faz:
 *  1. mostrar quantas contribuições houve (nem existe na resposta da RPC);
 *  2. somar a ESCOLHA de alguém à barra — o que conta é a DECLARAÇÃO («Já fiz
 *     a doação»), nunca o valor que a pessoa viu no ecrã antes de pagar;
 *  3. afirmar mais do que a regra permite. O número grande é o `arrecadado_cents`
 *     que o servidor calcula (D8, 14/10): confirmado + declaradas até ao limite
 *     de confiança. Acima desse limite a declarada fica só nas riscas até a
 *     Vitória confirmar.
 *
 * O segundo segmento da barra (riscas) é o declarado ACIMA do limite. Desaparece
 * quando `contar_pendentes` está em false — o travão de emergência do D8 — e
 * quem decide isso é o servidor, que nesse caso devolve a_confirmar_cents = 0.
 */
export default function CartaoVaquinha({ totaisIniciais, onContribuir }: Props) {
  const [totais, setTotais] = useState<TotaisComEstado | null>(totaisIniciais);
  const [valorCents, setValorCents] = useState<number>(1000); // 10 € como na prévia
  const [outro, setOutro] = useState(false);
  const [outroTxt, setOutroTxt] = useState("");
  /** Quando este cartão montou — base do elapsedMs anti-bot (ver Props). */
  const montadoEm = useRef<number>(Date.now());

  // ── Atualização ao vivo: 15 s, só com o separador visível ────────────────
  // cache: "no-store" é obrigatório: a Vercel reescreve o Cache-Control de
  // saída para `public`, portanto o cabeçalho já não informa o browser, e sem
  // isto a barra podia ficar presa numa cache heurística do telemóvel.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    let id: number | undefined;

    const buscar = async () => {
      try {
        const r = await fetch("/api/vaquinha/totais", { cache: "no-store" });
        if (!r.ok) return;
        const dados = (await r.json()) as { ok: boolean; totais?: TotaisComEstado };
        if (vivo.current && dados.ok && dados.totais) setTotais(dados.totais);
      } catch {
        /* rede em baixo: fica o último valor conhecido; a próxima volta tenta */
      }
    };

    const arrancar = () => {
      if (id !== undefined) return;
      void buscar();
      id = window.setInterval(buscar, INTERVALO_POLL_MS);
    };
    const parar = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") arrancar();
      else parar();
    };

    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      vivo.current = false;
      parar();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  // ── Kill switch (vaquinha_config.ativa): linha simples, nunca bloco vazio ──
  // Antes dizia «O Além do Espelho está a acontecer hoje», que só era verdade em
  // 17/10 — a vaquinha passou a durar até 18/11, portanto usa a mensagem do mapa.
  if (totais && totais.ativa === false) {
    return (
      <p id="vaquinha" className="text-[0.9375rem] font-medium leading-relaxed text-creme">
        {MENSAGENS_VAQUINHA.inativa}
      </p>
    );
  }

  const meta = totais?.meta_cents ?? 0;
  /**
   * O número grande (D8, 0014c). O `?? confirmado_cents` é rede de segurança
   * para o intervalo entre o deploy do site e a aplicação da 0014c: com a RPC
   * antiga o campo novo não vem, e sem isto o cartão escrevia «NaN €» e o
   * `scaleX` ia a NaN. Com a RPC antiga o site cai no modelo antigo (só o
   * confirmado) em vez de partir — e em produção a 0014c é aplicada antes.
   */
  const arrecadado = totais?.arrecadado_cents ?? totais?.confirmado_cents ?? 0;
  const aConfirmar = totais?.contar_pendentes ? (totais?.a_confirmar_cents ?? 0) : 0;
  const pctArrecadado = meta > 0 ? Math.min(1, arrecadado / meta) : 0;
  const pctPendente = meta > 0 ? Math.min(1 - pctArrecadado, aConfirmar / meta) : 0;
  /** A percentagem do aria é SÓ a do arrecadado: o segmento às riscas não está
      arrecadado, e somá-lo fazia o anúncio dizer mais do que a barra mostra. */
  const pctArrecadadoInt = Math.round(pctArrecadado * 100);

  const carregando = totais === null;
  /** Decidido no servidor (fim != null && agora >= fim), nunca com o relógio do
      browser. O polling traz o valor novo, portanto a troca acontece sozinha. */
  const encerrada = totais?.encerrada === true;
  const prazo = prazoDoFim(totais?.fim ?? null);
  /** Valores conhecidos (chips, CTA) — formatados sempre. */
  const euros = (c: number) => formatarEuros(c);
  /**
   * Valores que vêm dos totais. Enquanto não os temos, "––" — nunca "0 €".
   * O "0 €" afirma um facto que não conhecemos, e é exatamente o estado de quem
   * tem a página aberta às 09h30 (troca ao vivo, sem totais iniciais) ou de quem
   * apanha a base em baixo. A leitura no servidor existe para evitar isso.
   */
  const eurosTotais = (c: number) => (carregando ? "––" : formatarEuros(c));

  const nOutro = parseInt(outroTxt, 10);
  const valorEfetivo = outro ? (Number.isFinite(nOutro) ? nOutro * 100 : 0) : valorCents;
  /**
   * O teto valida-se aqui também, e não só na RPC: sem isto o botão deixava
   * seguir um valor que o servidor ia recusar, e a pessoa só descobria depois de
   * escolher o método. A mensagem é a MESMA do servidor (valor_maximo).
   */
  const acimaDoMaximo = outro && valorEfetivo > VALOR_MAX_CENTS;
  const rotuloCta = outro
    ? acimaDoMaximo
      ? `Indica um valor até ${euros(VALOR_MAX_CENTS)}`
      : valorEfetivo >= VALOR_MIN_CENTS
        ? `Contribuir com ${euros(valorEfetivo)}`
        : `Indica um valor a partir de ${euros(VALOR_MIN_CENTS)}`
    : `Contribuir com ${euros(valorCents)}`;

  return (
    <div
      id="vaquinha"
      className="relative mt-[52px] w-full max-w-[520px] rounded-[16px] bg-creme-neon p-6 text-vinho shadow-[0_18px_44px_rgba(10,16,12,0.35)] md:mt-[40px] md:rounded-[18px] md:px-8 md:pb-6 md:pt-[30px] md:shadow-[0_24px_60px_rgba(10,16,12,0.35)]"
    >
      {/* ── Selo circular: símbolo da Atos sem a palavra, texto a rodar 24 s ──
          Só sobre creme — a forma em "V" e a palavra são contorno escuro. */}
      <div className="absolute -right-[4px] -top-[38px] flex h-[92px] w-[92px] items-center justify-center rounded-full border border-selo-borda bg-creme-neon shadow-[0_8px_20px_rgba(10,16,12,0.28)] md:-right-[38px] md:-top-[44px] md:h-[118px] md:w-[118px] md:shadow-[0_10px_26px_rgba(10,16,12,0.28)]">
        <svg
          viewBox="0 0 120 120"
          className="absolute inset-0 h-full w-full animate-spin [animation-duration:24s] motion-reduce:animate-none"
          aria-hidden
        >
          <defs>
            <path id="vaquinha-selo-arco" d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
          </defs>
          <text
            className="fill-current font-sans text-[8.4px] font-semibold"
            textLength="293"
            lengthAdjust="spacing"
          >
            <textPath href="#vaquinha-selo-arco">
              VAQUINHA SOLIDÁRIA · ONG ATOS · ANGOLA ·
            </textPath>
          </text>
        </svg>
        <LocalImage
          src="/causa/ong-atos-icone.webp"
          alt=""
          width={256}
          height={256}
          className="relative w-[42px] md:w-[54px]"
        />
      </div>

      <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-malva md:text-[11px]">
        Causa social · ONG Atos
      </p>
      <h2 className="display mt-2 pr-[72px] text-[2rem] font-medium leading-[1.05] md:pr-[86px] md:text-[2.375rem]">
        Juntos por Angola
      </h2>
      <p className="mt-2 text-[0.875rem] leading-[1.55] text-tinta-suave md:pr-[60px] md:text-[0.90625rem]">
        Cada contribuição chega às mulheres apoiadas pela ONG Atos, em Angola.
      </p>

      {/* ── Valor: o arrecadado (D8). Sem contagem de contribuições. ── */}
      <div className="mt-[18px] flex flex-wrap items-baseline gap-x-[10px] gap-y-1 md:mt-5">
        <span className="display text-[2.875rem] font-semibold leading-none md:text-[3.375rem]">
          {eurosTotais(arrecadado)}
        </span>
        <span className="text-[0.84375rem] text-tinta-suave md:text-[0.875rem]">
          arrecadados de {eurosTotais(meta)}
        </span>
      </div>

      {/* ── Barra: sólido = arrecadado, riscas = declarado acima do limite ──
          Anima-se com transform (scaleX), nunca com width. */}
      <div
        role="progressbar"
        aria-valuenow={carregando ? undefined : Math.round(arrecadado / 100)}
        aria-valuemax={carregando ? undefined : Math.round(meta / 100)}
        aria-valuetext={
          carregando
            ? "A carregar os totais da vaquinha"
            : `${euros(arrecadado)} de ${euros(meta)}, ${pctArrecadadoInt} por cento`
        }
        className="relative mt-3 h-3 overflow-hidden rounded-full bg-blush md:mt-[14px]"
      >
        <span
          aria-hidden
          className="absolute inset-0 origin-left rounded-full bg-vinho transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `scaleX(${pctArrecadado})` }}
        />
        <span
          aria-hidden
          className="absolute inset-0 origin-left transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            transform: `translateX(${pctArrecadado * 100}%) scaleX(${pctPendente})`,
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--color-rosa) 0 3.5px, var(--color-risca) 3.5px 7px)",
          }}
        />
      </div>
      <div className="mt-[9px] flex justify-between text-[0.78125rem] text-tinta-suave md:text-[0.8125rem]">
        <span>
          Arrecadado: <strong className="font-semibold text-vinho">{eurosTotais(arrecadado)}</strong>
        </span>
        <span className="text-right">
          Meta: <strong className="font-semibold text-vinho">{eurosTotais(meta)}</strong>
          {/* Prazo junto à Meta, e não no sobrescrito: com tracking de 0,2em
              «CAUSA SOCIAL · ONG ATOS · ATÉ 18 DE NOVEMBRO» passa a duas linhas a
              390 px (medido), e o sobrescrito é uma linha só na prévia aprovada.
              Só aparece enquanto a vaquinha está aberta. */}
          {prazo && !encerrada && (
            <span className="mt-0.5 block text-[0.6875rem] text-tinta-suave">Até {prazo}</span>
          )}
        </span>
      </div>

      {encerrada ? (
        /* Acabou: fica o número (só o confirmado) e a barra, e no lugar dos
           chips e do CTA uma linha. A folha deixa de se poder abrir. */
        <p className="mt-5 text-[0.90625rem] font-medium leading-relaxed text-vinho md:mt-[22px]">
          A vaquinha terminou a {prazo ?? "18 de novembro"}. Obrigada a quem contribuiu!
        </p>
      ) : (
      <>
      {/* ── Escolha do valor ── */}
      <fieldset className="mt-5 min-w-0 border-0 p-0 md:mt-[22px]">
        <legend className="p-0 text-[0.71875rem] font-semibold uppercase tracking-[0.08em] text-tinta-suave md:text-[0.75rem]">
          Escolhe um valor
        </legend>
        <div className="mt-2.5 grid grid-cols-4 gap-2 md:flex md:flex-wrap">
          {VALORES_RAPIDOS.map((v) => {
            const sel = !outro && valorCents === v * 100;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={sel}
                onClick={() => {
                  setOutro(false);
                  setValorCents(v * 100);
                }}
                className={`h-[46px] rounded-full border text-[0.9375rem] transition-colors duration-200 md:h-11 md:px-[18px] ${
                  sel
                    ? "border-vinho bg-vinho font-semibold text-creme-neon"
                    : "border-areia bg-white font-medium text-vinho hover:border-vinho/40"
                }`}
              >
                {v} €
              </button>
            );
          })}
          {/* No telemóvel ocupa a linha inteira por baixo (grelha de 4); no
              computador entra na MESMA linha dos chips, como na prévia (o
              flex-wrap do fieldset). */}
          <button
            type="button"
            aria-pressed={outro}
            onClick={() => setOutro(true)}
            className={`col-span-4 h-[46px] rounded-full border text-[0.9375rem] transition-colors duration-200 md:col-span-1 md:h-11 md:w-auto md:px-[18px] ${
              outro
                ? "border-vinho bg-vinho font-semibold text-creme-neon"
                : "border-areia bg-white font-medium text-vinho hover:border-vinho/40"
            }`}
          >
            Outro valor
          </button>
        </div>
      </fieldset>

      {outro && (
        <div className="mt-3 flex items-center gap-2.5">
          <label htmlFor="vaquinha-outro" className="text-[0.8125rem] text-tinta-suave">
            Valor (mín. 5 €)
          </label>
          <input
            id="vaquinha-outro"
            type="number"
            inputMode="numeric"
            min={5}
            max={VALOR_MAX_CENTS / 100}
            step={1}
            placeholder="25"
            value={outroTxt}
            onChange={(e) => setOutroTxt(e.target.value)}
            aria-invalid={acimaDoMaximo}
            aria-describedby={acimaDoMaximo ? "vaquinha-outro-erro" : undefined}
            className="h-[46px] min-w-0 flex-1 rounded-xl border border-areia bg-white px-3.5 text-base text-vinho placeholder:text-vinho/40 md:h-11 md:w-[120px] md:flex-none"
          />
          <span className="text-base">€</span>
        </div>
      )}

      {acimaDoMaximo && (
        <p
          id="vaquinha-outro-erro"
          role="alert"
          className="mt-2 text-[0.8125rem] font-medium leading-relaxed text-vinho-profundo"
        >
          {MENSAGENS_VAQUINHA.valorMaximo}
        </p>
      )}

      <button
        type="button"
        onClick={() => onContribuir?.(valorEfetivo, Date.now() - montadoEm.current)}
        disabled={outro && (valorEfetivo < VALOR_MIN_CENTS || acimaDoMaximo)}
        className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-vinho text-base font-semibold text-creme-neon transition-colors duration-300 hover:bg-vinho-claro disabled:cursor-not-allowed disabled:opacity-60 md:mt-[18px]"
      >
        {rotuloCta}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      </>
      )}

      {/* A frase de transparência NÃO sai no estado encerrado: a linha substitui
          os chips e o CTA, e quem recebeu o dinheiro continua a ser informação
          da causa. Fica sempre — é o D2. */}
      <p className="mt-3 text-center text-[0.75rem] italic leading-[1.45] text-tinta-suave">
        {VAQUINHA_TRANSPARENCIA}
      </p>
    </div>
  );
}
