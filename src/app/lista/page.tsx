import { permanentRedirect } from "next/navigation";

/**
 * Rota antiga — a lista de espera vive agora em /alem-do-espelho-2026/lista.
 * 308 permanente: preserva o URL que já circulou (WhatsApp, biografia, posts),
 * sem criar conteúdo duplicado indexável.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  permanentRedirect("/alem-do-espelho-2026/lista");
}
