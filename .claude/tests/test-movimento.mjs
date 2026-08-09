import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Rolar até patrocinadores
await page.evaluate(() => {
  document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(500);

// Estado inicial
const estado1 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  const rect = track?.getBoundingClientRect();
  const style = track ? getComputedStyle(track) : null;
  return {
    playState: anim?.playState,
    playbackRate: anim?.playbackRate,
    currentTime: anim?.currentTime,
    trackX: rect ? Math.round(rect.x) : null,
    trackWidth: rect ? Math.round(rect.width) : null,
    transform: style?.transform,
  };
});

console.log("=== ESTADO T=0 ===");
console.log(JSON.stringify(estado1, null, 2));

// Screenshot 1
await page.screenshot({
  path: ".claude/tests/movimento-t0.png",
  clip: { x: 370, y: 340, width: 700, height: 120 },
});

// Esperar 3 segundos
await page.waitForTimeout(3000);

// Estado final
const estado2 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  const rect = track?.getBoundingClientRect();
  const style = track ? getComputedStyle(track) : null;
  return {
    playState: anim?.playState,
    playbackRate: anim?.playbackRate,
    currentTime: anim?.currentTime,
    trackX: rect ? Math.round(rect.x) : null,
    trackWidth: rect ? Math.round(rect.width) : null,
    transform: style?.transform,
  };
});

console.log("\n=== ESTADO T=3s ===");
console.log(JSON.stringify(estado2, null, 2));

// Screenshot 2
await page.screenshot({
  path: ".claude/tests/movimento-t3.png",
  clip: { x: 370, y: 340, width: 700, height: 120 },
});

// Análise
const tempoAvancou = (estado2.currentTime ?? 0) > (estado1.currentTime ?? 0);
const posicaoMudou = estado1.trackX !== estado2.trackX;
const estaRodando = estado1.playState === "running" && estado2.playState === "running";

console.log("\n=== ANÁLISE ===");
console.log("Animação rodando:", estaRodando ? "SIM ✓" : "NÃO ✗");
console.log("Tempo avançou:", tempoAvancou ? `SIM (${Math.round(estado1.currentTime)}→${Math.round(estado2.currentTime)}ms)` : "NÃO");
console.log("Posição track mudou:", posicaoMudou ? `SIM (${estado1.trackX}→${estado2.trackX})` : "NÃO");
console.log("Transform T=0:", estado1.transform);
console.log("Transform T=3:", estado2.transform);

const movimentoOk = estaRodando && tempoAvancou;
console.log("\n" + (movimentoOk ? "✅ ANIMAÇÃO A FUNCIONAR" : "❌ ANIMAÇÃO PARADA"));

await browser.close();
process.exit(movimentoOk ? 0 : 1);
