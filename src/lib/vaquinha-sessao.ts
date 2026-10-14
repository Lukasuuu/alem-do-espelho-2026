/**
 * Acesso ao painel da Vitória (V5) — só servidor.
 *
 * SEM palavra-passe (decisão do Lucas, 14/10): o painel abre-se por um LINK
 * PESSOAL, `/alem-do-espelho-2026/vaquinha/confirmar?acesso=<token>`. O token
 * tem 32 bytes aleatórios (256 bits) e o que vive na Vercel é APENAS o seu
 * sha256 em hex (`VAQUINHA_ACESSO_HASH`, server-only) — o token em claro só
 * existe no ficheiro que o Lucas guarda fora do repositório.
 *
 * Duas coisas continuam separadas, como antes:
 *  · este TOKEN, que abre o ecrã;
 *  · a CHAVE ADMIN (env `VAQUINHA_ADMIN_CHAVE`), que fala com as RPCs e que o
 *    browser nunca vê: são as rotas de servidor que a usam.
 * Saber o token dá acesso ao ECRÃ, não à chave.
 *
 * Porque não há limite de tentativas aqui: adivinhar 256 bits não é um ataque
 * que se faz, e um limite por IP não lhe acrescenta nada. O que havia antes
 * protegia uma palavra-passe humana escolhida por nós — essa morreu.
 *
 * O cookie não é o token nem o seu hash: é um valor DERIVADO (sha256 de
 * "sessao:" + hash), portanto não se forja sem conhecer o hash e não serve para
 * mais nada. Fica httpOnly, Secure, SameSite=Lax e morre a 20/11/2026 — dois
 * dias depois do fim da vaquinha (18/11), o tempo de corrigir um engano.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const NOME_COOKIE = "vaquinha-painel";

/**
 * Até quando o cookie vive: 20/11/2026. É uma data ABSOLUTA, e não um maxAge,
 * de propósito — a sessão dura o mesmo quer a Vitória entre hoje, amanhã ou na
 * semana do evento, e não fica a valer um mês depois de a vaquinha ter fechado.
 */
const EXPIRA_EM = new Date("2026-11-20T00:00:00+00:00");

export const COOKIE_PAINEL = {
  nome: NOME_COOKIE,
  opcoes: {
    httpOnly: true,
    secure: true,
    /**
     * Lax e não Strict: o primeiro acesso vem de um link aberto no WhatsApp, ou
     * seja de outra origem. Com Strict o cookie era gravado no salto do link
     * mas não seguia no pedido seguinte, e o painel parecia não ter sessão.
     * Lax continua a proteger o que interessa: um POST de outra origem (o
     * /decidir, que muda dinheiro) vai SEM cookie.
     */
    sameSite: "lax" as const,
    /**
     * Path `/`: o painel vive em /alem-do-espelho-2026/vaquinha/confirmar e as
     * rotas que ele usa em /api/vaquinha/voluntario/… — não há prefixo comum
     * senão a raiz, e com o path limitado à página as chamadas de API iam SEM
     * cookie (davam 401 com o painel aparentemente com sessão). O que limita a
     * exposição é o resto: httpOnly, Secure, SameSite=Lax e o valor ser um
     * token derivado que só serve para este painel.
     */
    path: "/",
    expires: EXPIRA_EM,
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
  const h = process.env.VAQUINHA_ACESSO_HASH?.trim().toLowerCase();
  if (!h) {
    console.error("[vaquinha] VAQUINHA_ACESSO_HASH ausente — o painel da Vitória não abre");
    return null;
  }
  return h;
}

/** O token do link é o certo? Compara o sha256 do que veio com o que está na env. */
export function tokenValido(token: string): boolean {
  const esperado = hashEsperado();
  if (!esperado || !token) return false;
  return iguais(sha256(token), esperado);
}

/** Valor do cookie de sessão (derivado — ver o cabeçalho). */
export function tokenSessao(): string | null {
  const h = hashEsperado();
  return h ? sha256(`sessao:${h}`) : null;
}

/**
 * Primeiro acesso pelo link: valida o token e grava o cookie.
 *
 * Só se pode escrever um cookie a partir de um Route Handler ou de um Server
 * Action — nunca do render de uma página. É por isso que a página do painel
 * passa por /api/vaquinha/voluntario/sessao (uma volta) e volta ao URL limpo.
 */
export async function abrirSessao(token: string): Promise<boolean> {
  if (!tokenValido(token)) return false;
  const valor = tokenSessao();
  if (!valor) return false;
  const jar = await cookies();
  jar.set(NOME_COOKIE, valor, COOKIE_PAINEL.opcoes);
  return true;
}

/** Serve para a página e para as rotas: sem cookie certo, nada de dados. */
export async function sessaoValida(): Promise<boolean> {
  const esperado = tokenSessao();
  if (!esperado) return false;
  const atual = (await cookies()).get(NOME_COOKIE)?.value;
  return atual !== undefined && iguais(atual, esperado);
}
