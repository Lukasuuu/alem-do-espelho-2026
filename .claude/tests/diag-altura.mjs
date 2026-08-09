import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => console.log("  [console]", m.type(), m.text().slice(0, 150)));
await page.goto("http://localhost:3000/alem-do-espelho-2026", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const d = await page.evaluate(() => {
  const azulejos = document.querySelectorAll(".azulejo-logo");
  const marquee = document.querySelector(".marquee-foco");
  const track = marquee?.querySelector(".flex.w-max");
  const span = azulejos[0];
  const img = span?.querySelector("img");
  return {
    innerWidth: window.innerWidth,
    spanInlineHeight: span ? span.getAttribute("style") : null,
    spanRectHeight: span ? span.getBoundingClientRect().height : null,
    imgInlineHeight: img ? img.getAttribute("style") : null,
    imgRectHeight: img ? img.getBoundingClientRect().height : null,
    gapTrack: track ? track.getAttribute("style") : null,
    gapCopias: marquee ? marquee.querySelectorAll(".flex")[1]?.getAttribute("style") : null,
    marqueeStyle: marquee ? marquee.getAttribute("style") : null,
    copiasDivs: marquee ? marquee.querySelectorAll(":scope > div")[1]?.children.length : null,
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
