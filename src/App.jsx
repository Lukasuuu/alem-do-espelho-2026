function App() {
  return (
    <React.Fragment>
      <Navbar />
      <main>
        <Hero />
        <CountdownStrip />
        <Projeto />
        <Anfitria />
        <Continentes />
        <Experiencia />
        <Angola />
        <Patrocinios />
        <Metas />
        <Inscricao />
      </main>
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
