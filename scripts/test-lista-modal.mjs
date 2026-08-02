/**
 * Valida que a /lista abre WaitlistModal ao clicar nos CTAs (não scroll inline).
 * Chrome do sistema, sem download de browser.
 *
 * Uso: node scripts/test-lista-modal.mjs [URL]
 */
import { chromium } from "playwright-core";

const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

const URL =
  process.argv[2] ??
  "https://alem-do-espelho-2026-89i2n5l2v-lukasuuus-projects.vercel.app/alem-do-espelho-2026/lista";

let totalFalhas = 0;
function falha(msg) {
  totalFalhas++;
  console.log(`  ✗ ${msg}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// Desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.setExtraHTTPHeaders({ "x-cutover-test": "before" });
  const page = await ctx.newPage();
  const erros = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(String(e)));

  console.log("=== desktop 1280x800 ===");
  await page.goto(URL, { waitUntil: "networkidle" });

  // Verificar que é a versão LISTA
  const hasInline = await page.locator("#inscricao").count();
  console.log("  #inscricao inline presente:", hasInline > 0 ? "sim" : "NÃO");

  // Procurar CTA de inscrição (botão que diz algo como "Entrar na lista" ou similar)
  const ctaButton = page
    .locator("button:visible, a:visible")
    .filter({ hasText: /inscrição|inscrever|garantir|entrar na lista|Quero a minha vaga/i })
    .filter({ hasNotText: /saltar|skip/i })
    .first();

  const ctaCount = await ctaButton.count();
  console.log("  CTA encontrado:", ctaCount > 0 ? "sim" : "NÃO");

  if (ctaCount > 0) {
    const ctaText = await ctaButton.textContent();
    console.log("  CTA texto:", ctaText?.trim());

    // Clicar no CTA
    await ctaButton.click();

    // Esperar que a modal apareça
    try {
      await page.waitForSelector(".modal-overlay", { state: "visible", timeout: 5000 });
      console.log("  ✓ Modal ABRIU ao clicar no CTA");

      // Verificar que tem a classe anti-regressão
      const hasTopClass = await page.locator(".modal-overlay").first().evaluate(
        (el) => el.classList.contains("modal-overlay-top")
      );
      console.log("  ✓ Classe modal-overlay-top:", hasTopClass ? "presente" : "FALTA");

      // Verificar alinhamento
      const align = await page.locator(".modal-overlay").first().evaluate(
        (el) => getComputedStyle(el).alignItems
      );
      console.log("  ✓ alignItems:", align);

      // Fechar com ESC
      await page.keyboard.press("Escape");
      await page.waitForSelector(".modal-overlay", { state: "detached", timeout: 5000 });
      console.log("  ✓ Modal FECHOU com ESC");
    } catch {
      falha("Modal NÃO abriu ao clicar no CTA — o scroll inline continua a funcionar em vez da modal");
    }
  } else {
    falha("Nenhum CTA de inscrição encontrado na página");
  }

  console.log("  console errors:", erros.length);
  erros.slice(0, 5).forEach((e) => console.log("    -", e.slice(0, 160)));
  await ctx.close();
}

// Mobile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.setExtraHTTPHeaders({ "x-cutover-test": "before" });
  const page = await ctx.newPage();

  console.log("\n=== mobile 390x844 ===");
  await page.goto(URL, { waitUntil: "networkidle" });

  const ctaButton = page
    .locator("button:visible, a:visible")
    .filter({ hasText: /inscrição|inscrever|garantir|entrar na lista|Quero a minha vaga/i })
    .filter({ hasNotText: /saltar|skip/i })
    .first();

  if ((await ctaButton.count()) > 0) {
    await ctaButton.click();
    try {
      await page.waitForSelector(".modal-overlay", { state: "visible", timeout: 5000 });
      console.log("  ✓ Modal ABRIU em mobile");
      await page.keyboard.press("Escape");
      await page.waitForSelector(".modal-overlay", { state: "detached", timeout: 5000 });
      console.log("  ✓ Modal FECHOU com ESC em mobile");
    } catch {
      falha("Modal NÃO abriu em mobile");
    }
  } else {
    falha("Nenhum CTA encontrado em mobile");
  }
  await ctx.close();
}

await browser.close();
console.log(
  `\n${totalFalhas === 0 ? "MODAL OK NA /LISTA ✓" : `${totalFalhas} FALHA(S)`}`
);
process.exit(totalFalhas === 0 ? 0 : 1);
