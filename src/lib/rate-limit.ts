import { createHash } from "node:crypto";

type Registo = { contagem: number; expiraEm: number };

/**
 * Janela fixa em memória, por instância da função.
 * Em serverless não é partilhada entre instâncias, é uma primeira barreira,
 * não a única: o índice único de email na base de dados é a garantia final.
 */
const janelas = new Map<string, Registo>();

const LIMITE = 5;
const JANELA_MS = 60_000;
const MAX_CHAVES = 5_000;

export function rateLimit(
  chave: string,
  limite = LIMITE,
  janelaMs = JANELA_MS
): { permitido: boolean; restantes: number; resetEm: number } {
  const agora = Date.now();
  const registo = janelas.get(chave);

  if (!registo || registo.expiraEm <= agora) {
    if (janelas.size > MAX_CHAVES) limparExpirados(agora);
    janelas.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return { permitido: true, restantes: limite - 1, resetEm: agora + janelaMs };
  }

  registo.contagem += 1;

  return {
    permitido: registo.contagem <= limite,
    restantes: Math.max(0, limite - registo.contagem),
    resetEm: registo.expiraEm,
  };
}

function limparExpirados(agora: number) {
  for (const [chave, registo] of janelas) {
    if (registo.expiraEm <= agora) janelas.delete(chave);
  }
}

/** Extrai o IP real por trás do proxy da Vercel. */
export function obterIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "desconhecido";
}

/**
 * Guardamos apenas o hash do IP, suficiente para detetar abuso,
 * sem armazenar um identificador pessoal em claro (RGPD).
 */
export function hashIp(ip: string): string {
  const sal = process.env.IP_HASH_SALT ?? "alem-do-espelho-2026";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
}
