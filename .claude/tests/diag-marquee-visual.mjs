import { chromium } from "playwright-core";

const EXE = "C:\\Users\\luc__\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const URL = "http://localhost:3001/alem-do-espelho-2026";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Diagnóstico completo
const diag = await page.evaluate(() => {
  const marquee = document.querySelector(".marquee-foco");
  if (!marquee) return { error: ".marquee-foco NOT FOUND" };

  const rect = marquee.getBoundingClientRect();
  const style = getComputedStyle(marquee);
  const track = marquee.querySelector(".flex.w-max");
  const anim = track?.getAnimations()[0];

  // Encontrar todos os elementos com classe marquee-foco
  const allMarquees = document.querySelectorAll(".marquee-foco");

  // Verificar se está dentro de um Reveal (framer-motion)
  let parent = marquee;
  let revealInfo = null;
  while (parent) {
    const s = getComputedStyle(parent);
    if (s.opacity !== "1" && parent !== marquee) {
      revealInfo = {
        tag: parent.tagName,
        className: parent.className?.slice(0, 80),
        opacity: s.opacity,
        transform: s.transform,
        visibility: s.visibility,
      };
      break;
    }
    parent = parent.parentElement;
  }

  // Verificar a secção pai
  const section = marquee.closest("section") || marquee.closest("[id]");

  return {
    marqueeFound: true,
    count: allMarquees.length,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    opacity: style.opacity,
    visibility: style.visibility,
    overflow: style.overflow,
    position: style.position,
    trackX: track ? Math.round(track.getBoundingClientRect().x) : null,
    trackW: track ? Math.round(track.getBoundingClientRect().width) : null,
    transform: track ? getComputedStyle(track).transform : null,
    animState: anim?.playState,
    animTime: Math.round(anim?.currentTime ?? 0),
    parentSection: section ? { tag: section.tagName, id: section.id, class: section.className?.slice(0, 60) } : null,
    revealParent: revealInfo,
    viewportH: window.innerHeight,
    scrollY: window.scrollY,
    bodyH: document.body.scrollHeight,
  };
});

console.log("=== DIAGNÓSTICO MARQUEE ===");
console.log(JSON.stringify(diag, null, 2));

// Agora scroll para o marquee ficar visível
await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  m?.scrollIntoView({ block: "center", behavior: "instant" });
});
await page.waitForTimeout(1000);

const afterScroll = await page.evaluate(() => {
  const m = document.querySelector(".marquee-foco");
  const r = m?.getBoundingClientRect();
  return {
    vpPos: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    scrollY: window.scrollY,
  };
});
console.log("\nApós scrollIntoView:", JSON.stringify(afterScroll));

// Full page screenshot com padding à volta do marquee
// Usar fullPage para capturar tudo
await page.screenshot({ path: ".claude/tests/fullpage-marquee.png", fullPage: false });
console.log("Viewport screenshot guardada");

await browser.close();
