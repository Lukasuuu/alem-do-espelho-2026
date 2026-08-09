/**
 * Prova de fuso do corte da campanha (check pré-deploy, part5a).
 *
 * Verifica que FIM_CAMPANHA_ISO = "2026-08-10T10:00:00+01:00" é, sem margem
 * para dúvida, 10/08/2026 às 10:00 em Lisboa (WEST, UTC+1 no verão), e que o
 * offset explícito "+01:00" o torna inequívoco (ao contrário de uma string
 * "sem offset", que seria interpretada como hora local do build e é o erro
 * clássico que já queimou o cronómetro uma vez).
 *
 * Uso:  node scripts/prova-fuso.mjs   (Node ≥ 22 com --experimental-strip-types
 *       implícito; corre a partir da raiz do projeto)
 */
import { FIM_CAMPANHA_ISO } from "../src/lib/campanha.ts";

const alvo = new Date(FIM_CAMPANHA_ISO);

// Relógio em Europe/Lisbon (a máquina de dev pode estar noutro fuso).
const lx = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
}).format(alvo);

// Offset efetivo de Lisboa nesse instante (tem de ser +01:00 = WEST, verão).
const off = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Lisbon",
  timeZoneName: "longOffset",
}).format(alvo);

// ALVO_MS é o mesmo valor usado pelo hook do countdown e pelo gate do servidor.
const ms = alvo.getTime();

// Prova do erro clássico: "sem offset" é lida como HORA LOCAL do servidor de
// build; com "+01:00" explícito o instante é inequívoco.
const alvoSemOffset = new Date("2026-08-10T10:00:00"); // sem Z, sem +01:00

const ok = lx.includes("10:00") && off.includes("+01:00");
console.log("FIM_CAMPANHA_ISO            :", FIM_CAMPANHA_ISO);
console.log("Em Europe/Lisbon (alvo)     :", lx, "  ← tem de ler 10:00");
console.log("Offset de Lisboa no instante:", off, "  ← tem de ser +01:00 (WEST)");
console.log("ALVO_MS (timestamp)         :", ms);
console.log(
  "Prova do erro clássico     : sem offset →",
  alvoSemOffset.toISOString(),
  "(interpretado como hora local, ambíguo)",
);
console.log(
  "RESULTADO:",
  ok ? `OK — 10/08 10:00 Lisboa = ${alvo.toISOString()}` : "FALHOU",
);
process.exit(ok ? 0 : 1);
