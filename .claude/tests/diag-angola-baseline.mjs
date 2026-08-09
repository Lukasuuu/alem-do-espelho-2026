import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Fechar modal
const pular = page.locator("text=Pular").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
  await pular.click();
  console.log("Modal fechado");
}
await page.waitForTimeout(1000);

// Localizar a linha "Impactando vidas em Angola" e a secção "Quem faz acontecer"
const diag = await page.evaluate(() => {
  const angola = [...document.querySelectorAll("p")]
    .find((p) => p.textContent.includes("Impactando vidas em Angola"));
  const realizacao = [...document.querySelectorAll("h2")]
    .find((h) => h.textContent.includes("Quem faz acontecer"));
  const strip = realizacao?.closest("section");

  function rect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), x: Math.round(r.x) };
  }

  // Zona B: o container com border-t que tem as entidades
  const zonaB = realizacao?.closest("section")?.querySelector(".border-t");

  return {
    angola: rect(angola),
    stripTop: rect(strip),
    zonaB: rect(zonaB),
    gapAngolaAteStrip: strip && angola ? Math.round(strip.getBoundingClientRect().top - angola.getBoundingClientRect().bottom) : null,
    gapAngolaAteZonaB: zonaB && angola ? Math.round(zonaB.getBoundingClientRect().top - angola.getBoundingClientRect().bottom) : null,
    scrollY: window.scrollY,
    bodyH: document.body.scrollHeight,
  };
});
console.log("=== ESPAÇAMENTO ANGOLA → REALIZAÇÃO ===");
console.log(JSON.stringify(diag, null, 2));

// Scroll para o fim do texto de Angola e capturar
const angolaEl = await page.evaluateHandle(() => {
  return [...document.querySelectorAll("p")]
    .find((p) => p.textContent.includes("Impactando vidas em Angola"));
});
await angolaEl.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.waitForTimeout(800);
await page.screenshot({ path: ".claude/tests/angola-baseline-topo.png" });

await browser.close();
