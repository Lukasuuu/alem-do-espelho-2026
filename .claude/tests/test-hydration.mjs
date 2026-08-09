import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const erros = [];
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => erros.push("PAGEERROR: " + e.message.slice(0, 300)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Verificar hydration errors
const hydrationErrors = erros.filter(e => e.includes("hydrat") || e.includes("Hydrat") || e.includes("server rendered HTML"));

console.log("=== HYDRATION TEST ===");
console.log("Total console errors:", erros.length);
console.log("Hydration-specific errors:", hydrationErrors.length);

if (hydrationErrors.length > 0) {
  console.log("\nHYDRATION ERRORS:");
  hydrationErrors.forEach(e => console.log("  -", e.slice(0, 200)));
  console.log("\n❌ HYDRATION ERROR AINDA PRESENTE");
  process.exit(1);
} else {
  console.log("\n✅ SEM HYDRATION ERRORS");
  if (erros.length > 0) {
    console.log("\nOutros erros (não-hydration):");
    erros.forEach(e => console.log("  -", e.slice(0, 200)));
  }
  process.exit(0);
}

await browser.close();
