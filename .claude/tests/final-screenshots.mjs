import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3001/alem-do-espelho-2026", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Fechar modal
const pular = page.locator("text=Pular").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) await pular.click();
await page.waitForTimeout(1000);

// Screenshot 1: Marquee centrado
await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  if (m) { const r = m.getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 200); }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: ".claude/tests/final-marquee.png" });
console.log("1/3 final-marquee.png");

// Screenshot 2: Angola + Realizacao
await page.evaluate(() => {
  const s = document.querySelector("section.bg-creme");
  if (s) { const r = s.getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 50); }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: ".claude/tests/final-angola.png" });
console.log("2/3 final-angola.png");

// Screenshot 3: Pagina inteira
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: ".claude/tests/final-pagina-inteira.png", fullPage: true });
console.log("3/3 final-pagina-inteira.png");

await browser.close();
console.log("OK — todos os screenshots guardados");
