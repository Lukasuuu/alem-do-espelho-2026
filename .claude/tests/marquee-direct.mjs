import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Scroll until marquee is visible
const marqueeLocator = page.locator(".marquee-foco");
await marqueeLocator.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

// Screenshot 1 — T=0
await marqueeLocator.screenshot({ path: ".claude/tests/marquee-elem-t0.png" });
console.log("Screenshot T=0 capturado");

// Estado inicial
const e1 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    currentTime: Math.round(anim?.currentTime ?? 0),
    transform: getComputedStyle(track).transform,
    trackX: Math.round(track.getBoundingClientRect().x),
    trackW: Math.round(track.getBoundingClientRect().width),
  };
});
console.log("T=0:", JSON.stringify(e1));

// Esperar 5 segundos
await page.waitForTimeout(5000);

// Screenshot 2 — T=5s
await marqueeLocator.screenshot({ path: ".claude/tests/marquee-elem-t5.png" });
console.log("Screenshot T=5 capturado");

const e2 = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    currentTime: Math.round(anim?.currentTime ?? 0),
    transform: getComputedStyle(track).transform,
    trackX: Math.round(track.getBoundingClientRect().x),
    trackW: Math.round(track.getBoundingClientRect().width),
  };
});
console.log("T=5:", JSON.stringify(e2));
console.log(`\nTempo avançou: ${e2.currentTime > e1.currentTime ? "SIM" : "NÃO"} (${e1.currentTime}→${e2.currentTime}ms)`);
console.log(`Posição mudou: ${e1.trackX !== e2.trackX ? "SIM" : "NÃO"} (${e1.trackX}→${e2.trackX})`);

await browser.close();
