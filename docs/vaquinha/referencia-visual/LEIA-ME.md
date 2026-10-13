# Referência visual APROVADA — Vaquinha ONG Atos

> Aprovada pelo Lucas a 13/10/2026: **"tem de ficar exatamente assim"**.
> Revisão 2 (13/10, 08:30): título "Juntos por Angola", só MB Way e
> transferência, meta 5000 €, sem número de contribuições, partilha em redes sociais.
> Revisão 3 (13/10, 08:35): ecrã de dados de pagamento com confirmação no próprio
> ecrã — método → dados + «Já fiz a doação» → agradecimento. Sem comprovativo.
> Coloca esta pasta em `docs/vaquinha/referencia-visual/` e usa-a no V3 e no V4.
> Não é código para copiar para `src/` — é a especificação visual. Os valores
> (cores, tamanhos, espaçamentos, raios, sombras, ordem dos elementos) estão todos
> inline nos `.html` e são para reproduzir com os componentes e tokens do projeto.

## Ficheiros

| Ficheiro | Ecrã | Bloco |
|---|---|---|
| `01-computador.html` | Hero a 1440 px com o cartão no lugar do cronómetro | V3 |
| `02-telemovel.html` | Hero a 390 px com o cartão | V3 |
| `03-metodos.html` | Folha "A tua contribuição" — escolha do método | V4 |
| `04-dados-mbway.html` | Dados MB Way + «Já fiz a doação» | V4 |
| `05-dados-transferencia.html` | Dados da transferência + «Já fiz a doação» | V4 |
| `06-agradecimento.html` | Agradecimento, barra atualizada e partilha | V4 |
| `07-partilha-og.html` | Imagem de pré-visualização do link (1200×630) | V4 |
| `atos-icone.png` | Só o símbolo da Atos (sem a palavra) — **é o do selo** | V3 |

## Fluxo — três ecrãs, nada mais

1. **Método** (`03`): dois cartões, MB Way e Transferência. Tocar num deles chama `/iniciar` e abre logo o ecrã de dados desse método.
2. **Dados e confirmação** (`04` / `05`): dados para pagar com botões de copiar (número ou IBAN, valor, referência), e o botão **«Já fiz a doação»** no fundo do mesmo ecrã. **Não há passo de comprovativo** na vaquinha — a referência é o que a organização usa para confirmar.
3. **Agradecimento** (`06`): abre diretamente depois de `/declarar` responder com sucesso.

**Toque cedo demais em «Já fiz a doação»:** a base recusa declarações feitas menos de 10 s depois de escolher o método (`declaracao_demasiado_rapida`). Não desativar o botão nem mostrar contagem decrescente — se a recusa acontecer, mostrar por baixo do botão, sem fechar o ecrã: «Conclui primeiro o pagamento na tua app e depois carrega em «Já fiz a doação».»

**Dados por preencher (D4):** número MB Way, IBAN e titular de doações aparecem entre parêntesis retos na prévia. Vêm de `src/lib/vaquinha.ts`; o checklist de pré-go-live falha se algum estiver vazio.

## Mapa dos assets (os `.html` apontam para URLs de pré-visualização)

| No `.html` | No projeto |
|---|---|
| `/_blob/67d24832…` (símbolo da Atos) | `public/causa/ong-atos-icone.webp` (o que já existe) — ou este `atos-icone.png`, se o existente estiver diferente |
| `/_blob/c4a3ad56…` (lockup Atos com a palavra) | `public/causa/ong-atos-lockup.webp` |
| `/_blob/d5fe96fd…` (foto do hero) | a foto que o hero já usa — não muda |
| `/_blob/b2ece74c…`, `/_blob/12173aad…` | `public/icone/mbway.webp`, `mb-transferencia.webp` |

## O que é exato e o que se adapta

**Exato (não reinterpretar):**
- Cartão creme `#fff7e9` (`--color-creme-neon`), raio 18 px no computador / 16 px no telemóvel, sombra `0 24px 60px rgba(10,16,12,.35)`.
- Selo circular a sobrepor o canto superior direito: disco creme, borda `#e6d6c6`, texto `VAQUINHA SOLIDÁRIA · ONG ATOS · ANGOLA ·` a rodar (24 s/volta, parado com reduced-motion), **símbolo da Atos sem a palavra** ao centro. 118 px no computador, 92 px no telemóvel.
- Título: **"Juntos por Angola"** (sem ponto final).
- Ordem: sobrescrito → título → frase → valor grande "X € arrecadados de 5000 €" → barra → "Arrecadado / Meta" → "ESCOLHE UM VALOR" → chips → botão → frase de transparência.
- **Nunca mostrar quantas contribuições houve, nem nenhuma linha sobre valores "a confirmar".** O número grande e "Arrecadado" são só o valor **confirmado**.
- Barra: trilho `#f2cdba` (`--color-blush`), confirmado `#5c323e` (`--color-vinho`) sólido; a seguir, sem legenda nem texto, um segmento em riscas `#c47e8a`/`#dfa9b2` com o valor declarado ainda por confirmar (é o que faz a barra mexer logo após cada doação). Altura 12 px, cantos redondos. O interruptor `contar_pendentes = false` faz esse segmento desaparecer.
- **Só dois métodos: MB Way e Transferência.** Não existe pagamento por link na vaquinha.
- Chips e botão em `--color-vinho` com texto creme quando selecionados; não selecionados em branco com borda `#d8c2b4`. Alvos ≥ 44 px.
- No telemóvel, os quatro valores numa grelha de 4 colunas e "Outro valor" numa linha inteira por baixo.
- Folhas do V4 em creme (tom claro), cabeçalho com título à esquerda, valor à direita e o X reservado à direita.
- Agradecimento: lockup da Atos, "Obrigada!", "A tua contribuição de X € já aparece na barra.", referência num chip, mini-barra com o segmento novo e a nota "O valor arrecadado atualiza quando confirmarmos o recebimento.", bloco **"AJUDA A CHEGAR MAIS LONGE"**, "Fechar" (contorno), linha fina de tempo no topo.

## Partilha — o link leva a causa consigo (revisão 5, 13/10)

O link vai **dentro** da partilha, e quem o recebe tem de perceber a causa sem abrir nada. Duas peças:

### 1. Rota própria com pré-visualização da causa

**Não partilhar `…/alem-do-espelho-2026#vaquinha`.** O `#` não muda a pré-visualização: o WhatsApp e o Facebook mostrariam a imagem e o título **do evento**, não da vaquinha.

Cria `src/app/alem-do-espelho-2026/vaquinha/page.tsx`:
- **Renderiza a mesma página do evento** (mesmo componente, mesmo gate server-side) e, ao montar, faz scroll suave até `#vaquinha`.
- **Não fazer redirect HTTP** (307/308): os robôs das redes seguem o redirect e leem os metadados da página de destino — volta a aparecer o evento.
- `generateMetadata` próprio:
  - `title`: `Juntos por Angola — Vaquinha solidária da ONG Atos`
  - `description`: `Contribui a partir de 5 € e ajuda as mulheres apoiadas pela ONG Atos, em Angola.`
  - `openGraph` e `twitter` (`summary_large_image`) com a imagem abaixo, `url` canónico desta rota, `locale: pt_PT`.
- Imagem `opengraph-image.tsx` (ImageResponse, 1200×630) **igual a `07-partilha-og.html`**, com as fontes reais do site. Gerada no build, não por pedido.
  - **Sem valores dinâmicos** (arrecadado, barra): as redes guardam a imagem em cache durante dias e ficaria desatualizada. A meta também não entra.
  - Tamanho final **abaixo de ~300 KB** — o WhatsApp é exigente com imagens grandes e falha a pré-visualização em silêncio.

### 2. O botão "Partilhar a vaquinha" (`06-agradecimento.html`)

- Por cima do botão, a **pré-visualização** do que vai ser partilhado (miniatura + título + descrição + domínio), para quem doa saber o que os amigos vão ver. É estática — não é um componente de terceiros.
- Ao tocar: `navigator.share({ title, text, url })`
  - `url`: `https://essenceofbeautysalon.com/alem-do-espelho-2026/vaquinha`
  - `title`: `Juntos por Angola`
  - `text`: `Contribuí para a vaquinha solidária da ONG Atos, no Além do Espelho. Cada contribuição, a partir de 5 €, apoia as mulheres apoiadas pela ONG Atos em Angola. Contribui também:`
  - No telemóvel abre a folha nativa, onde a pessoa escolhe a app (WhatsApp, Instagram, Facebook, …).
- **Sem `navigator.share`** (vários browsers de computador): o mesmo botão copia `text + " " + url` e mostra por baixo "Mensagem copiada — cola onde quiseres." **Sem campo de link visível nem botões por rede social.**
- `navigator.share` lança `AbortError` quando a pessoa fecha a folha sem escolher — ignorar em silêncio, não é erro.
- Nunca incluir no que é partilhado a referência nem o valor doado.

### Verificação obrigatória antes de sexta

Depois do deploy de preview, colar o link `/vaquinha` numa conversa de WhatsApp e no [depurador de partilha do Facebook](https://developers.facebook.com/tools/debug/) e confirmar: imagem da causa, título "Juntos por Angola…", descrição certa. Captura de ambos no relatório do V6.

**Adapta-se ao projeto:**
- **Tipografia:** a prévia usa *Cormorant Garamond* e *Pinyon Script* só porque a Recline não carrega fora do site. No site, os títulos são na **Recline** e o "Além de Mim!" na fonte script que o hero já usa. Jost mantém-se.
- **Larguras do computador:** seguem o contentor real do hero; o cartão mantém ~520 px.
- **Cabeçalho e hero à volta do cartão:** já existem no site — não os redesenhes a partir da prévia.
- **Números** (1240 € / 3000 €, ATOS-7K3F) são de exemplo. Vêm de `vaquinha_totais()`.
- **WhatsApp** na folha dos métodos: ícone verde, texto em vinho (verde sobre creme não tem contraste para texto).

## Validação do V3/V4

Captura Playwright a 1440 e a 390 px **lado a lado com a captura da prévia**, enviada ao Lucas antes de fechar o bloco. Diferenças além da tipografia e dos números têm de ser justificadas.
