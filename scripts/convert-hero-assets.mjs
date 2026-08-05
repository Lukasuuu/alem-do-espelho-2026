/**
 * FASE 1 — ASSETS do novo Hero (PROMPT 1)
 *
 * Converte os PNGs fornecidos para WebP otimizado:
 *  1. fotoprincipal.png  →  fotoprincipal.webp  (foto, maxW 1600, ≤300KB)
 *  2. alemdemim.png      →  alemdemim.webp      (lettering, chroma-key preto → alpha)
 *
 * Regras:
 *  - Mantém os originais (.png) intactos.
 *  - Layout.png NUNCA é publicado — é só referência de design.
 *  - O código aponta para .webp.
 *
 * Uso: node scripts/convert-hero-assets.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = join(root, "public", "brand");

/** Tamanho legível para a tabela de pesos. */
function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Converte fotoprincipal → WebP tentando a qualidade mais alta dentro do orçamento. */
async function converterFoto() {
  const origem = join(brand, "fotoprincipal.png");
  const destino = join(brand, "fotoprincipal.webp");
  const meta = await sharp(origem).metadata();
  const larguraMax = 1600;

  // A fonte já tem 1078px — nunca ampliar.
  const largura = Math.min(meta.width, larguraMax);

  const orcamento = 300 * 1024; // ≤300KB
  let q = 82;
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
    nome: "fotoprincipal.webp",
    antes: statSync(origem).size,
    depois: buf.length,
    dimensao: `${largura}x${meta.height}`,
    qualidade: q,
  };
}

/**
 * Chroma-key por luminância no alemdemim.
 * Fundo = preto opaco (lum < 20). Letras = branco quente (lum ~246).
 * alpha = clamp((lum − 30) × 255/180, 0, 255) → preto sai a 0, letras a ≥225,
 * com rampa suave para preservar o antialias da caligrafia.
 */
function chromaKeyLuminancia(data, info) {
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const a = Math.round(Math.min(255, Math.max(0, (lum - 30) * (255 / 180))));
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a;
  }
  return out;
}

async function converterLettering() {
  const origem = join(brand, "alemdemim.png");
  const destino = join(brand, "alemdemim.webp");
  const { data, info } = await sharp(origem)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const chaveado = chromaKeyLuminancia(data, info);

  const buf = await sharp(chaveado, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toBuffer();
  writeFileSync(destino, buf);
  return {
    nome: "alemdemim.webp",
    antes: statSync(origem).size,
    depois: buf.length,
    dimensao: `${info.width}x${info.height}`,
    qualidade: 92,
  };
}

// ── Execução ────────────────────────────────────────────────────────────────
const linhas = [["Asset", "Antes", "Depois", "Dim.", "Qual."]];

for (const r of [await converterFoto(), await converterLettering()]) {
  linhas.push([r.nome, fmt(r.antes), fmt(r.depois), r.dimensao, `q${r.qualidade}`]);
  if (r.nome === "fotoprincipal.webp" && r.depois > 300 * 1024) {
    console.warn(`⚠  ${r.nome} excede 300KB (${fmt(r.depois)}) — ajustar manualmente.`);
  }
}

const colW = [0, 0, 0, 0, 0];
for (const l of linhas) l.forEach((c, i) => (colW[i] = Math.max(colW[i], c.length)));
const sep = colW.map((w) => "-".repeat(w)).join(" | ");
console.log("Tabela de pesos (antes → depois):");
console.log(sep);
for (const l of linhas) {
  console.log(l.map((c, i) => c.padEnd(colW[i])).join(" | "));
}
console.log(sep);
console.log("Layout.png permanece como referência — NÃO publicado.");
console.log(`Destino: ${brand}`);
