'use client';

export default function PantallaPage() {
  const listos = [105, 104, 103];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans overflow-hidden">
      {/* Header Gigante */}
      <header className="bg-indigo-700 p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic">
            Recogida de Pedidos
          </h1>
          <p className="text-2xl md:text-3xl font-bold opacity-80 mt-2 text-indigo-200">
            Pescadería R. Vicente - Frescura diaria
          </p>
        </div>
        {/* Efecto decorativo oceánico */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-gradient-to-br from-indigo-400 to-transparent rotate-12 animate-pulse"></div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6">
        {/* Zona Pedidos LISTOS */}
        <section className="flex-1 bg-emerald-600 rounded-[3rem] p-10 flex flex-col items-center justify-center shadow-2xl border-8 border-emerald-400">
          <h2 className="text-5xl font-black mb-12 uppercase tracking-widest text-emerald-950">¡PASA A POR ÉL!</h2>
          <div className="flex flex-wrap justify-center gap-10">
            {listos.map((num) => (
              <div key={num} className="bg-white text-black text-[12rem] md:text-[18rem] leading-none font-black px-12 py-8 rounded-[4rem] shadow-2xl animate-bounce">
                {num}
              </div>
            ))}
          </div>
        </section>

        {/* Zona Informativa Lateral */}
        <aside className="md:w-1/3 bg-slate-900 rounded-[3rem] p-10 flex flex-col justify-between border border-slate-800">
          <div>
            <h3 className="text-3xl font-bold text-slate-500 mb-6 uppercase tracking-widest">En preparación...</h3>
            <div className="space-y-4">
              <div className="text-6xl font-black text-slate-400 opacity-50">#106</div>
              <div className="text-6xl font-black text-slate-400 opacity-30">#107</div>
            </div>
          </div>
          
          <div className="text-center pt-8 border-t border-slate-800">
            <p className="text-2xl font-bold text-indigo-400 animate-pulse">
              Escanea el QR del mostrador para pedir
            </p>
          </div>
        </aside>
      </main>

      {/* Footer / Reloj */}
      <footer className="bg-slate-900 p-6 flex justify-between items-center px-16 border-t border-slate-800">
        <div className="text-4xl font-mono font-bold text-slate-500">17:30</div>
        <div className="text-2xl font-bold text-slate-400">Pescadería R. Vicente</div>
      </footer>
    </div>
  );
}
