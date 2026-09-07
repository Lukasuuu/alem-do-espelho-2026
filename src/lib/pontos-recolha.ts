/**
 * Pontos de recolha do kit de solidariedade — fonte única, partilhada entre a
 * ModalPontosRecolha e o ParabensModal (Bloco D). Extraído de
 * ModalPontosRecolha.tsx para os dois ecrãs lerem os MESMOS dados (era disto
 * que nasceram moradas divergentes da última vez).
 *
 * Logotipos em /public/causa/ (pasta partilhada com a página principal).
 * NÃO mover para public/alem-do-espelho-2026/ sem atualizar estes caminhos.
 */

export type PontoRecolha = {
  nome: string;
  morada: string;
  logo: string;
};

export const pontosRecolha: readonly PontoRecolha[] = [
  {
    nome: "Box RM",
    morada: "Rua da Quinta do Feital 44, 4700-154 Braga",
    logo: "/causa/ponto-boxrm.webp",
  },
  {
    nome: "100 Culpa",
    morada: "Rua da Alegria 145, 4000-042 Porto",
    logo: "/causa/ponto-100culpa.webp",
  },
  {
    nome: "New Flower Studio",
    morada: "R. Cândido de Oliveira 119, 4715-213 Braga",
    logo: "/causa/ponto-newflower.webp",
  },
  {
    nome: "Yeshua Care Center",
    morada: "R. Cruz de Pedra 94 Lj.47, 4700-213 Braga",
    logo: "/causa/ponto-yeshua.webp",
  },
  {
    nome: "Cadidja Araujo",
    morada: "R. Dom António Bento Martins Júnior 31, 4710-422 Braga",
    logo: "/causa/ponto-cadidja.webp",
  },
] as const;

/** Link de pesquisa Google Maps para uma morada (api=1, URL oficial). */
export function googleMapsUrl(morada: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(morada)}`;
}