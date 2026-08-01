import Image from "next/image";
import { ChevronRight } from "lucide-react";
import Reveal from "./Reveal";

type Entidade = {
  rotulo: string;
  nome: string;
  descricao: string;
  asset: string;
  width: number;
  height: number;
  href: string;
  ariaLabel: string;
  /** Só a Conexão: a coroa dourada perde legibilidade no claro — leva medalhão escuro. */
  medalhao: boolean;
};

/**
 * Entidades que fazem o evento acontecer. Sobre o creme, a Essence (clara) e o
 * Atos (a cores) assentam diretos; a Conexão (coroa dourada) ganha um medalhão
 * de carvão por trás — o dourado só lê sobre escuro.
 */
const entidades: Entidade[] = [
  {
    rotulo: "Realização",
    nome: "Essence of Beauty",
    descricao: "Marca de beleza e bem-estar fundada por Vitória Gomes.",
    asset: "/brand/essence-light.webp",
    width: 560,
    height: 560,
    href: "https://www.instagram.com/essenceofbeauty.salon/",
    ariaLabel: "Essence of Beauty (abre em nova janela)",
    medalhao: false,
  },
  {
    rotulo: "Organização",
    nome: "Conexão Women",
    descricao: "Rede de mulheres — conectadas, inspiradas, imparáveis.",
    asset: "/brand/conexao.webp",
    width: 490,
    height: 490,
    href: "https://www.instagram.com/conexaoexperience.oficial/",
    ariaLabel: "Conexão Women (abre em nova janela)",
    medalhao: true,
  },
  {
    rotulo: "Apoio",
    nome: "Organização Atos",
    descricao: "ONG com projetos socioeducativos em Angola há mais de uma década.",
    asset: "/brand/atos.webp",
    width: 560,
    height: 558,
    href: "https://organizacaoatos.org/sobre-organizacao-atos/",
    ariaLabel: "Organização Atos (abre em nova janela)",
    medalhao: false,
  },
];

export default function Realizacao() {
  return (
    <section className="grao relative overflow-hidden bg-creme py-24 sm:py-32">
      {/* fio de abertura em sage — destaca a secção das vizinhas sem mudar de tom */}
      <span className="fio text-sage block w-full" aria-hidden />

      {/* halos suaves da paleta */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 top-10 h-[30rem] w-[30rem] rounded-full bg-sage/12 blur-[130px]" />
        <div className="absolute -left-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-blush/35 blur-[120px]" />
      </div>

      {/* marca de água — moldura ornamental em sage, sangra pela direita */}
      <Image
        src="/brand/logo-verde.webp"
        alt=""
        aria-hidden
        width={680}
        height={548}
        priority={false}
        className="pointer-events-none absolute -right-16 top-1/2 -z-10 w-[46rem] -translate-y-1/2 opacity-[0.10] select-none"
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* ── Zona A: ilustração + missão │ declaração + bandeira ── */}
        <div className="grid items-start gap-16 lg:grid-cols-2">
          {/* Coluna esquerda — ilustração + missão */}
          <div>
            <Reveal>
              <figure className="overflow-hidden rounded-sm bg-white/70 p-3 ring-1 ring-vinho/12">
                <Image
                  src="/brand/assets-realizacao/mulheres.webp"
                  alt="Ilustração de mulheres diversas de perfil, em tons suaves de rosa e terre"
                  width={1122}
                  height={595}
                  sizes="(max-width: 1024px) 90vw, 50vw"
                  className="h-auto w-full object-contain"
                />
              </figure>
            </Reveal>

            {/* Nossa Missão */}
            <Reveal delay={0.08}>
              <div className="mt-[clamp(48px,7vw,96px)]">
                <span className="eyebrow text-rosa">Nossa Missão</span>
                <p className="display mt-[clamp(14px,2vw,20px)] text-[clamp(1.5rem,3vw,1.875rem)] leading-[1.08] text-vinho">
                  Transformar vidas em dois continentes.
                </p>

                <div className="mt-[clamp(28px,4vw,48px)] grid gap-[clamp(24px,3.5vw,44px)] sm:grid-cols-2">
                  <div>
                    <h3 className="eyebrow text-rosa">Em Portugal</h3>
                    <p className="mt-[clamp(12px,1.5vw,16px)] text-[0.9375rem] leading-relaxed text-carvao/70">
                      Desenvolver, conectar e capacitar mais de 100 mulheres na cidade de Braga através de
                      conhecimento, empreendedorismo, autoestima e oportunidades de crescimento.
                    </p>
                  </div>
                  <div>
                    <h3 className="eyebrow text-rosa">Em Angola</h3>
                    <p className="mt-[clamp(12px,1.5vw,16px)] text-[0.9375rem] leading-relaxed text-carvao/70">
                      Arrecadar e enviar produtos de higiene feminina para mulheres em situação de
                      vulnerabilidade, promovendo dignidade, cuidado e esperança.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Coluna direita — declaração + bandeira */}
          <div>
            <Reveal>
              <span className="eyebrow text-rosa">Quem faz acontecer</span>
              <p className="display mt-6 text-[2rem] uppercase leading-[1.1] text-vinho sm:text-[2.5rem]">
                Quando uma mulher se transforma,
                <br />
                ela transforma o mundo ao seu redor.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <figure className="mt-10 max-w-[34rem]">
                <div className="rounded-[3px] bg-white/70 p-3 ring-1 ring-vinho/12 shadow-[0_24px_60px_-40px_rgba(46,58,51,0.35)]">
                  <Image
                    src="/brand/bandeira.webp"
                    alt="Bandeiras de Portugal e de Angola"
                    width={647}
                    height={442}
                    sizes="(max-width: 1024px) 100vw, 34rem"
                    className="h-auto w-full rounded-[2px]"
                  />
                </div>
              </figure>
            </Reveal>
          </div>
        </div>

        {/* ── Chamada para patrocinadores — largura total, centrada ── */}
        <Reveal delay={0.08}>
          <div className="mx-auto mt-20 max-w-2xl text-center">
            <h3 className="display text-[2rem] text-vinho">Junte-se à nossa missão.</h3>
            <p className="mt-5 leading-relaxed text-carvao/70">
              Ao tornar-se patrocinador desta iniciativa, a sua marca passa a fazer parte de um
              projeto que transforma vidas, gera impacto social e fortalece comunidades em Portugal
              e Angola. Cada parceria ajuda-nos a alcançar ainda mais mulheres.
            </p>
            <a
              href="#contactos"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-vinho px-8 py-4 text-sm font-medium text-creme transition-colors duration-300 hover:bg-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
            >
              Quero ser Patrocinador
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>

        {/* ── Zona B: faixa das entidades, largura total, separada por um fio ── */}
        <div className="mt-[clamp(56px,8vw,104px)] border-t border-vinho/10 pt-[clamp(40px,5vw,64px)]">
          <Reveal>
            <ul className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
              {entidades.map((entidade) => (
                <li key={entidade.nome} className="flex flex-col items-center text-center">
                  <span className="eyebrow text-rosa">{entidade.rotulo}</span>

                  <a
                    href={entidade.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={entidade.ariaLabel}
                    className="mt-4 flex items-center justify-center transition-opacity duration-300 hover:opacity-75 focus-visible:opacity-75"
                  >
                    {entidade.medalhao ? (
                      <span className="flex h-32 w-32 items-center justify-center rounded-full bg-carvao p-6">
                        <Image
                          src={entidade.asset}
                          alt={entidade.nome}
                          width={entidade.width}
                          height={entidade.height}
                          quality={95}
                          className="h-full w-auto object-contain"
                        />
                      </span>
                    ) : (
                      <Image
                        src={entidade.asset}
                        alt={entidade.nome}
                        width={entidade.width}
                        height={entidade.height}
                        quality={95}
                        className="h-32 w-auto object-contain"
                      />
                    )}
                  </a>

                  <span className="mt-4 font-medium text-vinho">{entidade.nome}</span>
                  <span className="mt-1 max-w-[22ch] text-sm leading-relaxed text-carvao/70">
                    {entidade.descricao}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Fecho */}
          <Reveal delay={0.12}>
            <div className="mt-20 text-center sm:mt-24">
              <p className="display mx-auto max-w-2xl text-[1.5rem] leading-[1.3] text-vinho sm:text-[1.75rem]">
                Junte-se a nós nesta missão de desenvolvimento, conexão e solidariedade.
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* fio de fecho em sage */}
      <span className="fio text-sage block w-full" aria-hidden />
    </section>
  );
}
