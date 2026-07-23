const { useState, useEffect } = React;

function Inscricao() {
  const [form, setForm] = useState({ nome: '', email: '', telemovel: '', interesse: '', mensagem: '' });
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    // Os links de patrocínio usam #inscricao?plano=..., por isso lemos o fragmento.
    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const plano = params.get('plano');
    if (plano && ['bronze', 'prata', 'ouro'].includes(plano)) {
      setForm((f) => ({ ...f, interesse: `Patrocinar (${plano.charAt(0).toUpperCase() + plano.slice(1)})` }));
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErro('');
  };

  const validar = () => {
    if (!form.nome.trim()) return 'Indique o seu nome.';
    if (!form.email.trim()) return 'Indique um e-mail para lhe podermos responder.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return 'O e-mail introduzido não parece válido.';
    if (!form.interesse) return 'Escolha o que pretende fazer.';
    return '';
  };

  const submit = (e) => {
    e.preventDefault();
    const msg = validar();
    if (msg) {
      setErro(msg);
      return;
    }
    const subject = `Inscrição Além do Espelho 2026 — ${form.interesse}`;
    const body = `Nome: ${form.nome}%0D%0AEmail: ${form.email}%0D%0ATelemóvel: ${form.telemovel || '—'}%0D%0AInteresse: ${form.interesse}%0D%0AMensagem: ${form.mensagem || '—'}`;
    window.location.href = `mailto:Essenceofbeauty.pt@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
    setEnviado(true);
  };

  return (
    <section id="inscricao" className="relative bg-papel text-floresta pt-28 pb-16 px-6 md:px-16 lg:px-20">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-display font-light uppercase text-5xl md:text-7xl tracking-[0.05em] text-center max-w-4xl mx-auto leading-[0.95]">
          Quando uma mulher se transforma, ela transforma o mundo ao seu redor
        </h2>
        <p className="mt-8 text-center text-base font-body font-light text-floresta/75 max-w-xl mx-auto">
          Junte-se a nós nesta missão de desenvolvimento, conexão e solidariedade.
        </p>

        <div className="mt-14 max-w-2xl mx-auto liquid-glass-dark rounded-[1.5rem] p-8 md:p-10">
          {enviado ? (
            <div className="text-center py-8">
              <p className="font-display uppercase text-2xl tracking-[0.06em] text-floresta">Inscrição enviada.</p>
              <p className="mt-3 text-sm font-body font-light text-floresta/70">Respondemos em 48 horas.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-floresta/55 mb-1">Nome *</label>
                <input
                  type="text"
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  required
                  className="w-full bg-transparent border-b border-floresta/20 py-3 font-body font-light text-floresta focus:border-marsala outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-floresta/55 mb-1">E-mail *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-transparent border-b border-floresta/20 py-3 font-body font-light text-floresta focus:border-marsala outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-floresta/55 mb-1">Telemóvel</label>
                <input
                  type="tel"
                  name="telemovel"
                  value={form.telemovel}
                  onChange={handleChange}
                  className="w-full bg-transparent border-b border-floresta/20 py-3 font-body font-light text-floresta focus:border-marsala outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-floresta/55 mb-1">Quero *</label>
                <select
                  name="interesse"
                  value={form.interesse}
                  onChange={handleChange}
                  required
                  className="w-full bg-transparent border-b border-floresta/20 py-3 font-body font-light text-floresta focus:border-marsala outline-none transition-colors"
                >
                  <option value="">Selecione…</option>
                  <option>Participar no evento</option>
                  <option>Patrocinar (Bronze)</option>
                  <option>Patrocinar (Prata)</option>
                  <option>Patrocinar (Ouro)</option>
                  <option>Doar produtos para Angola</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-floresta/55 mb-1">Mensagem</label>
                <textarea
                  name="mensagem"
                  value={form.mensagem}
                  onChange={handleChange}
                  rows="3"
                  className="w-full bg-transparent border-b border-floresta/20 py-3 font-body font-light text-floresta focus:border-marsala outline-none transition-colors resize-none"
                />
              </div>

              {erro && (
                <p className="text-sm font-body font-light text-marsala">{erro}</p>
              )}

              <button
                type="submit"
                className="mt-8 w-full rounded-full bg-marsala text-papel py-4 text-sm font-body font-medium hover:bg-floresta transition-colors focus-visible"
              >
                Enviar inscrição
              </button>
            </form>
          )}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm font-body">
          <a href="mailto:Essenceofbeauty.pt@gmail.com" className="hover:text-marsala transition-colors focus-visible">Essenceofbeauty.pt@gmail.com</a>
          <a href="tel:+351928400069" className="hover:text-marsala transition-colors focus-visible">+351 928 400 069</a>
          <span className="text-floresta/60">INNSiDE by Meliá Braga Centro · Braga, Portugal</span>
        </div>

        <footer className="mt-20 pt-10 border-t border-floresta/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start">
              <img
                src="public/assets/logo/eb-marca-marsala.png"
                alt="Essence of Beauty"
                width="1180"
                height="453"
                loading="lazy"
                className="h-16 w-auto object-contain"
              />
              <span className="mt-2 text-[11px] uppercase tracking-[0.2em] text-floresta/55">Realização</span>
            </div>

            <div className="text-center">
              <span className="text-[11px] uppercase tracking-[0.2em] text-floresta/55">Organização · Conexão Women</span>
            </div>

            <div className="flex flex-col items-center md:items-end">
              <img
                src="public/assets/ongpatrocinio.png"
                alt="ONG Atos"
                width="860"
                height="857"
                loading="lazy"
                className="h-14 w-auto object-contain"
              />
              <span className="mt-2 text-[11px] uppercase tracking-[0.2em] text-floresta/55">Parceira social</span>
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] text-floresta/45 font-body">
            © 2026 Essence of Beauty · Além do Espelho 2026 — Além de Mim!
          </p>
        </footer>
      </div>
    </section>
  );
}

window.Inscricao = Inscricao;
