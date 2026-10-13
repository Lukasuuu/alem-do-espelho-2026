"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Entrada do voluntário: uma palavra-passe, mais nada.
 *
 * Não diz se a palavra-passe existe ou se o ambiente está por configurar — a
 * mensagem é a mesma nos dois casos. O limite de tentativas é do lado do
 * servidor (rota /entrar); aqui só se evita o duplo toque.
 */
export default function LoginVoluntario() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAEntrar(true);
    try {
      const r = await fetch("/api/vaquinha/voluntario/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const dados = (await r.json()) as { ok: boolean; mensagem?: string };
      if (!r.ok || !dados.ok) {
        setErro(dados.mensagem ?? "Não conseguimos entrar agora. Tenta novamente.");
        return;
      }
      // O cookie já está posto: o servidor volta a renderizar, agora com a lista.
      router.refresh();
    } catch {
      setErro("Sem ligação ao servidor. Tenta novamente.");
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-creme px-5 py-16">
      <form onSubmit={entrar} className="w-full max-w-sm">
        <p className="eyebrow text-tinta-suave">Vaquinha · ONG Atos</p>
        <h1 className="display mt-2 text-[2rem] leading-[1.05] text-vinho">
          Confirmar contribuições
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-tinta-suave">
          Escreve a palavra-passe do voluntário para veres as contribuições por confirmar.
        </p>

        <label htmlFor="senha" className="eyebrow mt-7 block text-tinta-suave">
          Palavra-passe
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          aria-invalid={erro !== null}
          aria-describedby={erro ? "erro-senha" : undefined}
          className="mt-2 h-12 w-full rounded-xl border border-areia bg-white px-3.5 text-base text-vinho"
        />

        {erro && (
          <p id="erro-senha" role="alert" className="mt-2 text-[0.8125rem] font-medium text-vinho-profundo">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={aEntrar || senha.length === 0}
          className="mt-5 flex h-[52px] w-full items-center justify-center rounded-full bg-vinho text-base font-semibold text-creme-neon transition-colors duration-300 hover:bg-vinho-claro disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aEntrar ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
