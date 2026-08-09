import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Rolar até patrocinadores manualmente (scrollIntoView não funciona — provável wrapper com overflow)
await page.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  if (marquee) {
    const r = marquee.getBoundingClientRect();
    // rolar para que o marquee fique a ~300px do topo da viewport
    window.scrollTo(0, r.top + window.scrollY - 300);
  }
});
await page.waitForTimeout(800);
console.log("scrollY após scroll:", await page.evaluate(() => window.scrollY));

// Obter posição REAL em coordenadas de PÁGINA (viewport + scroll)
const posicao = await page.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  if (!marquee) return null;
  const r = marquee.getBoundingClientRect();
  return {
    pageX: r.x + window.scrollX,
    pageY: r.y + window.scrollY,
    vpX: r.x,
    vpY: r.y,
    w: r.width,
    h: r.height,
    scrollY: window.scrollY,
  };
});
console.log("Posição marquee (página):", JSON.stringify(posicao, null, 2));

// Screenshot 1 — clip usa coordenadas de VIEWPORT (documentação Playwright)
const clip = {
  x: Math.max(0, posicao.vpX - 30),
  y: Math.max(0, posicao.vpY - 60),
  width: Math.min(posicao.w + 60, 1440),
  height: posicao.h + 120,
};
console.log("Clip (viewport):", JSON.stringify(clip));

await page.screenshot({ path: ".claude/tests/marquee-pagina-t0.png", clip });

// Esperar 4 segundos
await page.waitForTimeout(4000);

// Screenshot 2
await page.screenshot({ path: ".claude/tests/marquee-pagina-t4.png", clip });

// Estado da animação
const estado = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    playState: anim?.playState,
    currentTime: Math.round(anim?.currentTime ?? 0),
    transform: getComputedStyle(track).transform,
  };
});
console.log("Estado:", JSON.stringify(estado));

await browser.close();
