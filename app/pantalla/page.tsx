'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PantallaPage() {
  const [listos, setListos] = useState<number[]>([]);
  const [enPreparacion, setEnPreparacion] = useState<number[]>([]);
  const [sonidoHabilitado, setSonidoHabilitado] = useState(false);

  // Cargamos el sonido (Campana tipo tienda)
  const reproducirSonido = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1010/1010-preview.mp3');
    audio.play().catch(err => console.log('Esperando interacción para sonido...', err));
  };

  useEffect(() => {
    const fetchPedidos = async () => {
      const { data: dataListos } = await supabase
        .from('pedidos')
        .select('id')
        .eq('estado', 'listo')
        .order('creado_en', { ascending: false })
        .limit(6)
        .returns<Array<{ id: number }>>();

      const { data: dataPreparacion } = await supabase
        .from('pedidos')
        .select('id')
        .eq('estado', 'preparando')
        .order('creado_en', { ascending: true })
        .limit(5)
        .returns<Array<{ id: number }>>();

      if (dataListos) setListos(dataListos.map((pedido) => pedido.id));
      if (dataPreparacion) setEnPreparacion(dataPreparacion.map((pedido) => pedido.id));
    };

    fetchPedidos();

    const channel = supabase
      .channel('pantalla-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          reproducirSonido();
        }
        fetchPedidos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-black font-sans text-white">
      <header className="relative overflow-hidden bg-indigo-700 p-8 text-center shadow-2xl">
        <div className="relative z-10">
          <h1 className="text-6xl font-black uppercase italic tracking-tighter md:text-8xl">
            Recogida de pedidos
          </h1>
          <p className="mt-2 text-2xl font-bold text-indigo-200 opacity-80 md:text-3xl">
            Pescaderia R. Vicente - Frescura diaria
          </p>
          {!sonidoHabilitado && (
            <button 
              onClick={() => {
                setSonidoHabilitado(true);
                reproducirSonido();
              }}
              className="mt-4 rounded-full bg-white/20 px-4 py-2 text-sm font-bold backdrop-blur-sm hover:bg-white/30"
            >
              🔔 Haz clic aquí para activar sonido
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6 md:flex-row">
        <section className="flex flex-1 flex-col items-center justify-center rounded-[3rem] border-8 border-emerald-400 bg-emerald-600 p-10 shadow-2xl">
          <h2 className="mb-12 text-5xl font-black uppercase tracking-widest text-emerald-950">
            Pasa a por el!
          </h2>
          <div className="flex flex-wrap justify-center gap-10">
            {listos.length === 0 ? (
              <p className="text-4xl font-bold text-emerald-900 opacity-50">Esperando pedidos...</p>
            ) : (
              listos.map((numero) => (
                <div
                  key={numero}
                  className="rounded-[4rem] bg-white px-12 py-8 text-[12rem] font-black leading-none text-black shadow-2xl md:text-[18rem]"
                >
                  {numero}
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="flex flex-col justify-between rounded-[3rem] border border-slate-800 bg-slate-900 p-10 md:w-1/3">
          <div>
            <h3 className="mb-6 text-3xl font-bold uppercase tracking-widest text-slate-500">
              En preparacion...
            </h3>
            <div className="space-y-4">
              {enPreparacion.map((numero) => (
                <div key={numero} className="text-6xl font-black text-slate-400 opacity-60">
                  #{numero}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center">
            <p className="text-2xl font-bold uppercase tracking-tighter text-indigo-400">
              Pide por movil en:
              <br />
              ca-46.vercel.app/pedir
            </p>
          </div>
        </aside>
      </main>

      <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-16 p-6 text-slate-500">
        <div className="text-4xl font-bold">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-2xl font-bold uppercase tracking-widest">Pescaderia R. Vicente</div>
      </footer>
    </div>
  );
}
