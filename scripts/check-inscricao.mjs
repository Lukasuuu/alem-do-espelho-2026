import { chromium } from "playwright-core";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.argv[2] ?? "https://alem-do-espelho-2026-two5i3q3s-lukasuuus-projects.vercel.app/alem-do-espelho-2026/lista";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const vp of [{ n: "desktop", w: 1280, h: 800 }, { n: "mobile", w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  console.log(`\n=== ${vp.n} ${vp.w}x${vp.h} | URL final: ${page.url()} ===`);
  const secao = page.locator("#inscricao");
  console.log("  #inscricao no DOM:", await secao.count() > 0);
  if (await secao.count() > 0) {
    const vis = await secao.evaluate(el => { const r = el.getBoundingClientRect(); return { visible: r.height > 0, top: Math.round(r.top), height: Math.round(r.height) }; });
    console.log("  #inscricao visível no corpo:", vis.visible, "| top:", vis.top, "height:", vis.height);
  }
  const inputs = await page.locator("#inscricao input").count();
  const selects = await page.locator("#inscricao select").count();
  const botoes = await page.locator("#inscricao button").count();
  console.log("  inputs:", inputs, "selects:", selects, "buttons:", botoes);
  const labels = await page.locator("#inscricao label").allTextContents();
  console.log("  labels:", labels.join(" | "));
  await secao.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/inscricao-${vp.n}.png`, fullPage: false });
  console.log("  screenshot: /tmp/inscricao-" + vp.n + ".png");
  console.log("  console errors:", erros.length);
  erros.slice(0,3).forEach(e => console.log("    -", e.slice(0,120)));
  await ctx.close();
}
await browser.close();
