# Data Integrity Patterns

> Consistência e idempotência nas escritas. Base: RPC `join_waitlist` no Supabase.

## Escritas

- **Escrita via RPC** (`supabase.rpc("join_waitlist", { p_* })`), não insert directo genérico — a lógica
  de constraints, validação de domínio e **deduplicação por email** vive na BD, atómica.

## Idempotência

- **Duplicado:** a RPC devolve `status: "already_registered"` (200) quando o email já existe —
  submissões repetidas não criam fila duplicada. Teste: submeter 2× o mesmo email → 1ª 201, 2ª 200.

## Invariantes / constraints

- `validarTelefone` + normalização **E.164** antes de persistir → a BD recebe formato canónico.
- `consent` forçado a `true` no call (fluxo de inscrição exige consentimento explícito do form).
- `p_ip_hash` (hash do IP) guardado, **nunca o IP em claro**.
- `utm` e `referrer`/`user_agent` como contexto de origem (rastreabilidade de campanha).

## Migrações

- **Sempre reversíveis.** Nova tabela de sponsors: criar com constraints, popular, validar, depois trocar a rota.
- Manter `already_registered` idempotente quando houver novos campos de origem (merge, não duplicar).

## Checklist

- [ ] Escritas multi-tabela em transacção (RPC atómica).
- [ ] Deduplicação por email.
- [ ] E.164 na persistência.
- [ ] Sem PII em claro na BD (IP hasheado).
- [ ] Migração reversível antes de promoção.
