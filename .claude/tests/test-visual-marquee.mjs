import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });

// Desktop 1440px
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Rolar até a secção de patrocinadores
await page.evaluate(() => {
  document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(500);

// Obter posição REAL do marquee
const marqueeBox = await page.locator(".marquee-foco").boundingBox();
console.log("Marquee bounding box:", JSON.stringify(marqueeBox));

// Screenshot 1 — capturar TUDO o que está visível (secção patrocinadores)
await page.screenshot({
  path: ".claude/tests/marquee-visual-t0.png",
  clip: {
    x: Math.max(0, marqueeBox.x - 50),
    y: Math.max(0, marqueeBox.y - 80),
    width: Math.min(marqueeBox.width + 100, 1440),
    height: marqueeBox.height + 160,
  },
});

// Esperar 4 segundos
await page.waitForTimeout(4000);

// Screenshot 2
await page.screenshot({
  path: ".claude/tests/marquee-visual-t4.png",
  clip: {
    x: Math.max(0, marqueeBox.x - 50),
    y: Math.max(0, marqueeBox.y - 80),
    width: Math.min(marqueeBox.width + 100, 1440),
    height: marqueeBox.height + 160,
  },
});

// Verificar estado da animação
const estado = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    playState: anim?.playState,
    playbackRate: anim?.playbackRate,
    currentTime: anim?.currentTime,
    transform: getComputedStyle(track).transform,
  };
});
console.log("Estado animação:", JSON.stringify(estado));
console.log("Screenshots guardadas: marquee-visual-t0.png e marquee-visual-t4.png");

await browser.close();
