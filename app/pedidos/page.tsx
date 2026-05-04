'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);

  useEffect(() => {
    const fetchPedidos = async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['pendiente', 'preparando'])
        .order('creado_en', { ascending: true });
      if (data) setPedidos(data);
    };

    fetchPedidos();

    // Suscripción a nuevos pedidos o cambios de estado
    const channel = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const actualizarEstado = async (id: number, nuevoEstado: string) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', id);
    
    if (error) alert('Error: ' + error.message);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-indigo-400">PEDIDOS EN COLA</h1>
          <p className="text-slate-500 font-medium">Mostrador Pescadería R. Vicente</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="grid gap-4">
        {pedidos.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-2xl italic">
            No hay pedidos pendientes. ¡A descansar! ☕
          </div>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="bg-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-center border border-slate-700 shadow-xl transition-all">
              <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black shrink-0 ${
                p.estado === 'preparando' ? 'bg-amber-500 text-black' : 'bg-indigo-600/20 text-indigo-400'
              }`}>
                #{p.id}
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                  <h2 className="text-2xl font-bold text-white">{p.nombre_cliente}</h2>
                  {p.tipo_entrega === 'domicilio' && (
                    <span className="bg-rose-500 text-white text-xs px-2 py-1 rounded-lg font-black uppercase animate-pulse">
                      ¡DOMICILIO!
                    </span>
                  )}
                </div>
                <p className="text-xl text-slate-300 leading-tight mb-2">{p.contenido}</p>
                {p.tipo_entrega === 'domicilio' && (
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                    <p className="text-sm text-slate-500 uppercase font-bold tracking-widest mb-1">Dirección de entrega:</p>
                    <p className="text-lg text-amber-400 font-bold">{p.direccion}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                {p.estado === 'pendiente' && (
                  <button 
                    onClick={() => actualizarEstado(p.id, 'preparando')}
                    className="flex-1 md:w-48 py-6 bg-amber-500 text-black font-black text-2xl rounded-2xl hover:bg-amber-400 transition-all uppercase tracking-tighter"
                  >
                    Empezar
                  </button>
                )}
                {p.estado === 'preparando' && (
                  <button 
                    onClick={() => actualizarEstado(p.id, 'listo')}
                    className="flex-1 md:w-48 py-6 bg-emerald-500 text-white font-black text-2xl rounded-2xl animate-pulse uppercase tracking-tighter"
                  >
                    ¿Listo?
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
