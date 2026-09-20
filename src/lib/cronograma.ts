/**
 * Mapa do Dia — cronograma PÚBLICO do evento (17/10/2026, INNSiDE by Meliá, Braga).
 *
 * Fonte: Mapa do Dia (versão de trabalho do PDF interno). O PDF contém material
 * de condução interna ("Função na jornada", blocos "PONTE PARA", "PERGUNTA-CHAVE",
 * "MENSAGEM FINAL SUGERIDA", "GUIA RÁPIDO" e "(a confirmar)") que NUNCA vai para
 * o site — aqui está transcrita só a grelha pública: hora · experiência · foco.
 *
 * Omissões deliberadas (transições internas, ausentes do Mapa do Dia):
 *  - 10h55–11h00 Patrocinadores
 *  - 14h25–14h30 Vídeo motivacional
 * Os nomes da Roda de Saúde ficam genéricos até confirmação da cliente.
 * Grafias = as do site (patrocinadores.ts / Realizacao.tsx):
 *  - "Naty Ribeiro" (o PDF interno escreve "Nathy")
 *  - "Conexão Women" (o PDF interno escreve "Conexão Woman")
 */

export type MomentoCronograma = {
  /** Número sequencial do dia (01–19), contínuo entre capítulos. */
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
      { n: 1, hora: "09h30–10h00", titulo: "Welcome Drinks", foco: "Chegada, música ao vivo e conexão" },
      { n: 2, hora: "10h00–10h15", titulo: "Abertura", foco: "Vídeo, propósito e verdadeira beleza" },
      { n: 3, hora: "10h15–10h55", titulo: "Luci Maritan", foco: "Mentalidade & Identidade" },
    ],
  },
  {
    pergunta: "O que eu expresso e deixo no mundo?",
    cor: "verde",
    momentos: [
      { n: 4, hora: "11h00–11h30", titulo: "Renata Parreira", foco: "“Eu sou a minha própria marca”" },
      { n: 5, hora: "11h30–11h40", titulo: "Priscila · Conexão Women", foco: "Conexão entre mulheres e propósito" },
      { n: 6, hora: "11h40–11h55", titulo: "Lígia Santos", foco: "“Beleza na Clareza”" },
      { n: 7, hora: "11h55–12h25", titulo: "Janaína Camilo", foco: "“Nasceste para ser linda e graciosa”" },
      { n: 8, hora: "12h25–12h30", titulo: "ONG Atos", foco: "Beleza que transforma" },
      { n: 9, hora: "12h30–14h00", titulo: "Almoço", foco: "Pausa e conexões" },
      { n: 10, hora: "14h00–14h15", titulo: "Patrícia Ribeiro", foco: "Momento de Leveza · dança africana" },
      { n: 11, hora: "14h15–14h25", titulo: "Tereza Moura", foco: "“Como ser produtiva sem te abandonares”" },
      { n: 12, hora: "14h30–15h20", titulo: "Roda de Saúde & Bem-estar", foco: "Conversa sobre bem-estar integral" },
      { n: 13, hora: "15h20–15h50", titulo: "Coffee Break", foco: "Networking" },
      { n: 14, hora: "15h50–16h10", titulo: "YOKONARA Space & Eva", foco: "Momento de Cultura · desfile surpresa" },
    ],
  },
  {
    pergunta: "O que permanece quando o espelho deixa de ser suficiente?",
    cor: "rosa",
    momentos: [
      { n: 15, hora: "16h10–16h40", titulo: "Naty Ribeiro", foco: "“Beleza na Espiritualidade”" },
      { n: 16, hora: "16h40–16h50", titulo: "Ana Pinho", foco: "História de Superação" },
      { n: 17, hora: "16h50–17h30", titulo: "Vitória Gomes", foco: "“A Verdadeira Beleza”" },
      { n: 18, hora: "17h30–17h45", titulo: "Agradecimentos + Vicky", foco: "Brindes e revelação da obra" },
      { n: 19, hora: "17h45–18h00", titulo: "Encerramento", foco: "Celebração e networking" },
    ],
  },
];