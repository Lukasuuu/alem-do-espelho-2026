import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";

const ok = await fetch(URL).then((r) => r.ok).catch(() => false);
if (!ok) {
  console.error(`ERRO: servidor não responde em ${URL}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Fechar modal
const pular = page.locator("text=Pular").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
  await pular.click();
  console.log("Modal fechado via 'Pular'");
} else {
  console.log("Nenhum modal encontrado");
}
await page.waitForTimeout(1000);

// Scroll para a secção de patrocinadores
await page.evaluate(() => {
  const v = document.querySelector(".marquee-foco");
  const est = document.querySelector("section");
  const alvo = v ?? est;
  if (!alvo) return;
  const r = alvo.getBoundingClientRect();
  window.scrollTo(0, r.top + window.scrollY - 300);
});
await page.waitForTimeout(2500);

// ── 1) QUE RAMO ESTÁ NO DOM REAL? ──
const ramo = await page.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  // Fila estática: contentor flex-wrap centrado com azulejos flexíveis
  const estatica = [...document.querySelectorAll(".flex.flex-wrap.items-center.justify-center.gap-6")];
  const logos = [...document.querySelectorAll(".azulejo-logo")];
  const logosMarquee = marquee ? [...marquee.querySelectorAll(".azulejo-logo")] : [];

  return {
    existeMarquee: !!marquee,
    existeFilaEstatica: estatica.length > 0,
    totalLogos: logos.length,
    logosDentroMarquee: logosMarquee.length,
    animacoesTrack: marquee
      ? [...(marquee.querySelectorAll(".flex.w-max")?.[0]?.getAnimations?.() ?? [])].length
      : 0,
    temTrackWmax: !!marquee?.querySelector(".flex.w-max"),
  };
});
console.log("RAMO ATIVO NO DOM REAL:", JSON.stringify(ramo, null, 2));

// ── 2) LARGURAS DAS CAIXAS ──
const caixas = await page.evaluate(() => {
  return [...document.querySelectorAll(".azulejo-logo")].map((el) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector("img");
    const ir = img?.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      opacity: getComputedStyle(el).opacity,
      filter: getComputedStyle(el).filter,
      dentroMarquee: !!el.closest(".marquee-foco"),
      imgW: ir ? Math.round(ir.width) : null,
      imgH: ir ? Math.round(ir.height) : null,
    };
  });
});
console.log("\nCAIXAS (largura/altura/opacity/em-marquee):");
caixas.forEach((c, i) =>
  console.log(`  ${i}: ${c.w}×${c.h}px opacity=${c.opacity} dentroMarquee=${c.dentroMarquee} img=${c.imgW}×${c.imgH} filter=${c.filter}`)
);

// ── 3) MOVIMENTO — 5s a ~30fps com ponteiro FORA ──
await page.mouse.move(10, 10);
await page.waitForTimeout(1000);

const mov = await page.evaluate(async () => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  if (!track) return { semTrack: true };
  const pontos = [];
  const inicio = performance.now();
  await new Promise((resolve) => {
    const id = setInterval(() => {
      pontos.push({
        t: Math.round(performance.now() - inicio),
        x: Math.round(track.getBoundingClientRect().x * 100) / 100,
      });
      if (performance.now() - inicio >= 5000) {
        clearInterval(id);
        resolve();
      }
    }, 33);
  });
  // Analisar
  let zeroFrames = 0;
  for (let i = 1; i < pontos.length; i++) if (pontos[i].x === pontos[i - 1].x) zeroFrames++;
  const duracao = pontos[pontos.length - 1].t - pontos[0].t;
  const desloc = pontos[0].x - pontos[pontos.length - 1].x;
  const vel = (desloc / duracao) * 1000;
  const anim = track.getAnimations()[0];
  return {
    amostras: pontos.length,
    zeroFrames,
    velocidadePxS: Math.round(vel * 10) / 10,
    deslocamentoPx: Math.round(desloc * 10) / 10,
    animPlayState: anim?.playState ?? null,
    animCount: track.getAnimations().length,
  };
});
console.log("\nMOVIMENTO (5s @30fps, ponteiro fora):", JSON.stringify(mov, null, 2));

await page.screenshot({ path: ".claude/tests/probe-ramo-real.png" });
console.log("\nScreenshot: .claude/tests/probe-ramo-real.png");

await browser.close();
