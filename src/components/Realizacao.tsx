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
};

/**
 * Entidades que fazem o evento acontecer.
 * Cada bloco segue a hierarquia: título acima da logo, logo transparente ao centro,
 * nome + descrição abaixo. A logo é o único elemento clicável e não tem caixa/fundo —
 * o fundo da página aparece através dela.
 */
const entidades: Entidade[] = [
  {
    rotulo: "Realização",
    nome: "Essence of Beauty",
    descricao:
      "Promotora do evento — um espaço dedicado à beleza e à transformação.",
    asset: "/brand/assets-realizacao/essence.webp",
    width: 560,
    height: 560,
    href: "https://www.instagram.com/essenceofbeauty.salon/",
    ariaLabel: "Essence of Beauty no Instagram (abre em nova janela)",
  },
  {
    rotulo: "Organização",
    nome: "Conexão Women",
    descricao: "Comunidade que liga mulheres em propósito, crescimento e conexão.",
    asset: "/brand/assets-realizacao/conexao.webp",
    width: 490,
    height: 490,
    href: "https://www.instagram.com/conexaoexperience.oficial/",
    ariaLabel: "Conexão Women no Instagram (abre em nova janela)",
  },
  {
    rotulo: "Apoio",
    nome: "Organização Atos",
    descricao: "Parceira de apoio à missão social da 2ª edição.",
    asset: "/brand/assets-realizacao/atos.webp",
    width: 560,
    height: 558,
    href: "https://organizacaoatos.org/sobre-organizacao-atos/",
    ariaLabel: "Organização Atos (abre em nova janela)",
  },
];

export default function Realizacao() {
  return (
    <section className="grao relative overflow-hidden bg-creme-profundo py-24 sm:py-32">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-start gap-16 lg:grid-cols-[1.1fr_1fr]">
          {/* ── Coluna esquerda: ilustração + blocos de parceiros ── */}
          <div>
            <Reveal>
              <figure className="overflow-hidden rounded-sm bg-creme p-3 ring-1 ring-vinho/12">
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

            {/* ── Nossa Missão: transformar vidas em dois continentes ── */}
            <Reveal delay={0.08}>
              <div className="mt-[clamp(48px,7vw,96px)]">
                <span className="eyebrow text-rosa">Nossa Missão</span>
                <p className="display mt-[clamp(14px,2vw,20px)] text-[clamp(1.5rem,3vw,1.875rem)] uppercase leading-[1.08] text-vinho">
                  Transformar vidas em dois continentes.
                </p>

                <div className="mt-[clamp(28px,4vw,48px)] grid gap-[clamp(24px,3.5vw,44px)] sm:grid-cols-2">
                  <div>
                    <h3 className="eyebrow text-rosa">Em Portugal</h3>
                    <p className="mt-[clamp(12px,1.5vw,16px)] text-[0.9375rem] leading-relaxed text-carvao/65">
                      Desenvolver, conectar e capacitar mais de 100 mulheres na cidade de Braga através de
                      conhecimento, empreendedorismo, autoestima e oportunidades de crescimento.
                    </p>
                  </div>
                  <div>
                    <h3 className="eyebrow text-rosa">Em Angola</h3>
                    <p className="mt-[clamp(12px,1.5vw,16px)] text-[0.9375rem] leading-relaxed text-carvao/65">
                      Arrecadar e enviar produtos de higiene feminina para mulheres em situação de
                      vulnerabilidade, promovendo dignidade, cuidado e esperança.
                    </p>
                  </div>
                </div>

                {/* Chamada para patrocinadores */}
                <div className="mt-[clamp(36px,5vw,64px)] border-t border-vinho/10 pt-[clamp(24px,4vw,40px)]">
                  <h3 className="display text-[clamp(1.375rem,2.5vw,1.75rem)] leading-tight text-vinho">
                    Junte-se à nossa missão.
                  </h3>
                  <p className="mt-[clamp(12px,1.5vw,16px)] max-w-[40ch] text-[0.9375rem] leading-relaxed text-carvao/65">
                    Ao tornar-se patrocinador desta iniciativa, a sua marca passa a fazer parte de um
                    projeto que transforma vidas, gera impacto social e fortalece comunidades em Portugal
                    e Angola. Cada parceria ajuda-nos a alcançar ainda mais mulheres.
                  </p>
                  <a
                    href="#contactos"
                    className="group mt-[clamp(20px,3vw,28px)] inline-flex items-center gap-3 rounded-full bg-vinho px-8 py-3.5 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-vinho/90 hover:shadow-[0_14px_44px_-16px_rgba(92,50,62,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vinho/40"
                  >
                    Quero ser Patrocinador
                    <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Blocos: título acima → logo transparente → nome + descrição */}
            <Reveal delay={0.15}>
              <ul className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
                {entidades.map((entidade) => (
                  <li key={entidade.nome} className="flex flex-col items-center text-center">
                    <h3 className="eyebrow text-rosa">{entidade.rotulo}</h3>

                    <a
                      href={entidade.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={entidade.ariaLabel}
                      className="group mt-6 flex h-20 w-full items-center justify-center transition-transform duration-300 hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vinho/40"
                    >
                      <Image
                        src={entidade.asset}
                        alt={entidade.nome}
                        width={entidade.width}
                        height={entidade.height}
                        className="h-full w-auto object-contain"
                      />
                    </a>

                    <p className="display mt-6 text-[1.0625rem] leading-tight text-vinho">
                      {entidade.nome}
                    </p>
                    <p className="mt-2 max-w-[15rem] text-[0.875rem] leading-relaxed text-carvao/65">
                      {entidade.descricao}
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* ── Coluna direita: declaração ── */}
          <div>
            <Reveal>
              <span className="eyebrow text-rosa">Quem faz acontecer</span>
              <p className="display mt-6 text-[2rem] uppercase leading-[1.1] text-vinho sm:text-[2.5rem]">
                Quando uma mulher se transforma,
                <br />
                ela transforma o mundo ao seu redor.
              </p>
            </Reveal>
          </div>
        </div>

        {/* ── Fecho centrado da secção inteira ── */}
        <Reveal delay={0.22}>
          <div className="mt-20 text-center sm:mt-24">
            <p className="display mx-auto max-w-2xl text-[1.5rem] leading-[1.3] text-vinho sm:text-[1.75rem]">
              Junte-se a nós nesta missão de desenvolvimento, conexão e solidariedade.
            </p>
            <span className="fio mx-auto mt-8 block w-16 text-vinho" aria-hidden />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
