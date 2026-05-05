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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="bg-slate-900 p-6 flex justify-between items-center border-b border-slate-800 shadow-xl">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-indigo-400 uppercase italic">Gestión de Pedidos</h1>
          <p className="text-slate-500 font-bold">Pescadería R. Vicente - Panel Realtime</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono font-black text-white leading-none">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* COLUMNA DOMICILIO (PRIORIDAD) */}
        <section className="flex-1 border-r border-slate-800 flex flex-col bg-slate-900/30">
          <div className="p-6 bg-rose-600/10 border-b border-rose-500/30 flex justify-between items-center">
            <h2 className="text-2xl font-black text-rose-500 uppercase tracking-widest flex items-center gap-3">
              <span className="w-4 h-4 bg-rose-500 rounded-full animate-ping"></span>
              A Domicilio (Prioridad)
            </h2>
            <span className="bg-rose-500 text-white px-4 py-1 rounded-full font-black text-xl">
              {pedidos.filter(p => p.tipo_entrega === 'domicilio').length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {pedidos.filter(p => p.tipo_entrega === 'domicilio').map((p) => (
              <OrderCard key={p.id} pedido={p} onUpdate={actualizarEstado} />
            ))}
            {pedidos.filter(p => p.tipo_entrega === 'domicilio').length === 0 && (
              <p className="text-center py-20 text-slate-700 italic text-xl">Sin repartos pendientes</p>
            )}
          </div>
        </section>

        {/* COLUMNA RECOGIDA */}
        <section className="flex-1 flex flex-col">
          <div className="p-6 bg-indigo-600/10 border-b border-indigo-500/30 flex justify-between items-center">
            <h2 className="text-2xl font-black text-indigo-400 uppercase tracking-widest">Recoger en Tienda</h2>
            <span className="bg-indigo-500 text-white px-4 py-1 rounded-full font-black text-xl">
              {pedidos.filter(p => p.tipo_entrega !== 'domicilio').length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {pedidos.filter(p => p.tipo_entrega !== 'domicilio').map((p) => (
              <OrderCard key={p.id} pedido={p} onUpdate={actualizarEstado} />
            ))}
            {pedidos.filter(p => p.tipo_entrega !== 'domicilio').length === 0 && (
              <p className="text-center py-20 text-slate-700 italic text-xl">Sin recogidas pendientes</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderCard({ pedido, onUpdate }: { pedido: any, onUpdate: any }) {
  const [itemsListo, setItemsListo] = useState<Record<number, boolean>>({});

  const toggleItem = (idx: number) => {
    setItemsListo(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className={`rounded-3xl p-6 flex flex-col gap-4 border shadow-2xl transition-all ${
      pedido.estado === 'preparando' 
      ? 'bg-amber-500/10 border-amber-500/50' 
      : 'bg-slate-800/50 border-slate-700'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-3xl font-black text-white leading-tight uppercase">{pedido.nombre_cliente}</h3>
            <div className="text-2xl font-black text-slate-500 font-mono">#{pedido.id}</div>
          </div>
          
          <div className="space-y-3">
            {pedido.contenido.split(', ').map((item: string, idx: number) => {
              const hasPrep = item.includes('[PREP:');
              const namePart = hasPrep ? item.split(' [PREP: ')[0] : item;
              const prepPart = hasPrep ? item.split(' [PREP: ')[1].replace(']', '') : null;
              const isChecked = itemsListo[idx];

              return (
                <div 
                  key={idx} 
                  onClick={() => toggleItem(idx)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-95 ${
                    isChecked 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-inner' 
                    : 'bg-slate-900/50 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xl font-bold ${isChecked ? 'line-through opacity-50' : ''}`}>
                      {namePart}
                    </span>
                    {isChecked && (
                      <span className="bg-emerald-500 text-white p-1 rounded-full animate-in zoom-in">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                    )}
                  </div>
                  {prepPart && (
                    <div className={`mt-2 p-2 rounded-xl text-sm font-black uppercase italic ${
                      isChecked ? 'bg-slate-800/50 text-slate-500' : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                    }`}>
                      ⚠️ {prepPart}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pedido.tipo_entrega === 'domicilio' && (
        <div className="bg-rose-500 p-4 rounded-2xl border-2 border-rose-400 shadow-lg">
          <p className="text-xs font-black text-rose-100 uppercase tracking-widest mb-1">Dirección de Entrega:</p>
          <p className="text-xl font-bold text-white leading-tight">{pedido.direccion}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {pedido.estado === 'pendiente' ? (
          <button 
            onClick={() => onUpdate(pedido.id, 'preparando')}
            className="flex-1 py-5 bg-amber-500 text-black font-black text-2xl rounded-2xl hover:bg-amber-400 uppercase tracking-tighter shadow-lg shadow-amber-900/20"
          >
            Empezar
          </button>
        ) : (
          <button 
            onClick={() => onUpdate(pedido.id, 'listo')}
            className="flex-1 py-5 bg-emerald-500 text-white font-black text-2xl rounded-2xl animate-pulse uppercase tracking-tighter shadow-lg shadow-emerald-900/20"
          >
            ¿Listo?
          </button>
        )}
      </div>
    </div>
  );
}
