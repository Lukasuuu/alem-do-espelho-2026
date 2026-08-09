import { chromium } from "playwright-core";

// ── Configuração ──
const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const VEL_ALVO = 40;          // px/s (diagnóstico)
const TOL_VEL = 3;            // ±3 px/s
// Período do ciclo = scrollWidth/2 (uma metade do track). Não é constante:
// depende de quantos blocos foram calculados (2×repeticoes). É derivado do
// track medido, abaixo.
let PERIODO = 0;

// Verificar porta primeiro.
const ok = await fetch(URL).then((r) => r.ok).catch(() => false);
if (!ok) {
  console.error(`ERRO: servidor não responde em ${URL}`);
  process.exit(1);
}
console.log(`Porta OK — ${URL}\n`);

const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Fechar modal.
const pular = page.locator("text=Pular").first();
if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
  await pular.click();
  console.log("Modal fechado via 'Pular'");
} else {
  console.log("Nenhum modal encontrado");
}
await page.waitForTimeout(1000);

// Scroll para o marquee ficar centrado e esperar Reveal + arranque do IO.
await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  if (!m) return;
  const rect = m.getBoundingClientRect();
  window.scrollTo(0, rect.top + window.scrollY - 300);
});
await page.waitForTimeout(2200); // Reveal 0.7s + IO resume + margem

// ── Diagnóstico inicial do track ──
const diag = await page.evaluate(() => {
  const track = document.querySelector(".marquee-foco .flex.w-max");
  const anim = track?.getAnimations()[0];
  return {
    scrollWidth: track?.scrollWidth ?? null,
    animPlayState: anim?.playState ?? null,
    animDuration: anim?.effect?.getTiming().duration ?? null,
    animRate: anim?.playbackRate ?? null,
    animCount: track?.getAnimations().length ?? 0,
  };
});
console.log("DIAGNÓSTICO:", JSON.stringify(diag, null, 2));
PERIODO = diag.scrollWidth / 2;
console.log(`PERÍODO derivado: ${PERIODO}px (metade do track — wrap esperado no costura)`);
if (diag.animCount === 0) {
  console.error("ERRO: nenhuma animação no track — marquee não arrancou.");
  await browser.close();
  process.exit(1);
}

// ── Amostragem a ~30fps ──
async function amostrar(duracaoMs, label) {
  const dados = await page.evaluate(
    async ({ dur, lbl }) => {
      const track = document.querySelector(".marquee-foco .flex.w-max");
      const pontos = [];
      const inicio = performance.now();
      await new Promise((resolve) => {
        const id = setInterval(() => {
          const t = performance.now() - inicio;
          const x = track.getBoundingClientRect().x;
          pontos.push({ t: Math.round(t), x: Math.round(x * 100) / 100 });
          if (t >= dur) {
            clearInterval(id);
            resolve();
          }
        }, 33); // ≈30fps
      });
      return { lbl, pontos };
    },
    { dur: duracaoMs, lbl: label }
  );
  return dados;
}

function analisar(dados, expectarVelocidade = true) {
  const p = dados.pontos;
  const n = p.length;
  const duracao = p[n - 1].t - p[0].t;

  // Cadência: intervalos entre amostras.
  const intervalos = [];
  for (let i = 1; i < n; i++) intervalos.push(p[i].t - p[i - 1].t);
  const mediaInt = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
  const drops = intervalos.filter((d) => d > 120).length;
  const zeros = intervalos.filter((d) => d <= 0).length;

  // Zero-frames: amostras consecutivas com o mesmo x (movimento parado).
  let zeroFrames = 0;
  for (let i = 1; i < n; i++) {
    if (p[i].x === p[i - 1].x) zeroFrames++;
  }

  // Costura: deltas entre amostras. Negativo ~ -1.33 normal; positivo ~ +periodo = wrap.
  const anomalias = [];
  let wraps = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.round((p[i].x - p[i - 1].x) * 10) / 10;
    if (d >= 300 && d <= PERIODO + 200) {
      wraps++;
    } else if (Math.abs(d) > 8) {
      anomalias.push({ i, d, de: p[i - 1].x, para: p[i].x });
    }
  }

  // Velocidade média — corrige os wraps: cada wrap soma +PERIODO ao x medido
  // em relação ao deslocamento contínuo (o marquee regressa ao início do ciclo).
  const deslocBruto = p[0].x - p[n - 1].x;
  const deslocReal = deslocBruto + wraps * PERIODO;
  const vel = (deslocReal / duracao) * 1000;

  return {
    label: dados.lbl,
    n,
    duracaoMs: duracao,
    intervaloMedioMs: Math.round(mediaInt * 10) / 10,
    drops: drops > 0 ? intervalos.filter((d) => d > 120) : [],
    intervalosZero: zeros,
    zeroFrames,
    velocidadePxS: Math.round(vel * 10) / 10,
    wraps,
    anomalias: anomalias.slice(0, 5),
  };
}

function resumo(r, { exigirWrap }) {
  const cadOk = r.drops.length === 0 && r.intervalosZero === 0;
  const zeroOk = r.zeroFrames === 0;
  const velOk = Math.abs(r.velocidadePxS - VEL_ALVO) <= TOL_VEL;
  const custuraOk = (exigirWrap ? r.wraps >= 1 : true) && r.anomalias.length === 0;
  console.log(`  ├─ amostras: ${r.n} em ${r.duracaoMs}ms`);
  console.log(`  ├─ cadência média: ${r.intervaloMedioMs}ms/amostra  (drops>120ms: ${r.drops.length}, intervalos<=0: ${r.intervalosZero})`);
  console.log(`  ├─ zero-frames (x idêntico consecutivo): ${r.zeroFrames}`);
  console.log(`  ├─ velocidade: ${r.velocidadePxS} px/s  (alvo ${VEL_ALVO}±${TOL_VEL})`);
  console.log(`  ├─ costura: ${r.wraps} wrap(s) de +${PERIODO}px, anomalias: ${r.anomalias.length}`);
  if (r.anomalias.length) console.log(`  │   anomalias: ${JSON.stringify(r.anomalias)}`);
  console.log(`  └─ ${(cadOk && zeroOk && velOk && custuraOk) ? "PASSOU" : "FALHOU"}`);
  return { cadOk, zeroOk, velOk, custuraOk };
}

console.log("\n── FASE A: 5s @30fps, sem ponteiro sobre a secção ──");
const a = analisar(await amostrar(5000, "A"));
const ra = resumo(a, { exigirWrap: false });

console.log("\n── FASE B: ponteiro FORA da secção, 5s @30fps ──");
await page.mouse.move(10, 10); // topo do viewport, longe do marquee centrado
await page.waitForTimeout(1000); // veludo retoma (~400ms) + margem
const b = analisar(await amostrar(5000, "B"));
const rb = resumo(b, { exigirWrap: false });

console.log("\n── FASE C: costura do loop — 1 volta completa + margem @30fps ──");
// Duração da animação (uma metade) + 2s de margem ⇒ garante ≥1 wrap da costura.
const c = analisar(await amostrar(diag.animDuration + 2000, "C"));
const rc = resumo(c, { exigirWrap: true });

const tudo = ra.cadOk && ra.zeroOk && ra.velOk && rb.cadOk && rb.zeroOk && rb.velOk && rc.cadOk && rc.zeroOk && rc.custuraOk;

console.log("\n=== RESUMO FINAL ===");
console.log(`Fase A (padrão):      ${ra.cadOk && ra.zeroOk && ra.velOk ? "OK" : "FALHOU"}`);
console.log(`Fase B (fora secção): ${rb.cadOk && rb.zeroOk && rb.velOk ? "OK" : "FALHOU"}`);
console.log(`Fase C (costura 2v):  ${rc.cadOk && rc.zeroOk && rc.custuraOk && rc.velOk ? "OK" : "FALHOU"}`);
console.log(tudo ? "\n✅ VALIDAÇÃO COMPLETA — marquee aprovado" : "\n❌ VALIDAÇÃO FALHOU");

await browser.close();
process.exit(tudo ? 0 : 1);
