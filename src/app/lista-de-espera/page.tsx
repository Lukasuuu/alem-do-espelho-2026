import { permanentRedirect } from "next/navigation";

/**
 * Rota antiga, a lista de espera vive agora em /alem-do-espelho-2026/lista.
 * 308 permanente: preserva links existentes sem conteúdo duplicado indexável.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  permanentRedirect("/alem-do-espelho-2026/lista");
}
