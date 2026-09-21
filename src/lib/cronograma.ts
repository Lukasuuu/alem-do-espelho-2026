/**
 * Mapa do Dia — cronograma PÚBLICO do evento (17/10/2026, INNSiDE by Meliá, Braga).
 *
 * Fonte: Mapa do Dia (versão de trabalho do PDF interno). O PDF contém material
 * de condução interna ("Função na jornada", blocos "PONTE PARA", "PERGUNTA-CHAVE",
 * "MENSAGEM FINAL SUGERIDA", "GUIA RÁPIDO" e "(a confirmar)") que NUNCA vai para
 * o site — aqui está transcrita só a grelha pública: hora · experiência · foco.
 *
 * r5 (set 2026, pedido da Vitória — validado pelo Lucas):
 *  - Funde Welcome Drinks + Abertura (09h30–10h15) e Agradecimentos +
 *    Encerramento (17h00–18h00, com a revelação da obra com a Vicky).
 *  - Remove a entrada da ONG parceira do Mapa do Dia (o Almoço passa a
 *    12h25–14h00; a parceria continua na secção da Causa Social) e o momento
 *    de dança do Momento de Leveza (mantém-se a Patrícia Ribeiro).
 *  - Reescreve os focos: Priscila ("O que é a Conexão Woman?"), Tereza Moura
 *    ("O Projeto mais importante de uma Empreendedora"), Coffee Break
 *    (Momento de Network) e YOKONARA Space (Momento de Cultura — sem a
 *    convidada anterior e sem o momento surpresa).
 *  - Vitória Gomes passa a terminar às 17h00 (19 → 16 momentos).
 *  - Grafias validadas pela cliente: "Nathy Ribeiro" e "Conexão Woman" — o
 *    resto do site (patrocinadores.ts / Realizacao.tsx) continua "Naty" /
 *    "Conexão Women" até novo despacho.
 *
 * Omissões deliberadas (transições internas, ausentes do Mapa do Dia):
 *  - 10h55–11h00 Patrocinadores
 *  - 14h25–14h30 Vídeo motivacional
 */

export type MomentoCronograma = {
  /** Número sequencial do dia (01–16), contínuo entre capítulos. O MapaDia
   *  renderiza este campo (String(n).padStart) e usa-o como key — a
   *  renumeração vive AQUI, um valor por registo, na ordem do array. */
  n: number;
  /** Hora no formato "09h30–10h00". */
  hora: string;
  /** Experiência (nome do momento/palestrante). */
  titulo: string;
  /** Foco do momento, em palavras para o público. */
  foco: string;
};

export type CapituloCronograma = {
  /** Pergunta do fio condutor (liga ao banner dos 3 pilares). */
  pergunta: string;
  /** Cor do cabeçalho do capítulo — token da marca: rosa (pilares 1 e 3) ou verde (pilar 2). */
  cor: "rosa" | "verde";
  momentos: MomentoCronograma[];
};

export const capitulos: CapituloCronograma[] = [
  {
    pergunta: "Como eu me vejo?",
    cor: "rosa",
    momentos: [
      { n: 1, hora: "09h30–10h15", titulo: "Welcome Drinks e Abertura", foco: "Chegada, música ao vivo, vídeo e propósito" },
      { n: 2, hora: "10h15–10h55", titulo: "Luci Maritan", foco: "Mentalidade & Identidade" },
    ],
  },
  {
    pergunta: "O que eu expresso e deixo no mundo?",
    cor: "verde",
    momentos: [
      { n: 3, hora: "11h00–11h30", titulo: "Renata Parreira", foco: "Eu sou a minha própria marca" },
      { n: 4, hora: "11h30–11h40", titulo: "Pricila de Jesus", foco: "O que é a Conexão Woman?" },
      { n: 5, hora: "11h40–11h55", titulo: "Lígia Santos", foco: "O espelho que ninguém te ensinou a olhar!" },
      { n: 6, hora: "11h55–12h25", titulo: "Janaína Camilo", foco: "Você nasceu para ser linda e graciosa" },
      { n: 7, hora: "12h25–14h00", titulo: "Almoço", foco: "Pausa e conexões" },
      { n: 8, hora: "14h00–14h15", titulo: "Patrícia Ribeiro", foco: "Momento de Leveza" },
      { n: 9, hora: "14h15–14h25", titulo: "Tereza Moura", foco: "O Projeto mais importante de uma Empreendedora" },
      { n: 10, hora: "14h30–15h20", titulo: "Roda de Saúde & Bem-estar", foco: "Condução: Érika" },
      { n: 11, hora: "15h20–15h50", titulo: "Coffee Break", foco: "Momento de Network" },
      { n: 12, hora: "15h50–16h10", titulo: "YOKONARA Space", foco: "Momento de Cultura" },
    ],
  },
  {
    pergunta: "O que permanece quando o espelho deixa de ser suficiente?",
    cor: "rosa",
    momentos: [
      { n: 13, hora: "16h10–16h40", titulo: "Nathy Ribeiro", foco: "Beleza na Espiritualidade" },
      { n: 14, hora: "16h40–16h50", titulo: "Ana Pinho Bastos", foco: "Quando a dor nos obriga a olhar para o espelho" },
      { n: 15, hora: "16h50–17h00", titulo: "Vitória Gomes", foco: "A Verdadeira Beleza" },
      { n: 16, hora: "17h00–18h00", titulo: "Agradecimentos e Encerramento", foco: "Brindes, revelação da obra com a Vicky e celebração final" },
    ],
  },
];