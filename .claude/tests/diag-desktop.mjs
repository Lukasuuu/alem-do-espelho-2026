import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => erros.push("PAGEERROR: " + e.message.slice(0, 200)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Rolar até patrocinadores
await page.evaluate(() => {
  document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(800);

const diagnostico = await page.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  const track = marquee?.querySelector(".flex.w-max");

  // Estado do marquee
  const marqueePresente = !!marquee;
  const trackPresente = !!track;

  // Animações WAAPI
  const animacoes = track ? track.getAnimations().map(a => ({
    playState: a.playState,
    playbackRate: a.playbackRate,
    currentTime: a.currentTime,
    iteration: a.getCurrentIteration?.() ?? "n/a",
  })) : [];

  // Dimensões
  const marqueeRect = marquee?.getBoundingClientRect();
  const trackRect = track?.getBoundingClientRect();

  // Azulejos
  const azulejos = document.querySelectorAll(".marquee-foco .azulejo-logo");
  const azulejoRects = Array.from(azulejos).slice(0, 6).map(a => ({
    w: Math.round(a.getBoundingClientRect().width),
    h: Math.round(a.getBoundingClientRect().height),
    x: Math.round(a.getBoundingClientRect().x),
  }));

  // Cópias
  const copiaDivs = track?.querySelectorAll(":scope > div") ?? [];

  // Estado React
  const containerStyle = marquee ? getComputedStyle(marquee) : null;

  return {
    marqueePresente,
    trackPresente,
    animacoes,
    marqueeRect: marqueeRect ? { x: Math.round(marqueeRect.x), y: Math.round(marqueeRect.y), w: Math.round(marqueeRect.width), h: Math.round(marqueeRect.height) } : null,
    trackRect: trackRect ? { w: Math.round(trackRect.width), h: Math.round(trackRect.height) } : null,
    numAzulejos: azulejos.length,
    numCopias: copiaDivs.length,
    azulejoRects,
    overflow: containerStyle?.overflow,
    maskImage: containerStyle?.webkitMaskImage || containerStyle?.maskImage || "none",
    paddingBlock: containerStyle?.paddingBlock,
  };
});

console.log("=== DIAGNÓSTICO DESKTOP (1440px) ===");
console.log(JSON.stringify(diagnostico, null, 2));

if (erros.length) {
  console.log("\n=== ERROS CONSOLE ===");
  erros.forEach(e => console.log("  -", e));
}

// Verificar se animação está rodando
const animRodando = diagnostico.animacoes.some(a => a.playState === "running");
const marqueeOk = diagnostico.marqueePresente && diagnostico.trackPresente && diagnostico.numCopias > 1;
const azulejosOk = diagnostico.numAzulejos >= 2;
const heightOk = diagnostico.azulejoRects[0]?.h >= 60;

console.log("\n=== VERDICTO ===");
console.log("Marquee DOM presente:", diagnostico.marqueePresente ? "SIM" : "NÃO");
console.log("Track presente:", diagnostico.trackPresente ? "SIM" : "NÃO");
console.log("Cópias:", diagnostico.numCopias);
console.log("Azulejos total:", diagnostico.numAzulejos);
console.log("Altura azulejo:", diagnostico.azulejoRects[0]?.h + "px");
console.log("Animação WAAPI:", animRodando ? "RUNNING ✓" : "PARADA/INEXISTENTE ✗");
console.log("Mask fade:", diagnostico.maskImage !== "none" ? "SIM ✓" : "NÃO");
console.log("Erros console:", erros.length);

const tudoOk = marqueeOk && azulejosOk && animRodando && heightOk;
console.log("\n" + (tudoOk ? "✅ TUDO OK" : "❌ PROBLEMA DETECTADO"));

await browser.close();
process.exit(tudoOk ? 0 : 1);
