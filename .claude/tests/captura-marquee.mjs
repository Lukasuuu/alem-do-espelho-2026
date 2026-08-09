import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });

for (const [vp, nome] of [[1440, "desktop"], [390, "mobile"]]) {
  const ctx = await browser.newContext({ viewport: { width: vp, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push("PAGEERROR: " + e.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Rolar até a secção de patrocinadores e pausar animações p/ captura nítida.
  await page.evaluate(() => {
    document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" });
    document.getAnimations().forEach((a) => a.pause());
  });
  await page.waitForTimeout(400);

  // Painel de resultados: nomes a mostrar junto da imagem.
  await page.evaluate((larguraVp) => {
    const panel = document.createElement("div");
    panel.id = "painel-resultado";
    panel.style.cssText =
      "position:fixed;bottom:12px;left:12px;z-index:9999;background:rgba(10,14,10,.92);color:#e8e6dd;" +
      "font:600 11px/1.5 ui-monospace,monospace;padding:8px 12px;border-radius:8px;border:1px solid #c9a86a;white-space:pre";
    panel.textContent = "secção Patrocinadores — viewport " + larguraVp + "px";
    document.body.appendChild(panel);
  }, vp);

  const secao = await page.evaluate(() => {
    const m = document.querySelector(".marquee-foco");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const az = document.querySelectorAll(".azulejo-logo");
    const copias = m.querySelector(".flex.w-max")?.children.length ?? 0;
    return { x: r.x, y: r.y, w: r.width, h: r.height, copias, azulejos: az.length, alturaAz: az[0]?.getBoundingClientRect().height ?? 0 };
  });

  const path = ".claude/tests/captura-" + nome + ".png";
  if (secao) {
    // Clipe = 60px acima e abaixo da faixa para incluir o rótulo e as bordas do fade.
    const clip = { x: Math.max(0, secao.x - 8), y: Math.max(0, secao.y - 46), width: Math.min(secao.w + 16, 1440), height: secao.h + 62 };
    await page.screenshot({ path, clip });
  } else {
    await page.screenshot({ path, fullPage: false });
  }
  console.log(nome + ": " + JSON.stringify(secao) + (erros.length ? "  CONSOLE_ERR=" + erros.join("|").slice(0, 150) : "  (sem erros)"));
  await ctx.close();
}

await browser.close();
