import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";

const BOX_W = 180;
const GAP = 56;
const BLOCO_BASE = 2 * (BOX_W + GAP); // 2 logos × (180+56)

const browser = await chromium.launch({ headless: true, executablePath: EXE });

async function medir(viewportW) {
  const ctx = await browser.newContext({ viewport: { width: viewportW, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const pular = page.locator("text=Pular").first();
  if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) await pular.click();
  await page.waitForTimeout(1200);

  const r = await page.evaluate(({ blocoBase }) => {
    const cont = document.querySelector(".marquee-foco");
    const track = cont?.querySelector(".flex.w-max");
    if (!cont || !track) return null;
    return {
      containerClientWidth: Math.round(cont.clientWidth),
      trackScrollWidth: Math.round(track.scrollWidth),
      blocosRenderizados: track.children.length,
      meio: Math.round(track.scrollWidth / 2),
      meioModBloco: Math.round((track.scrollWidth / 2) % blocoBase),
    };
  }, { blocoBase: BLOCO_BASE });

  await page.close();
  await ctx.close();
  return r;
}

const d1920 = await medir(1920);
const d390 = await medir(390);

console.log("A 1920px de viewport:", JSON.stringify(d1920));
console.log("A 390px de viewport:", JSON.stringify(d390));

const rep = (d) => d.blocosRenderizados / 2; // blocos totais / 2 = repetições por metade
console.log(`\nRepetições por metade:  1920→${rep(d1920)}  390→${rep(d390)}`);
console.log(`Blocos totais:          1920→${d1920.blocosRenderizados}  390→${d390.blocosRenderizados}`);
console.log(`Costura (-50% ≡ nº inteiro de blocos): 1920→${d1920.meioModBloco === 0 ? "OK" : "FALHOU"}  390→${d390.meioModBloco === 0 ? "OK" : "FALHOU"}`);

await browser.close();
