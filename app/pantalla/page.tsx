'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PantallaPage() {
  const [listos, setListos] = useState<any[]>([]);
  const [enPreparacion, setEnPreparacion] = useState<any[]>([]);

  useEffect(() => {
    const fetchPedidos = async () => {
      // Pedidos listos para recoger
      const { data: dataListos } = await supabase
        .from('pedidos')
        .select('id')
        .eq('estado', 'listo')
        .order('creado_en', { ascending: false })
        .limit(6);
      
      // Pedidos en preparación
      const { data: dataPrep } = await supabase
        .from('pedidos')
        .select('id')
        .eq('estado', 'preparando')
        .order('creado_en', { ascending: true })
        .limit(5);

      if (dataListos) setListos(dataListos.map(p => p.id));
      if (dataPrep) setEnPreparacion(dataPrep.map(p => p.id));
    };

    fetchPedidos();

    // Sincronización en tiempo real
    const channel = supabase
      .channel('pantalla-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6">
        {/* Zona Pedidos LISTOS */}
        <section className="flex-1 bg-emerald-600 rounded-[3rem] p-10 flex flex-col items-center justify-center shadow-2xl border-8 border-emerald-400">
          <h2 className="text-5xl font-black mb-12 uppercase tracking-widest text-emerald-950">¡PASA A POR ÉL!</h2>
          <div className="flex flex-wrap justify-center gap-10">
            {listos.length === 0 ? (
              <p className="text-4xl font-bold text-emerald-900 opacity-50">Esperando pedidos...</p>
            ) : (
              listos.map((num) => (
                <div key={num} className="bg-white text-black text-[12rem] md:text-[18rem] leading-none font-black px-12 py-8 rounded-[4rem] shadow-2xl animate-bounce">
                  {num}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Zona Informativa Lateral */}
        <aside className="md:w-1/3 bg-slate-900 rounded-[3rem] p-10 flex flex-col justify-between border border-slate-800">
          <div>
            <h3 className="text-3xl font-bold text-slate-500 mb-6 uppercase tracking-widest">En preparación...</h3>
            <div className="space-y-4">
              {enPreparacion.map(num => (
                <div key={num} className="text-6xl font-black text-slate-400 opacity-60">#{num}</div>
              ))}
            </div>
          </div>
          
          <div className="text-center pt-8 border-t border-slate-800">
            <p className="text-2xl font-bold text-indigo-400 animate-pulse uppercase tracking-tighter">
              Pide por móvil en: <br/> ca-46.vercel.app/pedir
            </p>
          </div>
        </aside>
      </main>

      <footer className="bg-slate-900 p-6 flex justify-between items-center px-16 border-t border-slate-800 text-slate-500">
        <div className="text-4xl font-mono font-bold">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-2xl font-bold uppercase tracking-widest">Pescadería R. Vicente</div>
      </footer>
    </div>
  );
}
