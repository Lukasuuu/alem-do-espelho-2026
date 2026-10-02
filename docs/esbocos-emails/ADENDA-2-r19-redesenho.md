# ADENDA 2 ao R19 — redesenho: marca real, voz da jornada, assinatura

> A Vitória reprovou os templates: design genérico, texto robótico e centrado em «nós», fora da história que o Além do Espelho conta. Esta adenda substitui a secção de layout (Bloco 2) e **todos os textos** dos modelos. Gatilhos, fila, decisões 1.1–1.4 e a ordem de publicação (função primeiro) mantêm-se.

**Anexo:** os ficheiros vivem em `proj\docs\r19-v2\` (o antigo `pacote-r19-v2.zip` era só a cópia compactada; está em `_artefactos\docs-r19-v2-duplicados\`). Contém:
- `maquetes/*.html` — **fonte de verdade** de layout e de texto para os três modelos de participante. Reproduz estas maquetes; não reinterpretes.
- `maquetes/*.png` — as mesmas em desktop e mobile, aprovadas para mostrar à Vitória.
- `assets/email-marca.jpg` (600×360), `assets/email-banner.jpg` (1200×350), `assets/email-vitoria.jpg` (480×480, círculo já recortado sobre marfim).

---

## 1 — O que estava errado (para não repetir)

**Design.** A regra «sem imagens externas» do R19 era minha e estava errada para este caso. Obrigou-te a imitar um logótipo com um rectângulo verde e texto — é isso que lê como genérico. Regra nova: **imagens permitidas, mas o email tem de continuar legível e completo com as imagens bloqueadas** (alt text descritivo, cor de fundo na célula, toda a informação essencial também em texto).

**Texto.** Os templates narravam o processo da organização («Recebemos… vamos validar… confirmamos…»). A participante não é um registo numa fila; é alguém que decidiu transformar a vida. O texto passa a estar centrado **nela e na jornada** — as três perguntas, «de dentro para fora», «Além de Mim» — e usa as frases que a Vitória escreveu, corrigidas.

---

## 2 — Assets: onde ficam

Os emails só podem referenciar URLs públicos HTTPS. **Não uses `public/` do site** — obrigaria a publicar o site antes da função, e a ordem é função primeiro.

Usa o Supabase Storage, independente dos dois deploys:

1. Cria um bucket **público** `email-assets` (SQL Editor ou REST com a service_role do `.env.local`).
2. Carrega os três ficheiros do pacote, com `Content-Type: image/jpeg`.
3. URLs finais: `https://qtiyxibqeignvsnfhzpw.supabase.co/storage/v1/object/public/email-assets/<ficheiro>`.
4. Confirma com `curl -I` que cada um devolve `200` e `image/jpeg` **antes** do deploy da função.
5. Guarda os três URLs em `_shared/config.ts` (uma só fonte).

JPG, não WebP — o Outlook de desktop e vários clientes não mostram WebP.

---

## 3 — Layout comum (ver maquetes)

- Fundo exterior `#F6ECEC`; cartão branco 600 px, cantos 18 px.
- **Cabeçalho:** `email-marca.jpg` a toda a largura, `alt="Além do Espelho · Além de Mim — 2.ª edição"`, célula com `background:#BE747F` para quando a imagem está bloqueada.
- **Kicker** em maiúsculas espaçadas, verde profundo `#455448`.
- **Título** em serifa (Georgia), 27 px, vinho `#49242B`, **uma frase com peso**, nunca um rótulo.
- **Citação** em itálico serifa, verde profundo, com filete rosa `#E8C9CA` à esquerda — é aqui que vai a frase da Vitória.
- Caixas de dados com borda fina `#E9DFDA`, rótulos pequenos, valores em serifa.
- Botões em pílula: sálvia `#667360` (acção principal) e verde profundo `#455448` (comprovativo).
- **Assinatura (novo — é o «anexo 1» da Vitória):** cartão marfim com retrato circular, «Vitória Gomes», «Anfitriã do Além do Espelho · Essence of Beauty», WhatsApp, local e site; painel verde profundo à direita com «Além do Espelho / *Além de Mim* / 2.ª EDIÇÃO · 2026». Aparece nos três modelos de participante.
  - **Mobile (< 480 px):** o painel verde passa para baixo do bloco da Vitória, a toda a largura. Usa `white-space:nowrap` no número de WhatsApp — na maquete mobile ele parte em duas linhas.
- Rodapé centrado, 11,5 px, cinza.

---

## 4 — Textos

Copia os textos das maquetes **palavra por palavra**. Resumo, com as variáveis:

### Modelo 1 · `instrucoes`
- **Assunto:** `O seu primeiro passo para o Além do Espelho · ref {{referencia}}`
- **Pré-cabeçalho:** `Sua inscrição foi recebida. Falta só um passo para garantir o seu lugar.`
- Kicker `INSCRIÇÃO RECEBIDA · PAGAMENTO PENDENTE`
- Título: *Toda transformação começa com uma decisão. A sua já foi tomada.*
- Corpo, citação da Vitória, bloco **«Doze momentos · três perguntas»** (1 Como eu me vejo? · 2 O que eu expresso e deixo no mundo? · 3 O que permanece quando o espelho deixa de ser suficiente?), «Garanta o seu lugar» com referência + investimento, três cartões de pagamento (dados de `pagamento.ts`, nunca das maquetes), «Já fez o pagamento?» com o botão **Anexar comprovativo** (o mesmo `wa.me`), e «Caso já tenha enviado, pode desconsiderar esta mensagem.»

### Modelo 2 · `confirmacao` (é o que as 13 vão receber)
- **Assunto:** `O seu lugar está garantido · Além do Espelho 2026`
- **Pré-cabeçalho:** `Seu lugar no Além do Espelho 2026 está garantido. Guarde a sua referência.`
- Kicker `PAGAMENTO CONFIRMADO · LUGAR GARANTIDO`
- Título: *Recebemos o seu pagamento. O seu lugar está garantido.* (palavras da Vitória)
- Citação da Vitória, **`email-banner.jpg`** com a legenda «As mulheres que vão caminhar com você nesta imersão de dentro para fora.», caixa Nº de inscrição + Confirmada, Data / Horário **09h30 às 18h00** / Local com morada, botão Ver localização, fecho «E não precisa levar nada além de você.»

### `comprovativo_recebido`
- **Assunto:** `O seu comprovativo chegou até nós · ref {{referencia}}` (ramo SumUp: `Recebemos a sua declaração de pagamento · ref {{referencia}}`, com a primeira frase ajustada para «a sua declaração de pagamento»)
- Título: *O seu comprovativo chegou até nós.* — corpo e citação conforme a maquete; caixa referência + «Em validação».

### Modelo 3 · `org_nova_inscricao` (interno)
Mantém os dois campos da Adenda 1 (referência + registada em). Aplica apenas o cabeçalho com a marca e o novo estilo de caixas. Sem assinatura, sem poesia — é para a equipa.

### Texto simples
Reescreve as versões `text` com as mesmas frases (sem a citação em itálico, que passa a linha normal).

---

## 5 — Duas coisas a confirmar com o Lucas (não bloqueiam o código)

1. **Registo «você» vs «tu».** As maquetes usam **você** — é o registo do banner («O que você vai viver?», «Venha descobrir o reflexo da sua verdadeira beleza») e das mensagens da própria Vitória. O site usa «tu». Implementa em «você»; se o Lucas decidir «tu», é uma troca de texto.
2. **Instagram da Vitória** na assinatura. Não aparece nas maquetes porque não o sabemos. **Não inventes.** Se o Lucas o der, entra como primeira linha de contacto.

---

## 6 — Verificação e depois

- Gera de novo as pré-visualizações e compara-as lado a lado com `maquetes/*.png`. Diferenças visíveis = defeito.
- Testa também com imagens desligadas (remove os `src`): tem de continuar legível.
- Grep de `{{`/`}}` e de campos vazios, como antes.
- Depois: upload dos assets → deploy da função → Bloco 7-BIS (os modelos para o endereço de pré-visualização, `PREVIEW_TO`) → só com o OK do Lucas, merge do site.
