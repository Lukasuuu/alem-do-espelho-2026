"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, FileText, RefreshCw, Upload, X } from "lucide-react";
import { linkWhatsApp } from "@/lib/site";
import { SALON_WHATSAPP } from "@/lib/campanha";
import { MENSAGENS } from "@/lib/validation";
import {
  FORMATOS_COMPROVATIVO,
  MENSAGENS_COMPROVATIVO,
  TAMANHO_MAXIMO,
  detetarTipo,
  extensaoDe,
  tamanhoLegivel,
} from "@/lib/comprovativo";
import { WhatsAppIcon } from "./icons";

type Props = {
  inscricaoId: string;
  pagamentoId: string;
  /** Chamado com o id do comprovativo registado (estado proof_uploaded). */
  onSucesso: (comprovativoId: string) => void;
};

/**
 * Upload do comprovativo de pagamento, reutilizável para MB Way, QR,
 * Transferência e SumUp.
 *
 * Acessível por teclado: a zona é um <label> ligado a um input[type=file]
 * real — tab + Enter abre o seletor; drag & drop é um bónus, não o caminho.
 * O servidor revalida tudo (tamanho e magic bytes): aqui só pré-validamos
 * para dar erro imediato sem desperdiçar upload.
 */
export default function PaymentProofUpload({ inscricaoId, pagamentoId, onSucesso }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tipoPreview, setTipoPreview] = useState<"imagem" | "pdf" | null>(null);
  const [arrastar, setArrastar] = useState(false);
  const [estado, setEstado] = useState<"inativo" | "a-enviar">("inativo");
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [falhaServidor, setFalhaServidor] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const regiaoErroRef = useRef<HTMLDivElement>(null);

  // Limpa o object URL de preview quando muda o ficheiro ou desmonta.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function limparErro() {
    setErro(null);
    setFalhaServidor(false);
  }

  async function aoEscolher(ficheiro: File | undefined) {
    if (!ficheiro) return;
    limparErro();

    if (ficheiro.size === 0) {
      setErro(MENSAGENS_COMPROVATIVO.vazio);
      regiaoErroRef.current?.focus();
      return;
    }
    if (ficheiro.size > TAMANHO_MAXIMO) {
      setErro(MENSAGENS_COMPROVATIVO.grande);
      regiaoErroRef.current?.focus();
      return;
    }

    // Pré-validação por magic bytes (o servidor revalida e é a autoridade).
    const cabeca = new Uint8Array(await ficheiro.slice(0, 16).arrayBuffer());
    const tipo = detetarTipo(cabeca);
    const extensao = extensaoDe(ficheiro.name);

    if (!tipo || !extensao || FORMATOS_COMPROVATIVO[extensao] !== tipo.mime) {
      setErro(
        !tipo ? MENSAGENS_COMPROVATIVO.formato : MENSAGENS_COMPROVATIVO.incompativel
      );
      regiaoErroRef.current?.focus();
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setArquivo(ficheiro);
    if (tipo.mime.startsWith("image/")) {
      setPreview(URL.createObjectURL(ficheiro));
      setTipoPreview("imagem");
    } else {
      setPreview(null);
      setTipoPreview("pdf");
    }
  }

  function trocarFicheiro() {
    setArquivo(null);
    setPreview(null);
    setTipoPreview(null);
    limparErro();
    // abre o seletor novamente
    window.setTimeout(() => inputRef.current?.click(), 0);
  }

  function enviar() {
    if (!arquivo) return;
    setEstado("a-enviar");
    setProgresso(0);
    limparErro();

    const form = new FormData();
    form.append("inscricaoId", inscricaoId);
    form.append("pagamentoId", pagamentoId);
    form.append("ficheiro", arquivo);

    // XHR (e não fetch) por causa do progresso de upload.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/comprovativo");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgresso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const dados = JSON.parse(xhr.responseText) as { comprovativoId: string };
          setEstado("inativo");
          onSucesso(dados.comprovativoId);
          return;
        } catch {
          // cai no erro genérico de servidor abaixo
        }
      }
      tratarFalha(xhr.responseText);
    };
    xhr.onerror = () => {
      setEstado("inativo");
      setFalhaServidor(true);
      setErro("Sem ligação ao servidor. Verifica a internet e tenta novamente.");
      regiaoErroRef.current?.focus();
    };
    xhr.send(form);
  }

  function tratarFalha(resposta: string) {
    setEstado("inativo");
    let tipo = "servidor";
    let mensagem: string | null = null;
    try {
      const dados = JSON.parse(resposta) as { tipo?: string; mensagem?: string };
      if (dados.tipo) tipo = dados.tipo;
      mensagem = dados.mensagem ?? null;
    } catch {
      // resposta não-JSON → servidor
    }

    if (tipo === "servidor") {
      setFalhaServidor(true);
      setErro(mensagem ?? MENSAGENS_COMPROVATIVO.servidor);
    } else if (tipo === "rate") {
      setFalhaServidor(false);
      setErro(MENSAGENS.rateLimit);
    } else {
      // validacao / bot: mensagem do servidor (campos assinalados no form)
      setFalhaServidor(false);
      setErro(mensagem ?? MENSAGENS_COMPROVATIVO.formato);
    }
    regiaoErroRef.current?.focus();
  }

  const aEnviar = estado === "a-enviar";

  return (
    <div>
      <div
        ref={regiaoErroRef}
        tabIndex={-1}
        aria-live="assertive"
        className="focus:outline-none"
      >
        {erro && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-5 overflow-hidden rounded-sm border border-[#e88b8b]/40 bg-[#e88b8b]/10 px-4 py-3 text-[0.875rem] text-[#f3c0c0]"
          >
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{erro}</span>
            </p>
            {falhaServidor && (
              <a
                href={linkWhatsApp(
                  SALON_WHATSAPP,
                  "Olá! Ao enviar o comprovativo do Além do Espelho 2026 a gravação falhou e preciso de ajuda para garantir o meu lugar."
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir conversa no WhatsApp para tratar do meu comprovativo"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#f3c0c0]/40 px-4 py-2 text-[0.8125rem] font-medium text-[#f3c0c0] transition-colors duration-300 hover:border-[#f3c0c0] hover:bg-[#f3c0c0]/10"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            )}
          </motion.div>
        )}
      </div>

      {!arquivo ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setArrastar(true);
          }}
          onDragLeave={() => setArrastar(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastar(false);
            void aoEscolher(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-6 py-10 text-center transition-colors duration-300 ${
            arrastar
              ? "border-rosa bg-rosa/10"
              : "border-creme/25 bg-creme/[0.03] hover:border-creme/45 hover:bg-creme/[0.06]"
          }`}
        >
          <Upload className="h-8 w-8 text-blush" aria-hidden />
          <span className="text-[0.9375rem] font-medium text-creme">
            Arrasta o comprovativo aqui
          </span>
          <span className="text-[0.8125rem] text-creme/55">
            ou <span className="text-blush underline decoration-dotted underline-offset-4">escolhe um ficheiro</span>
            <br />
            PNG · JPG · WEBP · PDF · máx. 8 MB
          </span>
          <input
            ref={inputRef}
            id="comprovativo"
            name="comprovativo"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
            className="sr-only"
            aria-label="Escolher ficheiro do comprovativo"
            onChange={(e) => void aoEscolher(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="rounded-sm border border-creme/20 bg-creme/[0.04] p-4">
          <div className="flex items-start gap-4">
            {tipoPreview === "imagem" && preview ? (
              // Preview local (object URL) — nunca sai da máquina do utilizador.
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-creme/15 bg-carvao">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-sm border border-creme/15 bg-carvao">
                <FileText className="h-7 w-7 text-blush" aria-hidden />
                <span className="text-[0.625rem] font-medium uppercase tracking-wider text-creme/55">
                  PDF
                </span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-medium text-creme">{arquivo.name}</p>
              <p className="mt-0.5 text-[0.8125rem] text-creme/55">{tamanhoLegivel(arquivo.size)}</p>
              <button
                type="button"
                onClick={trocarFicheiro}
                disabled={aEnviar}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-creme/20 px-3 py-1.5 text-[0.8125rem] font-medium text-creme/70 transition-colors duration-300 hover:border-creme/45 hover:text-creme disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Trocar ficheiro
              </button>
            </div>
          </div>
        </div>
      )}

      {arquivo && (
        <>
          {aEnviar && (
            <div className="mt-4">
              <div
                role="progressbar"
                aria-valuenow={progresso}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso do envio do comprovativo"
                className="h-1.5 w-full overflow-hidden rounded-full bg-creme/10"
              >
                <motion.div
                  className="h-full rounded-full bg-rosa"
                  animate={{ width: `${progresso}%` }}
                  transition={{ ease: "easeOut", duration: 0.15 }}
                />
              </div>
              <p className="mt-2 text-[0.8125rem] text-creme/55">
                A enviar… {progresso}%
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={aEnviar}
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(186,121,132,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aEnviar ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            {aEnviar ? "A enviar comprovativo…" : "Enviar comprovativo"}
          </button>

          {!aEnviar && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[0.8125rem] leading-relaxed text-creme/45">
              <X className="hidden" aria-hidden />
              O comprovativo fica guardado em segurança e só nós o vemos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
