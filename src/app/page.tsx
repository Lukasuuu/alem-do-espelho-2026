import { permanentRedirect } from "next/navigation";

/**
 * A raiz do domínio redireciona (308) para a versão do evento.
 * Nunca servimos conteúdo aqui: evita duplicar a landing entre / e
 * /alem-do-espelho-2026 (conteúdo duplicado indexável).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  permanentRedirect("/alem-do-espelho-2026");
}
