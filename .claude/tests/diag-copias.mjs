import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.text().includes("warn")) console.log("  [console]", m.text().slice(0, 200));
});
await page.goto("http://localhost:3000/alem-do-espelho-2026", { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" }));
await page.waitForTimeout(1500);

const d = await page.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  const track = marquee?.querySelector(".flex.w-max");
  const azulejos = document.querySelectorAll(".azulejo-logo");
  const copiaDivs = track ? Array.from(track.children) : [];
  return {
    marqueeOffsetWidth: marquee ? marquee.offsetWidth : null,
    marqueeClientWidth: marquee ? marquee.clientWidth : null,
    trackScrollWidth: track ? track.scrollWidth : null,
    numCopias: copiaDivs.length,
    azulejosTotal: azulejos.length,
    primeirosAzulejos: Array.from(azulejos).map((a) => Math.round(a.getBoundingClientRect().width)),
    imgs: Array.from(document.querySelectorAll(".azulejo-logo img")).map((i) => ({
      src: (i.currentSrc || i.src).split("/").pop(),
      natural: i.naturalWidth + "x" + i.naturalHeight,
      attr: i.getAttribute("width") + "x" + i.getAttribute("height"),
      css: i.style.height,
      rect: Math.round(i.getBoundingClientRect().width) + "x" + Math.round(i.getBoundingClientRect().height),
    })).slice(0, 4),
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
