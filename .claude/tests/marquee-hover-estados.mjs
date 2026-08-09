import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Fechar modal (botão "Pular")
const pular = page.locator("text=Pular").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
  await pular.click();
  console.log("Modal fechado via 'Pular'");
} else {
  console.log("Nenhum modal encontrado");
}
await page.waitForTimeout(1000);

// Scroll para o marquee ficar no centro da viewport
await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  if (!m) return;
  const rect = m.getBoundingClientRect();
  window.scrollTo(0, rect.top + window.scrollY - 300);
});
await page.waitForTimeout(2000); // Reveal animation (0.7s + margem)

async function estadoLogo(selector = ".marquee-foco .azulejo-logo") {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      opacity: s.opacity,
      filter: s.filter,
      transform: s.transform,
    };
  }, selector);
}

async function snap(nome) {
  await page.screenshot({ path: `.claude/tests/marquee-estado-${nome}.png` });
}

// ── ESTADO 1: padrão (sem hover) ──
const e1 = await estadoLogo();
console.log("ESTADO PADRÃO:", JSON.stringify(e1));
await snap("padrao");

// Movimento confirmado antes de hover (amostra de 3s)
const m1 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  return {
    time: Math.round(track?.getAnimations()[0]?.currentTime ?? 0),
    x: Math.round(track.getBoundingClientRect().x),
  };
});
await page.waitForTimeout(3000);
const m2 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  return {
    time: Math.round(track?.getAnimations()[0]?.currentTime ?? 0),
    x: Math.round(track.getBoundingClientRect().x),
  };
});
console.log(`MOVIMENTO: tempo ${m1.time}→${m2.time}ms, x ${m1.x}→${m2.x} (avançou: ${m2.x < m1.x})`);

// ── ESTADO 2: hover no CONTENTOR (faixa de padding top, fora dos logos) ──
const contRect = await page.evaluate(() => {
  const r = document.querySelector(".marquee-foco").getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width };
});
await page.mouse.move(contRect.left + contRect.width / 2, contRect.top + 4); // padding top (8px)
await page.waitForTimeout(900); // travão de veludo + transição CSS 0.3s
const e2 = await estadoLogo();
console.log("HOVER CONTENTOR:", JSON.stringify(e2));
await snap("contentor-hover");

// ── ESTADO 3: hover num LOGO específico (foco isolado) ──
// Escolher o logo cujo centro está mais perto do centro do viewport
const alvo = await page.evaluate(() => {
  const logos = [...document.querySelectorAll(".marquee-foco .azulejo-logo")];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let melhor = null;
  let melhorDist = Infinity;
  for (const el of logos) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
    if (d < melhorDist) {
      melhorDist = d;
      melhor = { el, x: r.x + r.width / 2, y: r.y + r.height / 2, alt: el.querySelector("img")?.alt };
    }
  }
  return melhor;
});
await page.mouse.move(alvo.x, alvo.y);
await page.waitForTimeout(600); // transição 0.3s + margem
const e3 = await page.evaluate(() => {
  const logos = [...document.querySelectorAll(".marquee-foco .azulejo-logo")];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let focado = null;
  let best = Infinity;
  for (const el of logos) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
    if (d < best) { best = d; focado = el; }
  }
  const s = getComputedStyle(focado);
  return {
    opacity: s.opacity,
    filter: s.filter,
    transform: s.transform,
    alt: focado.querySelector("img")?.alt,
  };
});
console.log("HOVER LOGO:", JSON.stringify(e3));
console.log("Logo em foco:", alvo.alt);
await snap("logo-hover");

// Verificação cruzada: outros logos continuam dim quando 1 está focado
const outros = await page.evaluate(() => {
  const logos = [...document.querySelectorAll(".marquee-foco .azulejo-logo")];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let focado = null;
  let best = Infinity;
  for (const el of logos) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
    if (d < best) { best = d; focado = el; }
  }
  return {
    total: logos.length,
    focadoOpacity: focado ? getComputedStyle(focado).opacity : "n/a",
    outrosOpacity: [...new Set(
      logos.filter((l) => l !== focado).slice(0, 4).map((l) => getComputedStyle(l).opacity)
    )],
  };
});
console.log("CROSS-CHECK:", JSON.stringify(outros));

// SEM grayscale em nenhum estado — a presença de "grayscale" reprova.
function temGrayscale(f) {
  return /grayscale/.test(f ?? "");
}
const passaPadrao = e1?.opacity === "0.55" && e1.filter.includes("blur(1px)") && !temGrayscale(e1.filter);
const passaContentor = e2?.opacity === "0.3" && e2.filter.includes("blur(2px)") && !temGrayscale(e2.filter);
const passaLogo = e3?.opacity === "1" && e3.filter.includes("blur(0px)") && !temGrayscale(e3.filter) && e3.transform.includes("1.06");

console.log("\n=== RESUMO ===");
console.log(`Padrão (0.55/blur1/sem gs):  ${passaPadrao ? "OK" : "FALHOU"}  ${JSON.stringify(e1)}`);
console.log(`Hover contentor (0.3/blur2/sem gs): ${passaContentor ? "OK" : "FALHOU"}  ${JSON.stringify(e2)}`);
console.log(`Hover logo (1/blur0/sem gs/scale1.06):  ${passaLogo ? "OK" : "FALHOU"}  ${JSON.stringify(e3)}`);
console.log(`Movimento infinito: ${m2.x < m1.x ? "OK" : "FALHOU"}`);

await browser.close();
