import { chromium } from "playwright-core";

// ── Configuração ──
const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const VEL_ALVO = 40; // px/s
const TOL_VEL = 3; // ±3 px/s

const ok = await fetch(URL).then((r) => r.ok).catch(() => false);
if (!ok) {
  console.error(`ERRO: servidor não responde em ${URL}`);
  process.exit(1);
}
console.log(`Porta OK — ${URL}\n`);

const browser = await chromium.launch({ headless: true, executablePath: EXE });

async function correrContexto(mode, label) {
  console.log(`\n──── CONTEXTO: prefers-reduced-motion = ${mode} ────`);
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: mode,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const pular = page.locator("text=Pular").first();
  if (await pular.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pular.click();
    console.log("  Modal fechado via 'Pular'");
  }
  await page.waitForTimeout(1000);

  // Scroll para o marquee ficar centrado e esperar Reveal + arranque do IO.
  await page.evaluate(() => {
    const m = document.querySelector(".marquee-foco");
    if (!m) return;
    const rect = m.getBoundingClientRect();
    window.scrollTo(0, rect.top + window.scrollY - 300);
  });
  await page.waitForTimeout(2200);

  // ── Estado visível (data-marquee-estado) + animação ──
  const diag = await page.evaluate(() => {
    const cont = document.querySelector(".marquee-foco");
    const track = cont?.querySelector(".flex.w-max");
    const anim = track?.getAnimations()[0];
    const logo = cont?.querySelector(".azulejo-logo");
    const cs = logo ? getComputedStyle(logo) : null;
    return {
      marqueeEstado: cont?.dataset.marqueeEstado ?? null,
      contExiste: !!cont,
      animCount: track?.getAnimations().length ?? 0,
      animPlayState: anim?.playState ?? null,
      animRate: anim?.playbackRate ?? null,
      scrollWidth: track?.scrollWidth ?? null,
      logoOpacity: cs?.opacity ?? null,
      logoFilter: cs?.filter ?? null,
    };
  });
  console.log("  marquee-estado:", diag.marqueeEstado);
  console.log("  contentor existe:", diag.contExiste);
  console.log("  animações no track:", diag.animCount, `(playState=${diag.animPlayState}, rate=${diag.animRate})`);
  console.log("  logo em repouso → opacity:", diag.logoOpacity, "| filter:", diag.logoFilter);

  if (diag.marqueeEstado !== "ativo") {
    console.log("  ✗ FALHOU: data-marquee-estado != 'ativo' (marquee parado no ramo errado)");
    await ctx.close();
    return { label, pass: false, estado: diag.marqueeEstado };
  }
  if (diag.animCount === 0) {
    console.log("  ✗ FALHOU: nenhuma animação WAAPI no track");
    await ctx.close();
    return { label, pass: false, estado: diag.marqueeEstado };
  }

  // ── Amostragem ~30fps (3s) — velocidade real ──
  const PERIODO = diag.scrollWidth / 2;
  const dados = await page.evaluate(
    async ({ dur, periodo }) => {
      const track = document.querySelector(".marquee-foco .flex.w-max");
      const pontos = [];
      const inicio = performance.now();
      await new Promise((resolve) => {
        const id = setInterval(() => {
          const t = performance.now() - inicio;
          pontos.push({ t: Math.round(t), x: Math.round(track.getBoundingClientRect().x * 100) / 100 });
          if (t >= dur) {
            clearInterval(id);
            resolve();
          }
        }, 33);
      });
      return { pontos, periodo };
    },
    { dur: 3000, periodo: PERIODO }
  );

  const p = dados.pontos;
  const n = p.length;
  const duracao = p[n - 1].t - p[0].t;
  const intervalos = [];
  for (let i = 1; i < n; i++) intervalos.push(p[i].t - p[i - 1].t);
  const drops = intervalos.filter((d) => d > 120).length;
  let zeroFrames = 0;
  for (let i = 1; i < n; i++) if (p[i].x === p[i - 1].x) zeroFrames++;

  let wraps = 0;
  for (let i = 1; i < n; i++) {
    const d = p[i].x - p[i - 1].x;
    if (d >= 300 && d <= PERIODO + 200) wraps++;
  }
  const vel = ((p[0].x - p[n - 1].x + wraps * PERIODO) / duracao) * 1000;

  console.log(`  amostras: ${n} em ${duracao}ms | drops>120ms: ${drops} | zero-frames: ${zeroFrames} | wraps: ${wraps}`);
  console.log(`  velocidade: ${Math.round(vel * 10) / 10} px/s (alvo ${VEL_ALVO}±${TOL_VEL})`);

  const velOk = Math.abs(vel - VEL_ALVO) <= TOL_VEL;
  const cadOk = drops === 0 && zeroFrames === 0;
  const pass = velOk && cadOk;
  console.log(`  ${pass ? "✓ PASSOU" : "✗ FALHOU"}`);

  await ctx.close();
  return { label, pass, estado: diag.marqueeEstado };
}

const a = await correrContexto("reduce", "reduce");
const b = await correrContexto("no-preference", "no-preference");

console.log("\n=== RESUMO FINAL ===");
console.log(`reduce:        ${a.pass ? "✓" : "✗"} (estado=${a.estado})`);
console.log(`no-preference: ${b.pass ? "✓" : "✗"} (estado=${b.estado})`);
const tudo = a.pass && b.pass;
console.log(tudo ? "\n✅ O marquee corre em TODOS os contextos" : "\n❌ O marquee falhou em pelo menos um contexto");

await browser.close();
process.exit(tudo ? 0 : 1);
