/**
 * QA COMPLETO das modais — valida que TODAS (inscrição, termos, privacidade,
 * patrocínio) abrem ALINHADAS AO TOPO em 4 viewports, com respiro responsivo,
 * scroll interno e comportamentos de acessibilidade (ESC, clique fora, trap de
 * foco) — sem overflow horizontal e sem console errors.
 *
 * Roda contra o preview (evento via header x-cutover-test: after) ou contra
 * um servidor local. Chrome do sistema, sem download de browser.
 *
 * Uso: node scripts/modal-qa.mjs [URL]
 */
import { chromium } from "playwright-core";

const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

// default: preview do release com header pós-corte -> landing do evento (tem modais)
const URL =
  process.argv[2] ??
  "https://alem-do-espelho-2026-g322q74hq-lukasuuus-projects.vercel.app/alem-do-espelho-2026";

const VIEWPORTS = [
  { nome: "mobile", w: 390, h: 844 },
  { nome: "tablet", w: 768, h: 1024 },
  { nome: "notebook", w: 1280, h: 800 },
  { nome: "desktop", w: 1536, h: 864 },
];

const CTA = {
  inscricao: page =>
    page
      .locator("button:visible, a:visible")
      .filter({ hasText: /inscrição|inscrever|garantir|entrar na lista/i })
      .filter({ hasNotText: /saltar|skip/i })
      .first(),
  termos: page => page.getByRole("button", { name: /Termos de Serviço/i }).first(),
  privacidade: page => page.getByRole("button", { name: /Política de Privacidade/i }).first(),
  patrocinio: page =>
    page
      .locator("button:visible")
      .filter({ hasText: /Quero Patrocinar/ })
      .first(),
};

let totalFalhas = 0;

function falha(tag, msg) {
  totalFalhas++;
  console.log(`  [${tag}] ✗ ${msg}`);
}

async function abrirModal(page, tag, cta) {
  if ((await cta.count()) === 0) {
    falha(tag, "CTA não encontrado");
    return null;
  }
  await cta.click();
  await page.waitForSelector(".modal-overlay", { state: "visible", timeout: 15000 });
  await page.waitForTimeout(700); // animação 0.35s + folga
  return page.locator(".modal-overlay").first();
}

async function medirModal(page, tag) {
  const overlay = page.locator(".modal-overlay");
  const painel = page.locator(".modal-content");
  const dados = await overlay.first().evaluate((el, tagAtual) => {
    const s = getComputedStyle(el);
    const p = document.querySelector(".modal-content");
    const pr = p.getBoundingClientRect();
    const ps = getComputedStyle(p);
    return {
      tag: tagAtual,
      temClasseTop: el.classList.contains("modal-overlay-top"),
      ov: {
        alignItems: s.alignItems,
        justifyContent: s.justifyContent,
        position: s.position,
        paddingTop: s.paddingTop,
      },
      painel: {
        top: Math.round(pr.top),
        height: Math.round(pr.height),
        maxHeight: ps.maxHeight,
        overflowY: ps.overflowY,
      },
      viewportH: window.innerHeight,
      overflowHorizontal:
        document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, tag);

  const o = dados.ov;
  const pc = dados.painel;

  console.log(`  [${tag}] overlay: ${JSON.stringify(o)}  (class top: ${dados.temClasseTop})`);
  console.log(
    `  [${tag}] painel: top=${pc.top}px viewportH=${dados.viewportH}px height=${pc.height}px maxHeight=${pc.maxHeight} overflowY=${pc.overflowY}`
  );

  // ── Asserções ──
  if (o.alignItems !== "flex-start") falha(tag, `overlay alignItems=${o.alignItems} (esperado flex-start)`);
  if (o.justifyContent !== "center") falha(tag, `overlay justifyContent=${o.justifyContent} (esperado center)`);
  if (!dados.temClasseTop) falha(tag, "overlay sem a classe anti-regressão modal-overlay-top");
  if (pc.overflowY !== "auto") falha(tag, `painel overflowY=${pc.overflowY} (esperado auto)`);
  if (dados.overflowHorizontal) falha(tag, "overflow horizontal no documento");
  const topoNum = parseFloat(o.paddingTop);
  if (Math.abs(pc.top - topoNum) > 2) falha(tag, `painel.top=${pc.top}px não bate com paddingTop=${topoNum}px`);
  if (pc.top <= 0 || pc.top > dados.viewportH * 0.3)
    falha(tag, `painel.top=${pc.top}px não é "com respiro" no topo`);
  return dados;
}

async function verificarComportamento(page, tag) {
  // 1) Foco entrou no painel ao abrir.
  const focoDentro = await page.evaluate(() => {
    const a = document.activeElement;
    return !!a && !!a.closest?.(".modal-content");
  });
  if (!focoDentro) falha(tag, "foco não entrou no painel ao abrir");

  // 2) Trap de foco: Tab avança mantendo dentro do painel.
  await page.keyboard.press("Tab");
  const tabDentro = await page.evaluate(() => {
    const a = document.activeElement;
    return !!a && !!a.closest?.(".modal-content");
  });
  if (!tabDentro) falha(tag, "Tab escapou do painel (trap de foco falhou)");

  // 3) ESC fecha.
  await page.keyboard.press("Escape");
  await page.waitForSelector(".modal-overlay", { state: "detached", timeout: 8000 }).catch(() => {
    falha(tag, "ESC não fechou a modal");
  });
}

async function testarModal(page, tag, cta) {
  console.log(`  ── abrir: ${tag}`);
  const overlay = await abrirModal(page, tag, cta);
  if (!overlay) return;
  await medirModal(page, tag);
  await verificarComportamento(page, tag);
  await page.waitForTimeout(400);
}

async function testarCliqueFora(page, tag, cta) {
  console.log(`  ── abrir (clique fora): ${tag}`);
  const overlay = await abrirModal(page, tag, cta);
  if (!overlay) return;
  await medirModal(page, tag);
  // Clique no canto do overlay (fora do painel).
  await page.mouse.click(3, 3);
  const fechou = await page
    .waitForSelector(".modal-overlay", { state: "detached", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!fechou) falha(tag, "clique fora não fechou a modal");
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  // Header pós-corte para renderizar a landing do evento (que tem as modais).
  await ctx.setExtraHTTPHeaders({ "x-cutover-test": "after" });
  const page = await ctx.newPage();
  const erros = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(String(e)));

  console.log(`\n=== ${vp.nome} ${vp.w}x${vp.h} ===`);
  await page.goto(URL, { waitUntil: "networkidle" });
  const eEvento = await page.getByText("Quero Patrocinar").count();
  console.log(`  versão renderizada: ${eEvento > 0 ? "EVENTO" : "???"}`);

  await testarModal(page, "inscricao", CTA.inscricao(page));
  await testarCliqueFora(page, "inscricao", CTA.inscricao(page));

  // Rodapé -> modais legais (scroll automático pelo Playwright ao clicar).
  await testarModal(page, "termos", CTA.termos(page));
  await testarModal(page, "privacidade", CTA.privacidade(page));

  // Patrocínio (modal de formulário + success).
  await testarModal(page, "patrocinio", CTA.patrocinio(page));

  console.log(`  [${vp.nome}] console errors: ${erros.length}`);
  erros.slice(0, 5).forEach((e) => console.log(`    - ${e.slice(0, 160)}`));
  await ctx.close();
}

await browser.close();
console.log(`\n${totalFalhas === 0 ? "TODAS AS MODAIS OK" : `${totalFalhas} FALHA(S)`}`);
process.exit(totalFalhas === 0 ? 0 : 1);
