'use client';

export default function PedidosPage() {
  const dummyPedidos = [
    { id: 101, nombre: 'Carmen', pedido: '2kg de Merluza, limpia y en rodajas', estado: 'pendiente' },
    { id: 102, nombre: 'Jose Luis', pedido: '1kg de Boquerones', estado: 'preparando' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-indigo-400">PEDIDOS EN COLA</h1>
          <p className="text-slate-500 font-medium">Mostrador Pescadería R. Vicente</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold">17:29</div>
          <div className="text-xs text-slate-500 uppercase tracking-widest">Lunes, 4 de Mayo</div>
        </div>
      </header>

      <main className="grid gap-4">
        {dummyPedidos.map((p) => (
          <div key={p.id} className="bg-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-center border border-slate-700 shadow-xl">
            <div className="bg-indigo-600/20 text-indigo-400 w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black shrink-0">
              #{p.id}
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-1 text-white">{p.nombre}</h2>
              <p className="text-xl text-slate-300 leading-tight">{p.pedido}</p>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              {p.estado === 'pendiente' && (
                <button className="flex-1 md:w-48 py-6 bg-amber-500 text-black font-black text-2xl rounded-2xl hover:bg-amber-400 transition-all uppercase tracking-tighter">
                  Empezar
                </button>
              )}
              {p.estado === 'preparando' && (
                <button className="flex-1 md:w-48 py-6 bg-emerald-500 text-white font-black text-2xl rounded-2xl animate-pulse uppercase tracking-tighter">
                  ¿Listo?
                </button>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
