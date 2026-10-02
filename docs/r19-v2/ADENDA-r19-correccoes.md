# ADENDA 1 ao R19 — duas correcções e o desbloqueio do anexo

> Substitui o que estiver em conflito no R19. Tudo o resto mantém-se.

---

## 0 — Anexo visual desbloqueado

O PDF era imagem pura e não tinha texto extraível. Já está rasterizado. Coloca estes cinco PNG em `proj\docs\esbocos-emails\` e usa-os como referência visual:

| ficheiro | conteúdo |
|---|---|
| `00-direcao-visual.png` | paleta aprovada e os três disparos |
| `01-participante-apos-formulario.png` | **Modelo 1** |
| `02-participante-pagamento-validado.png` | **Modelo 2** |
| `03-aviso-interno.png` | Modelo 3 (**ver correcção A — este esboço está desactualizado**) |
| `04-fluxo-implementacao.png` | fluxo e notas de alinhamento |

Amostra as cores do banner em `public/icone/` e deixa a amostra mandar sobre a tabela do Bloco 2, como estava dito.

---

## 1 — Decisões fechadas

Confirmadas pelo Lucas, sem reabertura:

- **1.1 Horário:** `09h30–18h00`. É o que está na página e o que o cronograma assume. Centraliza-o numa constante única partilhada pelo site e pelos emails. **Não** uses 09h00.
- **1.2 Dados pessoais no email da organização:** opção **(b)** — mantém a decisão de 06/09. Ver correcção A.
- **1.3 Modal de escolha de método:** mantém-se. O Modelo 1 passa a disparar no formulário com os três métodos dentro, e a modal continua a existir para quem preferir escolher no site.
- **1.4 `comprovativo_recebido`:** mantém-se, com os dois gatilhos actuais (upload no site e declaração SumUp).
- **«Ver esta inscrição»:** não existe rota autenticada de painel neste repositório. O botão sai, conforme a regra de não inventar URL. Aceite.

---

## 2 — CORRECÇÃO A · Modelo 3, aviso interno

**O esboço `03-aviso-interno.png` NÃO é para seguir no conteúdo.** Ele mostra nome, email e telefone; o Lucas decidiu manter a decisão de RGPD de 06/09.

O corpo deste email leva **exactamente dois campos**, e nada mais:

- **Referência da inscrição**
- **Data e hora da inscrição**, em `Europe/Lisbon`, formatada em português

Sem nome. Sem email. Sem telefone. Sem valor. Sem estado. Sem botão.

Consequências, e são boas para ti:

1. **Não é precisa migration nenhuma.** O ramo `org` da RPC `enfileirar_email` já ignora `p_dados` de propósito, e o `corpoOrg` actual já constrói precisamente «Quando» e «Referência». O conteúdo fica como está.
2. **O que muda neste modelo é só o gatilho e o assunto.** Hoje dispara em `/api/inscricao/metodo/route.ts:150` e o assunto diz «Nova inscrição **paga**». Passa a disparar na criação da inscrição, em `POST /api/inscricao`, e o assunto passa a `Nova inscrição · {{referencia}} — Além do Espelho 2026`. O texto do corpo que hoje diz «Nova inscrição paga» também tem de deixar de afirmar pagamento.
3. Actualiza o esboço mentalmente: mantém o cabeçalho, a etiqueta `NOVA INSCRIÇÃO · A AGUARDAR PAGAMENTO` e o título do esboço; substitui a tabela de seis linhas por duas.

O Modelo 3 é, portanto, o mais barato dos três. Faz este primeiro.

---

## 3 — CORRECÇÃO B · O comprovativo, no Modelo 1

Reformula esta secção. O que interessa ao Lucas não é que o botão se chame «WhatsApp» — é que a participante **consiga anexar o ficheiro** e que ele chegue à Vitória. O rótulo deve falar da acção, não do canal.

**Substitui a secção inteira por isto:**

Título: `JÁ FIZESTE O PAGAMENTO?`

```
Anexa o comprovativo e envia-o à Vitória. Ao tocares no botão, a conversa abre
com o teu nome e a tua referência já escritos — só tens de tocar no clip (📎) e
anexar o ficheiro antes de enviares.
```

*(sem o emoji no HTML final — descreve o clip por palavras: «o ícone de anexo».)*

Botão, em verde sálvia, com este rótulo:

```
Anexar comprovativo
```

Destino, inalterado — é o que abre a conversa da Vitória:

```
https://wa.me/351928400069?text=${encodeURIComponent(mensagem)}
```

Mensagem pré-preenchida, inalterada:

```
Olá, Vitória! Sou {{nome_completo}} e a minha referência é {{referencia}}.
Vou anexar o comprovativo do pagamento da minha inscrição no Além do Espelho 2026.
```

Por baixo, em texto pequeno, com o link também em texto:

```
Abre a conversa com a Vitória: +351 928 400 069 · Se já enviaste o comprovativo,
ignora este pedido.
```

### O que continua a ser verdade e tem de estar no teu relatório

O link abre a conversa com o texto escrito. **Não anexa o ficheiro sozinho** — nenhum link consegue fazer isso, em nenhuma plataforma. A pessoa toca no ícone de anexo e escolhe o ficheiro. Por isso o texto acima diz esse passo em voz alta, em vez de fingir que já aconteceu.

Não escrevas, em lado nenhum do email, que o comprovativo «foi enviado» ou «será anexado automaticamente».

### O mesmo no site

O botão equivalente na página usa o mesmo `wa.me`, o mesmo texto pré-preenchido e o mesmo rótulo `Anexar comprovativo`. O upload de ficheiro no site mantém-se a funcionar em paralelo (decisão 1.4) — são dois caminhos para a mesma coisa, e nenhum deles confirma pagamento.

---

## 4 — Ordem sugerida

1. Modelo 3 (só gatilho e assunto — o corpo já está certo).
2. Modelo 1 (o que tem mais superfície: três cartões de pagamento + secção do comprovativo).
3. Modelo 2 (mais simples, mas é o que leva a morada e o `09h30–18h00`).
4. Layout e paleta comuns aos três.
5. Pré-visualizações → aprovação do Lucas → Bloco 7-BIS (os três para o endereço de pré-visualização, `PREVIEW_TO`).
