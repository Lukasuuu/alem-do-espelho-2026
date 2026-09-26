/**
 * Config partilhada dos emails (R19) — FONTE ÚNICA dos dados do evento que os
 * emails usam.
 *
 * ⚠️ IMPORTADO PELO NEXT: sem APIs Deno, sem imports com extensão .ts.
 * Este ficheiro é importado por TRÊS lados com runtimes diferentes:
 *   • src/lib/site.ts (Next/webpack) — uma edição aqui pode partir o BUILD DO
 *     SITE; o tsconfig exclui supabase/functions, mas o import puxa este
 *     ficheiro para o programa TypeScript.
 *   • supabase/functions/enviar-emails/index.ts (Deno — `supabase functions deploy`).
 *   • docs/previews-r19/gerar.mjs (Node 24 — pré-visualizações).
 * O Deno exige extensão `.ts` nos imports e o Next não a resolve num módulo
 * partilhado — por isso AQUI NÃO HÁ IMPORTS NENHUNS: tudo são constantes
 * puras. Lógica nova partilhada entra dentro deste ficheiro (ou num novo
 * ficheiro com o mesmo aviso), nunca num import externo.
 *
 * Alterar aqui actualiza os três. Fuso de referência: Europe/Lisbon (Braga).
 * Horário 09h30–18h00: decisão do Lucas (25/09, R19 §1.1) — mantém o
 * cronograma público; a Vitória tinha escrito 09h00.
 */

/** Par ISO do dia (usado pelo site p/ derivar horas com Intl e pelo JSON-LD). */
export const EVENTO_ISO = {
  inicio: "2026-10-17T09:30:00+01:00",
  fim: "2026-10-17T18:00:00+01:00",
} as const;

export const EVENTO = {
  nome: "Além do Espelho 2026",
  edicao: "2ª Edição",
  /** Sábado — verificado no calendário de 2026. Capital "S" como na maquete
   *  v2 (docs/r19-v2/maquetes/02, linha DATA). */
  data_extenso: "Sábado, 17 de outubro de 2026",
  data_curta: "17 de outubro",
  /** Texto canónico do cronograma (estilo "09h30–10h15"). O email v2 mostra
   *  "09h30 às 18h00" — templates.ts deriva-o daqui (replace do travessão). */
  horario: "09h30–18h00",
  local_nome: "INNSiDE by Meliá Braga Centro",
  local_morada: "Avenida Central 107, 4710-310 Braga",
  local_completo: "INNSiDE by Meliá Braga Centro · Avenida Central 107, 4710-310 Braga",
  /** Confirmação da morada (R19 §Bloco 4 — não é o outro Meliá de Braga):
   *  innsidebraga.com/hotel e melia.com (Av. Central 107, 4710-310 Braga). */
  mapa_url:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("INNSiDE by Meliá Braga Centro, Avenida Central 107, 4710-310 Braga"),
  valor_texto: "40,00 €",
  site_evento: "https://essenceofbeautysalon.com/alem-do-espelho-2026",
  /** Raiz do site (assinatura dos emails v2 — a maquete mostra o domínio). */
  site_raiz: "https://essenceofbeautysalon.com",
} as const;

/**
 * Assets dos emails v2 (ADENDA 2 §2) — Supabase Storage, INDEPENDENTE dos
 * deploys do site e da função (por isso não usam public/ do site: a ordem de
 * publicação é FUNÇÃO PRIMEIRO). Bucket PÚBLICO `email-assets`; URLs
 * confirmados com 200 + image/jpeg pelo r19-v2-assets.mjs ANTES do deploy.
 * JPG e não WebP — Outlook desktop não mostra WebP.
 */
export const ASSETS = {
  marca:
    "https://qtiyxibqeignvsnfhzpw.supabase.co/storage/v1/object/public/email-assets/email-marca.jpg",
  banner:
    "https://qtiyxibqeignvsnfhzpw.supabase.co/storage/v1/object/public/email-assets/email-banner.jpg",
  vitoria:
    "https://qtiyxibqeignvsnfhzpw.supabase.co/storage/v1/object/public/email-assets/email-vitoria.jpg",
} as const;