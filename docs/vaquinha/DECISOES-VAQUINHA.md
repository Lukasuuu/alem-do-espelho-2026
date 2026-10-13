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

| **D6** | A vaquinha fica aberta **até 18 de novembro** (antes da viagem a Angola): `fim = 2026-11-19T00:00:00+00:00`, ou seja, aberta durante todo o dia 18/11 em Lisboa. O prazo é **lido do `fim`** e mostrado no cartão («Até 18 de novembro», `fim − 1 ms` em Europe/Lisbon) — se a data mudar por SQL, o cartão acompanha sem deploy. Passou de um dia para um mês, e daí o estado «encerrada» no cartão. | `vaquinha_config.fim` |

**Ainda em aberto — com a Vitória:**

| | Bloqueia |
|---|---|
| **D5** — quem confirma as doações **até 18/11** (já não é só no dia do evento) | V5 (acesso à página) |

Enquanto o D5 não fechar, o checklist de pré-go-live acusa-o. Nunca mostrar placeholders em produção.

## 7. D7 — as inscrições fecham quando a vaquinha abre (13/10)

As inscrições pagas fecham no **sábado 17/10 às 09:30**, no mesmo instante em que a vaquinha abre. Uma
só fonte no servidor: `inscricoesEncerradas()` = `vaquinhaIniciada(VAQUINHA_INICIO_ISO)` em
`src/lib/vaquinha-fase.ts` — mesmo instante e mesmo override (`NEXT_PUBLIC_VAQUINHA_OVERRIDE=aberta`, só
no Preview, mostra a página pós-evento completa).

**Não se toca em `lib/fase.ts` nem em `lib/cutover.ts`, nem em `inscricaoAtiva()`**: o fecho é uma porta
NOVA, por cima.

| Fecha | Fica aberto |
|---|---|
| `POST /api/inscricao` (inscrições NOVAS) → 410 | `PATCH /api/inscricao/metodo` |
| `POST /api/sponsor` (patrocínio NOVO) → 410 | `/api/comprovativo` · `/api/inscricao/declarar-pagamento` · `/api/sponsor/metodo` |

Os passos que ficam abertos são de propósito: há inscrições pendentes que ainda podem pagar e enviar
comprovativo depois de sábado, e patrocinadoras já inscritas que ainda têm passos a dar.

**Interface, com as inscrições fechadas:** o «Quero garantir o meu lugar» sai do hero, do mapa do dia e
do rodapé; no cabeçalho (computador e telemóvel) passa a «Contribuir para a vaquinha», com scroll até
`#vaquinha` (a página vai ser a casa da vaquinha durante um mês); o `abrirFluxo` não abre a inscrição; e o
skip-link do layout passa a «Saltar para a vaquinha». Ao vivo, quando o cronómetro chega a zero (o mesmo
`onEncerrado` da troca do cartão), o botão de inscrição do hero sai também — o cabeçalho e o rodapé mudam
no carregamento seguinte, e até lá o 410 protege.

**Texto do hero**, decidido no servidor (`estadoEvento()`, valores lidos de `site.*`): antes de 17/10
09:30 é o de hoje; das 09:30 às 18:00 «O Além do Espelho está a acontecer hoje, no {local}, em
{cidade}. As inscrições estão encerradas. Agora, juntos por Angola.»; depois das 18:00 «A segunda edição
do Além do Espelho aconteceu a {data}, no {local}, em {cidade}. Obrigada a todas as que estiveram
connosco. Agora, juntos por Angola.»

**Patrocínios:** a `VitrinePatrocinadoras` **fica** visível — as patrocinadoras ganham um mês de
exposição com o tráfego da vaquinha. Sai só o fluxo de patrocínio novo (`SponsorFlow`). As
patrocinadoras ocultas (`visivel:false`) não se tocam.

### Checklist do V6 — acrescento

- [ ] `POST /api/inscricao` devolve **410** com «As inscrições já fecharam…», e `POST /api/sponsor`
      também — no Preview, com o override ligado.
- [ ] `PATCH /api/inscricao/metodo` **continua a responder** com as inscrições fechadas (erro de posse
      ou validação, nunca 410) — é o que deixa as pendentes pagar.
- [ ] O «Quero garantir o meu lugar» não aparece em lado nenhum (hero, mapa do dia, rodapé) e o
      cabeçalho diz «Contribuir para a vaquinha» a apontar para `#vaquinha`.
- [ ] A `VitrinePatrocinadoras` continua visível e o «Quero Patrocinar» não.
- [ ] Os três textos do hero conferidos (o «durante» e o «depois» forçados por
      `VAQUINHA_RELOGIO_ISO`, que é ignorado em produção).


## 8. V5 — a página do voluntário (construída a 14/10)

`/alem-do-espelho-2026/vaquinha/confirmar` — `noindex, nofollow`, fora de qualquer link público e sem
chrome do site. Desenhada para **telemóvel**: é alguém a conferir a app do MB Way e o extrato.

**Dois segredos diferentes, de propósito:**

| | Onde vive | Para que serve |
|---|---|---|
| Palavra-passe do voluntário | só o **sha256** na env `VAQUINHA_VOLUNTARIO_HASH` (server-only; a palavra-passe em claro não existe em lado nenhum) | entrar no ecrã |
| Chave admin | env `VAQUINHA_ADMIN_CHAVE` (server-only) | falar com as RPCs de admin (`admin_listar_doacoes`, `admin_decidir_doacao`) |

Ou seja: saber a palavra-passe dá acesso ao ecrã, **não à chave** — o browser nunca vê a chave, e são as
rotas de servidor que chamam as RPCs. O cookie é httpOnly + Secure + SameSite=Strict e o seu valor é
**derivado** do hash (não é a palavra-passe nem o hash). Login com limite de tentativas por IP — aqui o
limite faz sentido, ao contrário das rotas públicas da vaquinha.

A fila são as `declarada` primeiro; as já decididas ficam abaixo, para poder corrigir um engano.
Confirmar é um toque; anular pede confirmação e aceita nota. A lista atualiza a cada 15 s, e para com o
separador escondido.

**Se a leitura falhar, o painel diz que falhou** — nunca «não há nada por confirmar», que faria o
voluntário fechar a página com doações à espera.

O **D5** decide A QUEM se entrega a palavra-passe; não muda nada do que está construído.
