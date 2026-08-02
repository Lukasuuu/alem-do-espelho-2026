/**
 * SMOKE TEST do corte lista→evento (2026-08-03T10:00+01:00).
 *
 * Valida por request real (fetch, sem browser):
 *   - Fase PRÉ-corte:  /alem-do-espelho-2026 → 308 → /alem-do-espelho-2026/lista
 *                       /alem-do-espelho-2026/lista → 200 (lista de espera)
 *                       sitemap contém a rota /lista
 *   - Fase PÓS-corte:  /alem-do-espelho-2026/lista → 308 → /alem-do-espelho-2026
 *                       /alem-do-espelho-2026 → 200 (evento)
 *                       sitemap contém a rota /alem-do-espelho-2026
 *   - Rotas legacy:    /, /lista, /lista-de-espera → 308 (nunca 200)
 *   - Anti-cache:      rotas de cutover servem com Cache-Control no-store
 *
 * Em produção o header x-cutover-test é IGNORADO (verifica a fase real).
 * Em preview o header pode forçar a fase (x-cutover-test: before|after).
 *
 * Uso:
 *   node scripts/smoke-cutover.mjs [BASE_URL]
 *     BASE_URL default: https://alem-do-espelho-2026-89i2n5l2v-lukasuuus-projects.vercel.app
 *
 * NOTA: o corte real é 2026-08-03T10:00:00+01:00 (src/lib/site.ts, fonte única).
 */

// ── Config ────────────────────────────────────────────────────────────────
const BASE_URL =
  process.argv[2] ??
  "https://alem-do-espelho-2026-89i2n5l2v-lukasuuus-projects.vercel.app";
const CORTE_MS = new Date("2026-08-03T10:00:00+01:00").getTime();

const ROTAS = {
  raiz: "",
  evento: "/alem-do-espelho-2026",
  lista: "/alem-do-espelho-2026/lista",
  legacyLista: "/lista",
  legacyListaEspera: "/lista-de-espera",
  sitemap: "/sitemap.xml",
};

let totalFalhas = 0;
function falha(msg) {
  totalFalhas++;
  console.log(`  ✗ ${msg}`);
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

/** GET e devolve { status, location, cacheControl, body } sem seguir redirects. */
async function get(path, faseHeader) {
  const headers = faseHeader ? { "x-cutover-test": faseHeader } : {};
  const r = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers,
  });
  const cacheControl = r.headers.get("cache-control") ?? "";
  const text = await r.text();
  return {
    status: r.status,
    location: r.headers.get("location") ?? "",
    cacheControl,
    body: text,
  };
}

function checa308(resp, destinoEsperado, tag) {
  if (resp.status !== 308)
    return falha(`${tag}: status ${resp.status} (esperado 308)`);
  if (!resp.location.includes(destinoEsperado))
    return falha(`${tag}: location "${resp.location}" não aponta para ${destinoEsperado}`);
  ok(`${tag}: 308 → ${resp.location}`);
}

// ── Relógio ───────────────────────────────────────────────────────────────
const agora = new Date().getTime();
const falta = CORTE_MS - agora;
const faseReal = agora >= CORTE_MS ? "PÓS-CORTE (evento ativo)" : "PRÉ-CORTE (lista ativa)";
console.log(`== smoke-cutover · ${new Date().toISOString()} ==`);
console.log(`Corte: 2026-08-03T10:00:00+01:00 (em ${falta >= 0 ? `${Math.round(falta / 60000)} min` : "passado"})`);
console.log(`BASE_URL: ${BASE_URL}`);
console.log(`Fase real agora: ${faseReal}`);
console.log(`Header x-cutover-test: ${process.argv[3] ? `"${process.argv[3]}"` : "(não forçado)"}`);

const forca = process.argv[3]; // "before" | "after" | undefined

// ── Rota ativa esperada ───────────────────────────────────────────────────
const esperaPre = forca === "after" ? false : forca === "before" ? true : agora < CORTE_MS;
const faseTeste = esperaPre ? "PRÉ-CORTE" : "PÓS-CORTE";
console.log(`\n=== Fase testada: ${faseTeste} ===`);

// Rotas de cutover — comportamento por fase
console.log("\n-- rotas de cutover --");
if (esperaPre) {
  await checa308(await get(ROTAS.evento, forca), ROTAS.lista, "/alem-do-espelho-2026");
  const lista = await get(ROTAS.lista, forca);
  if (lista.status !== 200) falha(`/lista: status ${lista.status} (esperado 200)`);
  else ok("/lista: 200 (lista de espera)");
  if (!/Lista de Espera|Entra na lista|lista de espera/i.test(lista.body))
    falha("/lista: corpo não parece a lista de espera");
  else ok("/lista: corpo contém copy da lista de espera");
  if (!/no-store/.test(lista.cacheControl))
    falha(`/lista: Cache-Control sem no-store ("${lista.cacheControl}")`);
  else ok("/lista: Cache-Control no-store (anti-cache na virada)");
} else {
  await checa308(await get(ROTAS.lista, forca), ROTAS.evento, "/alem-do-espelho-2026/lista");
  const evento = await get(ROTAS.evento, forca);
  if (evento.status !== 200) falha(`/alem-do-espelho-2026: status ${evento.status} (esperado 200)`);
  else ok("/alem-do-espelho-2026: 200 (evento)");
  if (!/Além de Mim|17 OUT|INNSiDE|inscrições/i.test(evento.body))
    falha("/alem-do-espelho-2026: corpo não parece a versão do evento");
  else ok("/alem-do-espelho-2026: corpo contém copy do evento");
  if (!/no-store/.test(evento.cacheControl))
    falha(`/alem-do-espelho-2026: Cache-Control sem no-store ("${evento.cacheControl}")`);
  else ok("/alem-do-espelho-2026: Cache-Control no-store (anti-cache na virada)");
}

// ── Rotas legacy — sempre 308 ─────────────────────────────────────────────
console.log("\n-- rotas legacy (sempre 308) --");
await checa308(await get(ROTAS.raiz, forca), ROTAS.evento, "/ (raiz)");
await checa308(await get(ROTAS.legacyLista, forca), ROTAS.lista, "/lista (legacy)");
await checa308(await get(ROTAS.legacyListaEspera, forca), ROTAS.lista, "/lista-de-espera (legacy)");

// ── Sitemap fase-aware ────────────────────────────────────────────────────
console.log("\n-- sitemap --");
const sitemap = await get(ROTAS.sitemap, forca);
if (sitemap.status !== 200) falha(`/sitemap.xml: status ${sitemap.status}`);
else {
  // Compara os <loc> EXATOS — substring engana (a rota /lista contém /alem-do-espelho-2026 como prefixo).
  const locs = [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const rotaEsperada = esperaPre ? ROTAS.lista : ROTAS.evento;
  if (locs.length !== 1)
    falha(`/sitemap.xml: ${locs.length} loc (esperado exatamente 1)`);
  else if (!locs[0].endsWith(rotaEsperada))
    falha(`/sitemap.xml: loc "${locs[0]}" não termina em ${rotaEsperada}`);
  else ok(`/sitemap.xml: único loc = ${rotaEsperada} (fase ${faseTeste})`);
  const rotaOutraFase = esperaPre ? ROTAS.evento : ROTAS.lista;
  const outra = locs.find((l) => l.endsWith(rotaOutraFase));
  if (outra)
    falha(`/sitemap.xml: contém a rota da outra fase ${outra} (nunca indexar 2 versões)`);
  else ok(`/sitemap.xml: não contém ${rotaOutraFase}`);
}

console.log(`\n${totalFalhas === 0 ? "SMOKE CUTOVER OK ✓" : `${totalFalhas} FALHA(S)`}`);
process.exit(totalFalhas === 0 ? 0 : 1);
