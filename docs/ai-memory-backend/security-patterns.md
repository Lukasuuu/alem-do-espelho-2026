# Security Patterns

> Padrões de segurança aplicados nas rotas. **Reusar em todo endpoint público.**

## Regras inegociáveis

1. **Segredo em env var, nunca no código, nunca no client bundle.**
   - Supabase creds em `.env.local` → `getSupabase()` em `src/lib/supabase.ts`.
   - Nunca prefixar secrets com `NEXT_PUBLIC_`.
2. **Validar entrada na fronteira** — Zod (`waitlistSchema`) antes de qualquer lógica.
3. **Rate limit em todo endpoint público** — `rateLimit('rota:${hashIp}')` por hash de IP (ver B-002).
4. **Authz na camada de dados** — RLS no Supabase; a rota só invoca RPC autorizado.
5. **Nunca logar PII** — email mascarado, IP hasheado (ver observability-playbook).
6. **Erro genérico ao cliente** — mensagens `MENSAGENS.*`; nunca stack/detalhe interno.

## Anti-bot (defesa em profundidade, além do rate limit)

- **Honeypot:** campo `website` escondido — se preenchido, bot.
- **Tempo mínimo:** `elapsedMs < 2500` → provável bot.
- **Resposta genérica 400** para ambos — não revelar qual gatilho disparou.

## Validação de contacto

- `validarTelefone(phone, phoneCountry)` — validação real por país + normalização **E.164** antes de persistir.
- Erros mapeados: `invalid_email`, `invalid_phone`, `invalid_full_name` (códigos da RPC) → 422 por campo.

## Menor privilégio

- O cliente Supabase da rota só invoca a RPC `join_waitlist` (não expõe `.from()` genérico com acesso amplo).
- RLS na BD como camada final de autorização.

## Checklist

- [ ] Nenhum segredo no client bundle.
- [ ] Zod na fronteira de cada rota.
- [ ] Rate limit activo por rota pública.
- [ ] Sem PII em logs.
- [ ] Erros genéricos ao cliente.
- [ ] RLS no Supabase.
