import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/alem-do-espelho-2026", { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector(".marquee-foco").scrollIntoView({ block: "center" }));
await page.waitForTimeout(1000);

const ler = () =>
  page.evaluate(() => {
    const t = document.querySelector(".marquee-foco .flex.w-max");
    const a = t.getAnimations()[0];
    return a ? a.playbackRate.toFixed(3) : "n/a";
  });

const base = await ler();
const box = await page.locator(".marquee-foco").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(900); // tempo suficiente para o travão assentar (< 0.05)
const durante = await ler();
await page.mouse.move(10, 10);
await page.waitForTimeout(1200); // convergência exponencial + snap em 1.0
const apos = await ler();

console.log("playbackRate base=" + base + "  duranteHover=" + durante + "  aposSair=" + apos);
const ok = +base >= 0.99 && +durante < 0.05 && +apos >= 0.99;
console.log(ok ? "VELVET BRAKE OK" : "PROBLEMA no travão de veludo");
await browser.close();
process.exit(ok ? 0 : 1);
