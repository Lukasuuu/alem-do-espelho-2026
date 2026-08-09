import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Screenshot 1 — screenshot direto no elemento marquee
const marquee = page.locator(".marquee-foco");
await marquee.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await marquee.screenshot({ path: ".claude/tests/marquee-elem-t0.png" });

// Estado T=0
const e1 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    currentTime: anim?.currentTime,
    transform: getComputedStyle(track).transform,
    trackRect: track?.getBoundingClientRect(),
  };
});
console.log("T=0:", JSON.stringify({ currentTime: e1.currentTime, transform: e1.transform, trackX: Math.round(e1.trackRect?.x ?? 0), trackW: Math.round(e1.trackRect?.width ?? 0) }));

await page.waitForTimeout(5000);

// Screenshot 2
await marquee.screenshot({ path: ".claude/tests/marquee-elem-t5.png" });

// Estado T=5
const e2 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    currentTime: anim?.currentTime,
    transform: getComputedStyle(track).transform,
    trackRect: track?.getBoundingClientRect(),
  };
});
console.log("T=5:", JSON.stringify({ currentTime: e2.currentTime, transform: e2.transform, trackX: Math.round(e2.trackRect?.x ?? 0), trackW: Math.round(e2.trackRect?.width ?? 0) }));

const tempoAvancou = (e2.currentTime ?? 0) > (e1.currentTime ?? 0);
const posicaoMudou = Math.round(e1.trackRect?.x ?? 0) !== Math.round(e2.trackRect?.x ?? 0);
console.log("\nTempo avançou:", tempoAvancou ? "SIM" : "NÃO");
console.log("Posição mudou:", posicaoMudou ? "SIM" : "NÃO");

await browser.close();
