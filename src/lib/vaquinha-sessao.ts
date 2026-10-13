/**
 * Sessão do VOLUNTÁRIO que confirma as doações (V5) — só servidor.
 *
 * Duas coisas separadas de propósito:
 *  · a PALAVRA-PASSE que a pessoa escreve (env `VAQUINHA_VOLUNTARIO_HASH`, com o
 *    sha256 em hex — a palavra-passe em claro não existe em lado nenhum);
 *  · a CHAVE ADMIN que fala com as RPCs (env `VAQUINHA_ADMIN_CHAVE`), que o
 *    browser nunca vê: as RPCs de admin são chamadas daqui, no servidor.
 *  Ou seja: saber a palavra-passe dá acesso ao ECRÃ, não à chave.
 *
 * O cookie de sessão não é a palavra-passe nem o seu hash: é um valor derivado
 * (sha256 de "sessao:" + hash), portanto não se pode forjar sem conhecer o hash
 * e não serve para mais nada. Fica httpOnly, Secure, SameSite=Strict e com o
 * path limitado a esta rota — não vai em pedidos para o resto do site.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const NOME_COOKIE = "vaquinha-voluntario";

export const COOKIE_VOLUNTARIO = {
  nome: NOME_COOKIE,
  opcoes: {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    /**
     * Path `/`: o painel vive em /alem-do-espelho-2026/vaquinha/confirmar e as
     * rotas que ele usa em /api/vaquinha/voluntario/… — não há prefixo comum
     * senão a raiz, e com o path limitado à página as chamadas de API iam SEM
     * cookie (davam 401 com o painel aparentemente com sessão). O que limita a
     * exposição é o resto: httpOnly, Secure, SameSite=Strict e o valor ser um
     * token derivado que só serve para este painel.
     */
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // um mês: a vaquinha dura até 18/11
  },
};

function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Comparação em tempo constante de duas cadeias de comprimento conhecido. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function hashEsperado(): string | null {
  const h = process.env.VAQUINHA_VOLUNTARIO_HASH?.trim().toLowerCase();
  if (!h) {
    console.error("[vaquinha] VAQUINHA_VOLUNTARIO_HASH ausente — ninguém entra no painel do voluntário");
    return null;
  }
  return h;
}

/** A palavra-passe submetida é a certa? */
export function senhaValida(submetida: string): boolean {
  const esperado = hashEsperado();
  if (!esperado) return false;
  return iguais(sha256(submetida), esperado);
}

/** Valor do cookie de sessão (derivado — ver o cabeçalho). */
export function tokenSessao(): string | null {
  const h = hashEsperado();
  return h ? sha256(`sessao:${h}`) : null;
}

/** Serve para a página e para as rotas: sem cookie certo, nada de dados. */
export async function sessaoValida(): Promise<boolean> {
  const esperado = tokenSessao();
  if (!esperado) return false;
  const atual = (await cookies()).get(NOME_COOKIE)?.value;
  return atual !== undefined && iguais(atual, esperado);
}
