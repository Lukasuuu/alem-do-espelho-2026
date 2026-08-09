import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Fechar modal se estiver aberto (botao "Pular" ou X)
const pular = page.locator("text=Pular").first();
const closeBtn = page.locator("button:has-text('×')").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
  await pular.click();
  console.log("Modal fechado via 'Pular'");
} else if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
  await closeBtn.click();
  console.log("Modal fechado via X");
} else {
  console.log("Nenhum modal encontrado");
}
await page.waitForTimeout(1000);

// Scroll ate o marquee ficar no centro da viewport
await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  if (!m) return;
  const rect = m.getBoundingClientRect();
  window.scrollTo(0, rect.top + window.scrollY - 300);
});
await page.waitForTimeout(2000); // esperar Reveal animation completa (0.7s + margem)

// Verificar se Reveal ficou visivel
const revealOpacity = await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  // Subir ate encontrar o Reveal wrapper (motion.div com opacity animada)
  let el = m;
  while (el) {
    const op = parseFloat(getComputedStyle(el).opacity);
    if (op < 1 && el !== m) {
      return { opacity: op, tag: el.tagName, cls: el.className?.slice(0, 50) };
    }
    el = el.parentElement;
  }
  return { opacity: 1, note: "all ancestors opaque" };
});
console.log("Reveal opacity:", JSON.stringify(revealOpacity));

// Screenshot 1 — viewport inteira (mostra marquee no contexto)
await page.screenshot({ path: ".claude/tests/marquee-vp-t0.png" });
console.log("Viewport T=0 capturada");

// Estado T=0
const e1 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  const marquee = document.querySelector(".marquee-foco");
  const mr = marquee?.getBoundingClientRect();
  return {
    currentTime: Math.round(anim?.currentTime ?? 0),
    transform: getComputedStyle(track).transform,
    marqueeVP: mr ? { x: Math.round(mr.x), y: Math.round(mr.y), w: Math.round(mr.width), h: Math.round(mr.height) } : null,
    visible: marquee ? parseFloat(getComputedStyle(marquee).opacity) : null,
  };
});
console.log("T=0:", JSON.stringify(e1));

// Esperar 5 segundos
await page.waitForTimeout(5000);

// Screenshot 2
await page.screenshot({ path: ".claude/tests/marquee-vp-t5.png" });
console.log("Viewport T=5 capturada");

const e2 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  const marquee = document.querySelector(".marquee-foco");
  const mr = marquee?.getBoundingClientRect();
  return {
    currentTime: Math.round(anim?.currentTime ?? 0),
    transform: getComputedStyle(track).transform,
    marqueeVP: mr ? { x: Math.round(mr.x), y: Math.round(mr.y), w: Math.round(mr.width), h: Math.round(mr.height) } : null,
  };
});
console.log("T=5:", JSON.stringify(e2));

console.log(`\nTempo: ${e1.currentTime}→${e2.currentTime} (avançou: ${e2.currentTime > e1.currentTime})`);
console.log(`Transform: ${e1.transform} → ${e2.transform}`);

await browser.close();
