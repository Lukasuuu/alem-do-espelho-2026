/**
 * FASE 1 — ASSETS da modal de pagamento (PROMPT 2)
 *
 * Converte os PNGs fornecidos para WebP otimizado:
 *  1. doacoes.png         →  doacoes.webp          (kit de higiene, ≤200KB)
 *  2. pontoderecolha.png  →  pontoderecolha.webp   (onde entregar, ≤220KB)
 *
 * Regras:
 *  - Mantém os originais (.png) intactos.
 *  - O código aponta para .webp.
 *
 * Uso: node scripts/convert-inscricao-assets.mjs
 */
import sharp from "sharp";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = join(root, "public", "brand");

/** Tamanho legível para a tabela de pesos. */
function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Converte uma imagem → WebP tentando a qualidade mais alta dentro do orçamento.
 * Redimensiona só se a fonte exceder a largura máxima.
 */
async function converter(nome, { larguraMax, orcamentoKB, qualidadeInicial }) {
  const origem = join(brand, `${nome}.png`);
  const destino = join(brand, `${nome}.webp`);
  const meta = await sharp(origem).metadata();

  const largura = Math.min(meta.width, larguraMax);
  const orcamento = orcamentoKB * 1024;
  let q = qualidadeInicial;
  let buf;

  for (;;) {
    buf = await sharp(origem)
      .resize({ width: largura, withoutEnlargement: true })
      .webp({ quality: q, effort: 5, smartSubsample: true })
      .toBuffer();
    if (buf.length <= orcamento || q <= 55) break;
    q -= 5;
  }

  writeFileSync(destino, buf);
  return {
    nome: `${nome}.webp`,
    antes: statSync(origem).size,
    depois: buf.length,
    dimensao: `${largura}x${meta.height}`,
    qualidade: q,
    orcamento: orcamentoKB,
  };
}

// ── Execução ────────────────────────────────────────────────────────────────
const alvos = [
  { nome: "doacoes", larguraMax: 1200, orcamentoKB: 200, qualidadeInicial: 85 },
  { nome: "pontoderecolha", larguraMax: 1200, orcamentoKB: 220, qualidadeInicial: 85 },
];

const linhas = [["Asset", "Antes", "Depois", "Dim.", "Qual.", "Orçamento"]];

for (const alvo of alvos) {
  const r = await converter(alvo.nome, alvo);
  linhas.push([
    r.nome,
    fmt(r.antes),
    fmt(r.depois),
    r.dimensao,
    `q${r.qualidade}`,
    `≤${r.orcamento}KB`,
  ]);
  if (r.depois > r.orcamento * 1024) {
    console.warn(`⚠  ${r.nome} excede ${r.orcamento}KB (${fmt(r.depois)}) — ajustar manualmente.`);
  }
}

const colW = [0, 0, 0, 0, 0, 0];
for (const l of linhas) l.forEach((c, i) => (colW[i] = Math.max(colW[i], c.length)));
const sep = colW.map((w) => "-".repeat(w)).join(" | ");
console.log("Tabela de pesos (antes → depois):");
console.log(sep);
for (const l of linhas) {
  console.log(l.map((c, i) => c.padEnd(colW[i])).join(" | "));
}
console.log(sep);
console.log("Originais .png mantidos intactos.");
console.log(`Destino: ${brand}`);
