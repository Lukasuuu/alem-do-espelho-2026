import { permanentRedirect } from "next/navigation";

/**
 * Rota antiga — a página vive agora em /lista. Redirect permanente (308)
 * para preservar links existentes e o valor SEO que aponte para o caminho
 * anterior, sem conteúdo duplicado.
 */
export default function Page() {
  permanentRedirect("/lista");
}
