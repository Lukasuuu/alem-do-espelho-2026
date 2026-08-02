# Além do Espelho 2026 — Lista de espera

Landing page de captação para a 2ª edição do evento.
**17 de outubro de 2026 · INNSiDE by Meliá, Braga.**

---

## Subir isto ao ar (10 minutos)

### 1. Instalar e testar localmente

```bash
npm install
cp .env.example .env.local   # depois preenche as chaves (secção 2)
npm run build && npm start   # http://localhost:3000
```

### 2. Variáveis de ambiente

Cria `.env.local` (local) e adiciona as mesmas na Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://qtiyxibqeignvsnfhzpw.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_reYCZiV6gc8Rqt6Q2kqyRg_e0-uxttv
IP_HASH_SALT=<qualquer string longa e aleatória, só tua>
NEXT_PUBLIC_SITE_URL=https://essenceofbeautysalon.com
```

> A base de dados **já está criada e configurada**. Não é preciso correr SQL nenhum.
> O ficheiro `supabase/migrations/0001_waitlist.sql` está no repo só para poderes
> recriar tudo do zero se algum dia precisares.

### 3. Git

```bash
git init
git add .
git commit -m "feat: landing page da lista de espera — Além do Espelho 2026"
git branch -M main
git remote add origin git@github.com:Lukasuuu/alem-do-espelho-2026.git
git push -u origin main
```

### 4. Vercel

```bash
npx vercel            # preview
npx vercel --prod     # produção
```

Ou pelo painel: **New Project → importar o repo → Add Environment Variables**
(as três de cima, para Production *e* Preview) → Deploy.

### 5. Domínio

Vercel → Project → Settings → Domains → adicionar o domínio → apontar o DNS
conforme as instruções que aparecem.

### 6. Domínio e publicação (`essenceofbeautysalon.com`)

O domínio canónico é `https://essenceofbeautysalon.com` — é para onde apontam o
`canonical`, o Open Graph, o sitemap e o `robots.txt`.

- Define `NEXT_PUBLIC_SITE_URL=https://essenceofbeautysalon.com` na Vercel
  (Production *e* Preview) — o `src/lib/site.ts` usa este valor em todo o SEO.
- Nos previews (`*.vercel.app`) o `canonical` continua a resolver para
  `https://essenceofbeautysalon.com/...`, evitando conteúdo duplicado.
- Sitemap (`/sitemap.xml`) e `robots.txt` são gerados em
  `src/app/sitemap.ts` e `src/app/robots.ts`, usando o mesmo domínio.

**Domínio secundário:** `alemdoespelho2026.com` — ligado ao mesmo projeto. A
página do evento responde em `https://alemdoespelho2026.com/lista`, mas o
`canonical` aponta sempre para `https://essenceofbeautysalon.com/lista` (sem
conteúdo duplicado).

> Sem `NEXT_PUBLIC_SITE_URL` definida, o `src/lib/site.ts` usa por defeito
> `https://essenceofbeautysalon.com`.

> ⚠️ Nota sobre domínios: `essenceofbeauty.com` pertence à CVS Health (não é
> obtenível) e `alemdoespelho.com` está estacionado/à venda no GoDaddy. Por isso
> o principal é `essenceofbeautysalon.com` e o secundário `alemdoespelho2026.com`.

---

## Como funciona a inscrição

```
Formulário → POST /api/waitlist → RPC join_waitlist() → Postgres
```

**Camadas de proteção, por ordem:**

| Camada | O que faz |
|---|---|
| Cliente | Valida nome/email/telemóvel antes de deixar submeter |
| Rate limit | 5 tentativas por IP por minuto |
| Honeypot | Campo invisível — se vier preenchido, é robô |
| Tempo mínimo | Submissões com menos de 2,5 s são rejeitadas |
| Zod | Valida e normaliza o formato de tudo |
| libphonenumber | Valida o telemóvel contra as regras reais do país e converte para E.164 |
| Postgres | `CHECK` constraints + índice único no email |

**Decisões que valem a pena conhecer:**

- A tabela tem **RLS ativo e nenhuma policy pública**. Nem com a chave em mãos
  alguém lê a lista. A escrita passa só pela função `join_waitlist`, que é
  `SECURITY DEFINER` — por isso a service role key nunca sai do painel Supabase.
- **Inscrever duas vezes não duplica.** O segundo envio atualiza os dados e
  devolve `already_registered`. A pessoa vê "já estavas connosco" em vez de erro.
- **O IP é guardado só como hash** (SHA-256 + salt). Dá para detetar abuso sem
  guardar um dado pessoal em claro.
- **Zero pedidos ao Google Fonts.** A Jost está alojada no próprio domínio, o que
  evita transferir IPs de visitantes para fora da UE — algo que já rendeu coimas
  em tribunais europeus.
- Cada inscrição guarda UTMs, referrer e user agent. Dá para saber que campanha
  trouxe cada pessoa.

---

## Como funciona o patrocínio

"Quero Patrocinar" (secção Realização) abre o **mesmo** formulário com
`variant="sponsor"` → `POST /api/sponsor`. Reutiliza a validação e o anti-bot
da lista de espera; no sucesso mostra "Falar com Vitória" — o mesmo WhatsApp do
footer, com mensagem pré-preenchida.

**Persistência:** ainda não existe tabela de leads de patrocínio — o interesse é
registado no log da função com o email mascarado (RGPD, nada em claro). Quando a
tabela existir, troca-se o `console.info` do passo 6 em
`src/app/api/sponsor/route.ts` por um insert; o resto da rota não muda.

---

## Ver quem se inscreveu

**Painel Supabase** → Table Editor → `waitlist_subscribers`.

Exportar para CSV:

```sql
select full_name, email, phone, phone_country, utm_source, created_at
from waitlist_subscribers
where status <> 'unsubscribed'
order by created_at;
```

Contagem rápida: `select waitlist_count();`

---

## Identidade visual

Tudo retirado dos ficheiros oficiais da marca.

| Cor | Hex | Onde aparece |
|---|---|---|
| Creme | `#FFF7E9` | Fundo principal, texto sobre escuro |
| Blush | `#F2CDBA` | Destaques, itálicos do display |
| Rosa | `#BA7984` | Botões, eyebrows |
| Sage | `#657365` | Faixa da missão social |
| Vinho | `#5A323A` | Secção da inscrição, títulos |
| Carvão | `#2E3A33` | Hero, rodapé, corpo de texto |

**Tipografia**

- **Recline** — a fonte da marca, convertida de OTF para WOFF2 e alojada aqui.
  Usada no display, sempre em Light (300).
- **Jost** — geométrica utilitária para labels, botões e formulário. Escolhida por
  ser a mais próxima da "Now" usada nos materiais originais do evento.

**Elemento-assinatura:** o painel de vidro da key art, reconstruído em CSS
(`.espelho` no `globals.css`) — vidro fosco com reflexo diagonal. É onde vive o
cartaz no hero e o formulário na secção de inscrição. Um espelho, num evento
chamado Além do Espelho.

---

## Estrutura

```
src/
├── app/
│   ├── api/waitlist/route.ts   Endpoint da inscrição
│   ├── api/sponsor/route.ts    Endpoint do patrocínio (sem DB — log mascarado)
│   ├── lista/                  Página de pré-inscrição (domínio canónico)
│   ├── sitemap.ts              Sitemap — / e /lista
│   ├── robots.ts               robots.txt + sitemap
│   ├── globals.css             Tokens da marca + fontes + .espelho
│   ├── layout.tsx              SEO, Open Graph, JSON-LD
│   └── page.tsx
├── components/
│   ├── Header.tsx              Fixo, encolhe ao rolar
│   ├── Hero.tsx                Cartaz oficial + contador + CTA
│   ├── Countdown.tsx           Contagem para 17/10/2026
│   ├── Experience.tsx          O que te espera + anfitriã
│   ├── Mission.tsx             Missão Angola
│   ├── Inscricao.tsx           Secção do formulário
│   ├── WaitlistForm.tsx        Formulário + ecrã de confirmação
│   ├── Footer.tsx
│   └── Reveal.tsx              Animação de entrada
└── lib/
    ├── site.ts                 Todo o conteúdo do evento (edita aqui)
    ├── validation.ts           Schemas partilhados cliente/servidor
    ├── supabase.ts
    └── rate-limit.ts
```

**Para mudar textos, datas ou países do formulário: `src/lib/site.ts`.**

---

## O que ficou por testar

A gravação real no Supabase não pôde ser testada no ambiente onde isto foi
construído (sem acesso de rede ao `supabase.co`). O tratamento de erro foi
validado — falha de rede devolve 502 com mensagem amigável.

**Primeira coisa a fazer depois do deploy:** submeter o formulário uma vez e
confirmar que a linha aparece na tabela.

---

## Próximo passo

Esta página existe para construir a lista. Quando ela estiver a crescer, a mesma
base de código serve de fundação para o site completo do evento: programação,
oradoras, patrocínios e bilheteira.
