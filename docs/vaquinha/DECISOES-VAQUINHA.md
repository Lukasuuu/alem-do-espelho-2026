# Vaquinha ONG Atos — decisões e próximos passos (fonte de verdade)

> 13/10/2026. Este ficheiro **substitui** todas as mensagens anteriores sobre a vaquinha.
> Se algo aqui contradisser o código ou outra mensagem, vale este ficheiro — e diz ao Lucas.
> A especificação visual está em `docs/vaquinha/referencia-visual/` (lê o `LEIA-ME.md`).

---

## 0. Verificar a pasta antes de começar

`docs/vaquinha/referencia-visual/` tem de ter **7 HTML**:

```
01-computador.html        05-dados-transferencia.html
02-telemovel.html         06-agradecimento.html
03-metodos.html           07-partilha-og.html
04-dados-mbway.html       LEIA-ME.md   atos-icone.png
```

e o `LEIA-ME.md` tem de ter a secção **"Partilha — o link leva a causa consigo (revisão 5)"**.
Se tiveres só 4 HTML, é a versão antiga: apaga a pasta e usa a deste pacote.

Commita a pasta num caminho limpo. Apaga cópias duplicadas e `.zip` em `docs/vaquinha/`.

---

## 1. Decisões fechadas pelo Lucas

| Tema | Decisão |
|---|---|
| Título | **"Juntos por Angola"** (sem ponto final) |
| Meta | **5000 €** |
| Métodos | **Só MB Way e Transferência.** Não há link SumUp na vaquinha (o D3 desaparece) |
| Contagem | **Nunca** mostrar número de contribuições, em lado nenhum |
| Número grande / "Arrecadado" | **Só o confirmado.** As declaradas aparecem apenas como segmento às riscas na barra, sem texto |
| Fluxo | Método → dados + **«Já fiz a doação»** no mesmo ecrã → agradecimento. **Sem comprovativo** (não reutilizar o `PaymentProofUpload`) |
| Partilha | Rota própria `/alem-do-espelho-2026/vaquinha` com metadados e imagem OG próprios; um único botão "Partilhar a vaquinha" com `navigator.share` (detalhe no LEIA-ME) |
| Selo | **Símbolo da Atos sem a palavra**, como na prévia aprovada. Não é preciso mostrar alternativas |

---

## 2. Correções ao V2 (já escrito em `feat/vaquinha`)

- `iniciarDoacaoSchema.metodo` → `z.enum(["mbway", "transferencia"])`.
- `totalNaBarra()` deixa de ser o número mostrado. **Número = `confirmado_cents`**; a barra desenha `confirmado_cents` e `a_confirmar_cents` como dois segmentos separados.
- `TotaisVaquinha` perde `n_contribuicoes`.
- `pagamentoConfigurado()` verifica só o D4: número MB Way, IBAN e titular.
- Polling do cliente com `fetch(..., { cache: "no-store" })`, a cada 15 s, parado com o separador escondido.

---

## 3. Migration 0014b — escreve, mostra ao chat, **não apliques**

- **Seed** de `vaquinha_config`:
  - `inicio` = `EVENTO_ISO` (confirma: `2026-10-17T09:30:00+01:00`)
  - `meta_cents = 500000`, `ativa = true`, `contar_pendentes = true`, `valor_max_cents = 100000`
  - `admin_chave_hash` = sha256 em hex da chave admin. **Geras tu a chave** (≥32 caracteres aleatórios), guarda-la só na Vercel como env server-only, e no ficheiro e no chat vai **apenas o hash**.
- `doacoes.metodo`: constraint passa a `('mbway','transferencia')`. Tabela vazia, seguro.
- `iniciar_doacao`: validação do método com os mesmos dois valores.
- `vaquinha_totais()`: **tirar `n_contribuicoes`** da resposta (é chamável por anon em `/rest/v1/rpc`, não basta esconder no ecrã). Isto também resolve a inconsistência com `contar_pendentes`.
- Mesmo padrão da 0014: `create or replace`, `security definer`, `set search_path to ''`, uma assinatura por função, grants explícitos, queries de verificação no fim, linha no `migrations_aplicadas`.

O chat aplica pelo conector, verifica corpo a corpo contra o ficheiro do commit, e devolve o resultado.

---

## 4. Ambiente local

- Tira `SUPABASE_SERVICE_ROLE_KEY` do `.env.local` — a app não a usa e era uma pendência antiga.
- Acrescenta a publishable key ao `.env.local`, para testar localmente contra a base pelo caminho normal.

---

## 5. Ordem a partir daqui

1. Pasta da referência confirmada e commitada (secção 0).
2. Correções ao V2 (secção 2).
3. 0014b escrita → chat aplica → resultado das verificações.
4. **V3** — cartão no lugar do cronómetro + troca no zero, igual a `01` e `02`.
5. **V4** — modal de doação (`03`–`06`) + rota `/vaquinha` com OG (`07`).
6. **V5** — página do voluntário para confirmar/anular.
7. **V6** — QA, checklist de pré-go-live, preview.

Cada bloco fecha com capturas a 1440 e 390 px **lado a lado com a prévia**.
Para ver a vaquinha no preview antes de 17/10: `NEXT_PUBLIC_VAQUINHA_OVERRIDE=aberta` só no ambiente **Preview** da Vercel.

**Calendário:** produção na **sexta 16/10 de manhã**, com a vaquinha fechada pela data. Sábado ninguém faz deploy.

---

## 6. Fechado e em aberto

**Fechado a 13/10/2026:**

| # | Decisão | Onde vive |
|---|---|---|
| **D2** | Frase de transparência: «Os valores são recebidos por Vitória Gomes, organizadora do Além do Espelho, e entregues na totalidade à ONG Atos.» | `VAQUINHA_TRANSPARENCIA` em `src/lib/vaquinha.ts` |
| **D4** | MB Way: o mesmo número da inscrição (importado de `lib/pagamento.ts` — 9 dígitos a copiar, não o número formatado). Transferência: conta própria da vaquinha, beneficiário «Vitória Gomes», IBAN `PT50…1386` (mostrado com `formatarIban`, copiado sem espaços, com o tripwire `validarIban`). Sem BIC no ecrã: dentro da zona SEPA basta o IBAN. | `VAQUINHA_PAGAMENTO` em `src/lib/vaquinha.ts` |

**Ainda em aberto — com a Vitória:**

| | Bloqueia |
|---|---|
| **D5** — quem confirma as doações no dia (voluntário) | V5 (acesso à página) |
| **D6** — hora de fecho da vaquinha, ou aberta | nada: fica `null` e muda-se por SQL, sem deploy |

Enquanto o D5 e o D6 não fecharem, o checklist de pré-go-live acusa-os. Nunca mostrar placeholders em produção.

