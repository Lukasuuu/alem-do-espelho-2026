"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import {
  FORMATOS_COMPROVATIVO,
  MENSAGENS_COMPROVATIVO,
  TAMANHO_MAXIMO,
  detetarTipo,
  extensaoDe,
  tamanhoLegivel,
} from "@/lib/comprovativo";

type Estado = "vazio" | "a-validar" | "a-enviar" | "a-registar" | "ok" | "erro";

type Props = {
  /** Id do patrocínio registado no POST /api/sponsor. */
  sponsorId: string;
  /** Pagamento ativo (iniciar_pagamento_sponsor). */
  pagamentoId: string;
  /** B1/0011 — capability de posse, só em memória. */
  posseToken: string;
  onSucesso: () => void;
  /** Falha do servidor → o pai mostra o caminho humano (WhatsApp Vitória). */
  onFalhaServidor: () => void;
};

/**
 * Upload do comprovativo do PATROCÍNIO — SIGNED UPLOAD em 2 fases (0011 r2).
 *
 * Por que não o multipart clássico: o proxy da Vercel corta o request a
 * ~4,5 MB e o bucket aceita 8 MB — comprovativos de 5–8 MB perdiam-se no
 * proxy. O ficheiro vai direto do browser ao Supabase:
 *
 *   1. pré-validação no cliente (vazio, >8 MB, magic bytes, extensão);
 *   2. POST /api/sponsor/comprovativo (JSON: nome, tamanho, primeiros 64
 *      bytes em base64) → o servidor revalida tudo e devolve a signed
 *      upload URL + o path construído no servidor;
 *   3. PUT do ficheiro DIRETO ao Supabase (XHR, com barra de progresso);
 *   4. POST /api/sponsor/comprovativo/registo → metadados + proof_uploaded.
 *
 * Aceita PNG, JPG, JPEG, WEBP, HEIC, HEIF e PDF. HEIC/HEIF não têm preview
 * no browser — placeholder no slot (mesma regra do PaymentProofUpload de
 * inscrição). Nunca envia o ficheiro pela rota, nunca expõe service_role.
 */
export default function SponsorPaymentProofUpload({
  sponsorId,
  pagamentoId,
  posseToken,
  onSucesso,
  onFalhaServidor,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [ficheiro, setFicheiro] = useState<File | null>(null);
  /** Tipo REAL detetado nos magic bytes (mesma fonte da rota — nunca ficheiro.type). */
  const [tipoDetetado, setTipoDetetado] = useState<{ ext: string; mime: string } | null>(null);
  const [estado, setEstado] = useState<Estado>("vazio");
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);

  const ocupado = estado === "a-validar" || estado === "a-enviar" || estado === "a-registar";

  /** Pré-validação no cliente — a rota repete tudo no servidor. */
  function escolher(novo: File | null) {
    setErro(null);
    setEstado("vazio");
    setProgresso(0);
    setFicheiro(null);
    setTipoDetetado(null);

    if (!novo || novo.size === 0) {
      setErro(MENSAGENS_COMPROVATIVO.vazio);
      return;
    }
    if (novo.size > TAMANHO_MAXIMO) {
      setErro(MENSAGENS_COMPROVATIVO.grande);
      return;
    }
    const ext = extensaoDe(novo.name);
    if (!ext) {
      setErro(MENSAGENS_COMPROVATIVO.formato);
      return;
    }
    // HEIC/HEIF: os magic bytes (bytes 4–11, ISOBMFF) cabem nos primeiros
    // 64 bytes — o slice assíncrono basta.
    novo.slice(0, 64).arrayBuffer().then((buffer) => {
      const tipo = detetarTipo(new Uint8Array(buffer));
      if (!tipo) {
        setErro(MENSAGENS_COMPROVATIVO.formato);
        return;
      }
      if (FORMATOS_COMPROVATIVO[ext] !== tipo.mime) {
        setErro(MENSAGENS_COMPROVATIVO.incompativel);
        return;
      }
      setFicheiro(novo);
      setTipoDetetado(tipo);
    });
  }

  async function enviar() {
    if (!ficheiro || !tipoDetetado) return;
    if (!posseToken) {
      setErro("A tua sessão expirou. Volta a submeter o formulário para continuar.");
      return;
    }

    setErro(null);
    setEstado("a-validar");

    try {
      // FASE 1 — pedir a URL assinada (só metadados + primeiros bytes)
      const prefixo = await ficheiro.slice(0, 64).arrayBuffer();
      const pedido = await fetch("/api/sponsor/comprovativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorId,
          pagamentoId,
          posseToken,
          nomeFicheiro: ficheiro.name,
          tamanho: ficheiro.size,
          primeirosBytesBase64: arrayBufferParaBase64(prefixo),
        }),
      });
      const dados = await pedido.json();

      if (!pedido.ok || !dados.ok) {
        setErro(dados.mensagem ?? MENSAGENS_COMPROVATIVO.servidor);
        setEstado("erro");
        if (pedido.status >= 500) onFalhaServidor();
        return;
      }

      // FASE 2 — PUT direto ao Supabase (XHR para ter progresso).
      // Content-Type = o MIME DETETADO (bater certo com a extensão do path
      // que a rota construiu a partir dos mesmos magic bytes).
      setEstado("a-enviar");
      setProgresso(0);

      const enviou = await new Promise<boolean>((resolver) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", dados.signedUrl, true);
        xhr.setRequestHeader("Content-Type", tipoDetetado.mime);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgresso(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => resolver(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolver(false);
        xhr.ontimeout = () => resolver(false);
        xhr.send(ficheiro);
      });

      if (!enviou) {
        setErro(MENSAGENS_COMPROVATIVO.servidor);
        setEstado("erro");
        onFalhaServidor();
        return;
      }

      // FASE 3 — registo dos metadados (transição para proof_uploaded)
      setEstado("a-registar");
      const registo = await fetch("/api/sponsor/comprovativo/registo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorId,
          pagamentoId,
          posseToken,
          storagePath: dados.storagePath,
          nomeFicheiro: ficheiro.name,
          tamanho: ficheiro.size,
          mime: tipoDetetado.mime,
        }),
      });
      const dadosRegisto = await registo.json();

      if (!registo.ok || !dadosRegisto.ok) {
        // Metadados falharam: o ficheiro pode ter ficado no bucket, mas o
        // pagamento NÃO ficou em proof_uploaded — a pessoa reenvia.
        setErro(dadosRegisto.mensagem ?? MENSAGENS_COMPROVATIVO.servidor);
        setEstado("erro");
        onFalhaServidor();
        return;
      }

      setEstado("ok");
      onSucesso();
    } catch {
      setErro(MENSAGENS_COMPROVATIVO.servidor);
      setEstado("erro");
      onFalhaServidor();
    }
  }

  /* ── Ecrã ─────────────────────────────────────────────────── */

  const previewHeic = ficheiro ? /\.(heic|heif)$/i.test(ficheiro.name) : false;

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.heic,.heif,.pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
        className="sr-only"
        onChange={(e) => escolher(e.target.files?.[0] ?? null)}
        disabled={ocupado || estado === "ok"}
      />

      {!ficheiro && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado || estado === "ok"}
          className={`flex min-h-11 w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed px-4 py-6 text-center transition-colors ${
            erro
              ? "border-[#e88b8b]/50 bg-[#e88b8b]/10"
              : "border-creme/30 hover:border-creme/50 hover:bg-creme/5"
          }`}
        >
          <UploadCloud className="h-6 w-6 text-blush" aria-hidden />
          <span className="text-[0.9375rem] text-creme/85">
            Escolhe o comprovativo
          </span>
          <span className="text-[0.75rem] text-creme/55">
            PNG, JPG, WEBP, HEIC ou PDF — até 8 MB
          </span>
        </button>
      )}

      {ficheiro && (
        <div className="rounded-sm border border-creme/25 bg-creme/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-creme/25 bg-creme/5">
              {previewHeic ? (
                <span
                  aria-hidden
                  className="text-[0.5625rem] font-semibold uppercase tracking-wide text-creme/70"
                >
                  {ficheiro.name.split(".").pop()?.toLowerCase()}
                </span>
              ) : (
                <FileText className="h-4 w-4 text-blush" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] text-creme/85">
                {ficheiro.name}
              </span>
              <span className="block text-[0.75rem] text-creme/55">
                {tamanhoLegivel(ficheiro.size)}
              </span>
            </span>
            {!ocupado && estado !== "ok" && (
              <button
                type="button"
                onClick={() => {
                  setFicheiro(null);
                  setEstado("vazio");
                  setErro(null);
                  setProgresso(0);
                }}
                className="min-h-11 rounded-sm px-3 text-[0.8125rem] text-creme/60 underline underline-offset-2 hover:text-creme"
              >
                Trocar
              </button>
            )}
          </div>

          {(estado === "a-enviar" || estado === "a-registar") && (
            <div
              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-creme/15"
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do envio"
            >
              <div
                className="h-full rounded-full bg-blush transition-[width] duration-300"
                style={{ width: `${estado === "a-registar" ? 100 : progresso}%` }}
              />
            </div>
          )}
        </div>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-3 rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
        >
          {erro}
        </p>
      )}

      {estado === "ok" ? (
        <p
          role="status"
          className="mt-3 rounded-sm border border-[#8bd4a0]/40 bg-[#8bd4a0]/10 px-4 py-3 text-[0.875rem] text-[#bfe8c9]"
        >
          Comprovativo recebido. A equipa vai validar o pagamento.
        </p>
      ) : (
        <button
          type="button"
          onClick={enviar}
          disabled={!ficheiro || ocupado}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-creme px-7 py-3 text-[0.9375rem] font-medium text-vinho transition-colors duration-300 hover:bg-creme/90 disabled:cursor-wait disabled:opacity-60"
        >
          {estado === "vazio" || estado === "erro"
            ? "Enviar comprovativo"
            : estado === "a-validar"
              ? "A preparar o envio…"
              : estado === "a-enviar"
                ? `A enviar… ${progresso}%`
                : "A registar o comprovativo…"}
        </button>
      )}
    </div>
  );
}

/** Base64 dos primeiros bytes (sem dependências; o Buffer não existe no browser). */
function arrayBufferParaBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaria = "";
  const BLOCO = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binaria += String.fromCharCode(...bytes.subarray(i, i + BLOCO));
  }
  return btoa(binaria);
}

/**
 * Nota de manutenção: a rota revalida TUDO (extensão, tamanho, magic bytes,
 * mime↔extensão, path, posse) — esta componente é conveniência, não autoridade.
 */