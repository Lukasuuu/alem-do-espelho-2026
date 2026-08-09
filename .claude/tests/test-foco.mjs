import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3000/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });

const resultados = [];
const reduzido = browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });

// ── Teste A: animação WAAPI corre + hover isola foco ──
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pageA = await ctxA.newPage();
await pageA.goto(URL, { waitUntil: "networkidle" });
await pageA.evaluate(() => document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" }));
await pageA.waitForTimeout(1200);

const anim = await pageA.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anims = track ? track.getAnimations().map((a) => a.playState) : [];
  const css = getComputedStyle(document.querySelector(".marquee-foco .azulejo-logo"));
  return {
    anims,
    transicao: css.transition.includes("opacity"),
    mask: getComputedStyle(document.querySelector(".marquee-foco")).webkitMaskImage || getComputedStyle(document.querySelector(".marquee-foco")).maskImage,
  };
});
resultados.push(["A", "animação WAAPI rodando (running)", anim.anims.includes("running"), JSON.stringify(anim.anims)]);
resultados.push(["A", "transition de opacity no azulejo (focus isolation)", anim.transicao, anim.transicao ? "ok" : "FALTA"]);
resultados.push(["A", "máscara de fade nas bordas", /linear-gradient/.test(anim.mask || ""), (anim.mask || "").slice(0, 60)]);

// Hover real no 1º azulejo → vizinhos apagados, hover revelado 100%.
const alvoBox = await pageA.locator(".marquee-foco .azulejo-logo").first().boundingBox();
await pageA.mouse.move(alvoBox.x + alvoBox.width / 2, alvoBox.y + alvoBox.height / 2);
await pageA.waitForTimeout(400);
const hover = await pageA.evaluate(() => {
  const azulejos = document.querySelectorAll(".marquee-foco .azulejo-logo");
  const alvoOp = getComputedStyle(azulejos[0]).opacity;
  const vizinhoOp = azulejos[1] ? getComputedStyle(azulejos[1]).opacity : null;
  return { alvoOp, vizinhoOp };
});
resultados.push(["A", "hover: alvo opacity≈1", Math.abs(+hover.alvoOp - 1) < 0.1, "alvo=" + hover.alvoOp]);
resultados.push(["A", "hover: vizinho opacity<1 (isolado)", hover.vizinhoOp !== null && +hover.vizinhoOp < 0.5, "vizinho=" + hover.vizinhoOp]);

await ctxA.close();

// ── Teste B: prefers-reduced-motion → fila estática, sem marquee ──
const ctxB = await (await reduzido).newContext && ctxB;
const ctxR = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const pageR = await ctxR.newPage();
await pageR.goto(URL, { waitUntil: "networkidle" });
await pageR.evaluate(() => document.querySelector(".marquee-foco")?.scrollIntoView({ block: "center" }));
await pageR.waitForTimeout(1000);
const reduz = await pageR.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  const estatica = document.querySelector(".flex.flex-wrap.items-center.justify-center.gap-6");
  return {
    semMarquee: !marquee,
    filaEstatica: !!estatica,
    media: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
});
resultados.push(["B", "reduced-motion: sem marquee", reduz.semMarquee, reduz.semMarquee ? "ok" : "marquee presente"]);
resultados.push(["B", "reduced-motion: fila estática presente", reduz.filaEstatica, reduz.filaEstatica ? "ok" : "ausente"]);
resultados.push(["B", "matchMedia reflecte reduce", reduz.media, String(reduz.media)]);
await ctxR.close();

await browser.close();

let falha = 0;
for (const [grupo, nome, ok, det] of resultados) {
  if (!ok) falha++;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${grupo} — ${nome}  ${ok ? "" : "→ " + det}`);
}
console.log(falha ? `\n=== ${falha} FALHA(S) ===` : "\n=== TUDO OK ===");
process.exit(falha ? 1 : 0);
