/**
 * Comprovativos de pagamento — constantes e validação partilhadas entre o
 * componente de upload (cliente) e a rota /api/comprovativo (servidor).
 *
 * A regra de segurança: nunca confiar na extensão do ficheiro. A rota valida
 * os magic bytes no servidor (detetarTipo) e rejeita ficheiros cujo conteúdo
 * não corresponda à extensão reclamada.
 */

/** Bucket privado onde vivem os comprovativos (nunca público). */
export const BUCKET_COMPROVATIVOS = "payment-proofs";

/**
 * Bucket PRIVADO dedicado ao PATROCÍNIO (0011 r2) — isolado do bucket das
 * inscrições (payment-proofs): policies, guards e paths próprios. Nunca
 * público, nunca partilhado.
 */
export const BUCKET_COMPROVATIVOS_SPONSOR = "sponsor-payment-proofs";

/** Tamanho máximo de upload: 8 MB (igual ao file_size_limit do bucket). */
export const TAMANHO_MAXIMO = 8 * 1024 * 1024;

/** Formatos aceites: o ficheiro real tem de bater certo com um destes. */
export const FORMATOS_COMPROVATIVO = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
} as const;

export type ExtensaoComprovativo = keyof typeof FORMATOS_COMPROVATIVO;

const EXTENSOES = Object.keys(FORMATOS_COMPROVATIVO) as ExtensaoComprovativo[];

/**
 * Devolve a extensão (normalizada) se estiver na lista de aceites, senão null.
 * Só confirma o NOME — a rota valida o conteúdo com detetarTipo.
 */
export function extensaoDe(nome: string): ExtensaoComprovativo | null {
  const ponto = nome.lastIndexOf(".");
  if (ponto < 0 || ponto === nome.length - 1) return null;
  const ext = nome.slice(ponto + 1).toLowerCase();
  return (EXTENSOES as string[]).includes(ext) ? (ext as ExtensaoComprovativo) : null;
}

/**
 * Identifica o tipo REAL do ficheiro pelos primeiros bytes (magic bytes).
 * PNG, JPEG, WEBP e PDF têm assinaturas bem definidas; qualquer outra coisa
 * devolve null. É esta a autoridade, não a extensão do nome.
 */
export function detetarTipo(bytes: Uint8Array): { ext: ExtensaoComprovativo; mime: string } | null {
  if (bytes.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: FORMATOS_COMPROVATIVO.png };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: FORMATOS_COMPROVATIVO.jpg };
  }

  // WEBP: RIFF .... WEBP (bytes 8–11)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", mime: FORMATOS_COMPROVATIVO.webp };
  }

  // PDF: %PDF-
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { ext: "pdf", mime: FORMATOS_COMPROVATIVO.pdf };
  }

  // HEIC/HEIF: contentor ISOBMFF — "ftyp" nos bytes 4–7 e a marca (brand) nos
  // 8–11. heic/heix/hevc/hevx são HEIC; mif1/msf1 e as variantes heim/heis/
  // hevm/hevs são HEIF (imagens matriciais de iPhone; HEVC-coded ou não).
  // Os browsers não renderizam HEIC nativamente, por isso o preview usa o
  // placeholder (ver PaymentProofUpload) — a policy de storage e a RPC
  // registar_comprovativo já aceitam ambos os MIME.
  if (bytes.length >= 12) {
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp === "ftyp") {
      const marca = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      const marcasHeic = ["heic", "heix", "hevc", "hevx"];
      const marcasHeif = ["mif1", "msf1", "heim", "heis", "hevm", "hevs"];
      if (marcasHeic.includes(marca)) {
        return { ext: "heic", mime: FORMATOS_COMPROVATIVO.heic };
      }
      if (marcasHeif.includes(marca)) {
        return { ext: "heif", mime: FORMATOS_COMPROVATIVO.heif };
      }
    }
  }

  return null;
}

/** Tamanho legível para a UI (ex.: 1,4 MB). */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Mensagens de erro de upload — fonte única para componente e rota. */
export const MENSAGENS_COMPROVATIVO = {
  formato: "Só aceitamos comprovativos em PNG, JPG, WEBP, HEIC ou PDF.",
  grande: "O ficheiro tem mais de 8 MB. Escolhe um mais leve.",
  vazio: "O ficheiro está vazio. Escolhe um comprovativo válido.",
  incompativel: "O conteúdo do ficheiro não corresponde à extensão do nome.",
  semPagamento: "Este pagamento não existe ou já não aceita comprovativos.",
  servidor:
    "Não conseguimos guardar o comprovativo agora. Para não perderes o teu lugar, fala connosco no WhatsApp e resolvemos contigo.",
} as const;
