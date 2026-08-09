import { chromium } from "playwright-core";

// Teste do marquee de patrocinadores — hydration + responsividade.
// Breakpoints exigidos por Lucas: 1920/1440/1280/1024/834/768/430/390/320
const BREAKPOINTS = [1920, 1440, 1280, 1024, 834, 768, 430, 390, 320];
const URL = "http://localhost:3000/alem-do-espelho-2026";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
});

const linhas = [];
let globalFalhou = false;

for (const vp of BREAKPOINTS) {
  const ctx = await browser.newContext({ viewport: { width: vp, height: 900 } });
  const page = await ctx.newPage();
  const consoleErros = [];
  const hydrationErros = [];

  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error") consoleErros.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErros.push("PAGEERROR: " + err.message));

  // Espera a página carregar e o useEffect do marquee disparar (montado=true).
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // Mapeia o texto de erros de hydration do React.
  const errosText = consoleErros.join(" ");
  if (/hydration|Hydration|did not match|mismatch/i.test(errosText)) {
    hydrationErros.push(errosText);
  }

  // Estado do marquee no DOM.
  const estado = await page.evaluate(() => {
    const marquee = document.querySelector(".marquee-foco");
    const track = marquee ? marquee.querySelector(".flex.w-max") : null;
    const azulejos = document.querySelectorAll(".azulejo-logo");
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return {
      temMarquee: !!marquee,
      temTrack: !!track,
      totalAzulejos: azulejos.length,
      azulejosVisiveis: Array.from(azulejos).filter((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
      alturaAzulejo: azulejos.length ? azulejos[0].getBoundingClientRect().height : 0,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      reduzido,
    };
  });

  // O primeiro azulejo não pode ser duplicado com aria-hidden para leitores.
  const primeiroAlt = await page.evaluate(() => {
    const img = document.querySelector(".azulejo-logo img");
    return img ? img.getAttribute("alt") : null;
  });

  const ok = !hydrationErros.length && estado.temMarquee && estado.totalAzulejos >= 4 && !estado.overflowX;
  if (!ok) globalFalhou = true;

  linhas.push(
    `[${ok ? "PASS" : "FAIL"}] ${vp}px  marquee=${estado.temMarquee ? "sim" : "NÃO"}  ` +
      `azulejos=${estado.totalAzulejos} (visíveis ${estado.azulejosVisiveis}, h=${estado.alturaAzulejo}px)  ` +
      `overflowX=${estado.overflowX ? "SIM!" : "não"} (scrollW=${estado.scrollWidth})  ` +
      `reduced=${estado.reduzido ? "sim" : "não"}  alt1="${primeiroAlt}"` +
      (hydrationErros.length ? `  HYDRATION: ${hydrationErros[0].slice(0, 120)}` : "")
  );
  if (consoleErros.length && !hydrationErros.length) {
    linhas.push(`    console: ${consoleErros.join(" | ").slice(0, 200)}`);
  }
  await ctx.close();
}

console.log(linhas.join("\n"));
console.log(globalFalhou ? "\n=== HOUVE FALHAS ===" : "\n=== TUDO OK ===");
await browser.close();
process.exit(globalFalhou ? 1 : 0);
