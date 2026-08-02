# Prompt Template — Backend / API

> Reutilizável para iniciar um novo trabalho de backend com o protocolo completo.

---

# Tarefa de Backend / API

**1. Contexto**
- Projecto / produto:
- Rotas actuais e contratos:
- BD / provider (Supabase? outro?):
- Ambiente de deploy:

**2. Escopo**
- O que entregar (rota, validação, persistência, integração):
- Endpoint(s) e método(s):
- Dados de entrada/saída:
- Autenticação/autorização necessária?:
- Idempotência esperada?:

**3. Restrições**
- Framework/runtime (padrão: Next.js API routes + Node):
- Segredos em env (nunca no código/client bundle):
- Padrões do repo a reutilizar (Zod schema, rate-limit, validarTelefone, envelope de resposta):

**4. Critérios de qualidade**
- Aplicar `docs/ai-memory-backend/playbook-backend.md`.
- Reportar no final: o que foi feito / corrigido / aprendido / adicionado à memória / riscos / próximos passos.
- Gates: typecheck/build/testes, contratos preservados, auth adequada, sem PII em logs, rate limit, checklist preenchido.

**5. Extras**
- Observabilidade esperada (logs estruturados)?:
- Performance budget:
- Migração de BD (reversível)?:
