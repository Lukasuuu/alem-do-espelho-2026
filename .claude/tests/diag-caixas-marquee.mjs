import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const pular = page.locator("text=Pular").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
  await pular.click();
}
await page.waitForTimeout(1000);

await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  if (!m) return;
  const rect = m.getBoundingClientRect();
  window.scrollTo(0, rect.top + window.scrollY - 300);
});
await page.waitForTimeout(2000);

const caixas = await page.evaluate(() => {
  const logos = [...document.querySelectorAll(".marquee-foco .azulejo-logo")];
  return logos.map((el) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector("img");
    const ir = img?.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      bg: getComputedStyle(el).backgroundColor,
      img: ir
        ? { w: Math.round(ir.width), h: Math.round(ir.height), dentro: ir.width <= r.width + 1 && ir.height <= r.height + 1 }
        : null,
    };
  });
});

console.log("=== CAIXAS DOS LOGOS (devem ser 4: 2 blocos × 2 marcas) ===");
caixas.forEach((c, i) => console.log(`  ${i}: ${c.w}×${c.h}px bg=${c.bg} img=${JSON.stringify(c.img)}`));

const larguras = [...new Set(caixas.map((c) => c.w))];
const alturas = [...new Set(caixas.map((c) => c.h))];
const dentro = caixas.every((c) => c.img?.dentro);
console.log(`\nLarguras únicas: ${larguras.join(",")}  (esperado 180)`);
console.log(`Alturas únicas: ${alturas.join(",")}  (esperado 72)`);
console.log(`Todas as imagens dentro da caixa: ${dentro ? "OK" : "FALHOU"}`);

// Gap entre caixas consecutivas do MESMO bloco (x0→x1) e entre blocos (x1→x2).
const gap1 = caixas[1]?.x - (caixas[0]?.x + caixas[0]?.w);
const gap2 = caixas[2]?.x - (caixas[1]?.x + caixas[1]?.w);
console.log(`Gap dentro do bloco: ${gap1}px  (esperado 56)`);
console.log(`Gap entre blocos: ${gap2}px  (esperado 56)`);

await page.screenshot({ path: ".claude/tests/marquee-caixas-final.png" });
await browser.close();
