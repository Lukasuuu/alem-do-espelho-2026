# Prompt Template — Landing Page

> Reutilizável para iniciar um novo trabalho de landing page com o protocolo completo.
> Copia, preenche e envia.

---

# Tarefa de Landing Page

**1. Projecto / contexto**
- Nome e marca do produto/evento:
- Cliente / stakeholder:
- Público-alvo:
- Link do projecto actual (se existir):
- Repositório:

**2. Escopo (o que queres entregar)**
- Objectivo principal (conversão / pré-registo / patrocínio / outro):
- Secções pedidas:
- CTA principal e destino:
- Formulário(s) e dados recolhidos:
- Domínio / rotas:
- Data-limite ou evento (se cutover temporizado):

**3. Restrições e stack**
- Framework (preferência: Next.js + TS):
- Identidade visual (paleta hex, tipografia, KeyArt) ou "segue a memória do design signature":
- Componentes que não podem ser duplicados (modal, form, contacto):
- Restrições de dependências (>50MB pedir antes):

**4. Critérios de qualidade (protocolo enterprise)**
- Aplicar `docs/ai-memory/playbook-landing-page.md` (6 fases, severity S0–S3, gates).
- Reportar no final com os 7 blocos: resumo, mudanças, bugs (severidade), evidências, score, riscos+rollback, memória/lições.
- Gates obrigatórios: typecheck/build limpos, CTA+form OK, modais acessíveis, footer sem overflow, SEO mínimo, a11y básica.

**5. Extras**
- QA automatizado (Playwright) esperado? (sim/não)
- Deploy: preview antes de produção? (sim/não)
- Rotas de cutover/legacy a manter?
