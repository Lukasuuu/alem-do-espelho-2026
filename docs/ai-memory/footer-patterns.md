# Padrão de Footer (compacto, responsivo, com modais legais)

> Padrão reutilizável de footer de landing. Feito em `src/components/Footer.tsx` (commit associado à
> tarefa #27). Objetivo: informação essencial num único bloco, sem overflow, com links legais
> em modais (não em páginas separadas — menos rotas para manter e indexar).

## Estrutura

1. **Barra única compacta** — logo EB + nome + contactos essenciais num só bloco (mobile-first).
2. **Links de contacto** — email e WhatsApp (número centralizado em `site.ts`, ver D-001/tarefa #20).
3. **Modais legais** — "Termos de Serviço" e "Política de Privacidade" abrem `Modal` (não navegam para outra rota).
4. **Sem overflow horizontal** em nenhum breakpoint.

## Regras

- Contacto **nunca** hardcoded no footer: fonte única `site.contacto` em `src/lib/site.ts` (email + `whatsapp.numero` + `linkWhatsApp()`).
- Modais legais reutilizam `Modal.tsx` — zero duplicação de comportamento (ver `modal-patterns.md`).
- Legibilidade: contraste ≥ 4.5:1; alvo de toque ≥ 44×44px em links principais.
- Responsividade: quebra limpa (stack vertical em mobile, linha em desktop) — testar nos 4 viewports do QA.

## Validação

- `scripts/modal-qa.mjs` valida as modais legais (termos/privacidade) × viewports.
- Check visual por breakpoint: sem overflow X, sem texto cortado.
