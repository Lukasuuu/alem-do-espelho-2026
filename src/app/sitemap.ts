import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { isDepoisDoCorte } from "@/lib/cutover";

/**
 * Sitemap dinâmico e fase-aware: lista apenas a rota ativa na fase corrente,
 * para nunca apresentar ao Google duas versões indexáveis em paralelo.
 * - Pré-corte:  /alem-do-espelho-2026/lista (lista de espera)
 * - Pós-corte:  /alem-do-espelho-2026   (versão do evento)
 *
 * O mesmo gate de virada do cutover: cada request decide a fase (não fica
 * congelado em build estático). Sem cache na fronteira de virada.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const depois = await isDepoisDoCorte();
  const rotaAtiva = depois ? "/alem-do-espelho-2026" : "/alem-do-espelho-2026/lista";

  return [
    {
      url: `${site.url}${rotaAtiva}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
