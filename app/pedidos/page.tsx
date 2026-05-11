'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Pedido } from '@/lib/types';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [sonidoHabilitado, setSonidoHabilitado] = useState(false);

  const reproducirSonido = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1010/1010-preview.mp3');
    audio.play().catch(err => console.log('Sonido bloqueado por el navegador', err));
  };

  useEffect(() => {
    const fetchPedidos = async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['pendiente', 'preparando'])
        .order('creado_en', { ascending: true })
        .returns<Pedido[]>();

      if (data) setPedidos(data);
    };

    fetchPedidos();

    const channel = supabase
      .channel('pedidos-realtime')
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

  const actualizarEstado = async (id: number, nuevoEstado: string) => {
    const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id);
    if (error) alert(`Error: ${error.message}`);
  };

  const pedidosDomicilio = pedidos.filter((pedido) => pedido.tipo_entrega === 'domicilio');
  const pedidosRecogida = pedidos.filter((pedido) => pedido.tipo_entrega !== 'domicilio');

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-indigo-400">
            Gestion de pedidos
          </h1>
          <p className="font-bold text-slate-500">Pescaderia R. Vicente - Panel realtime</p>
          {!sonidoHabilitado && (
            <button 
              onClick={() => {
                setSonidoHabilitado(true);
                reproducirSonido();
              }}
              className="mt-2 text-xs font-bold text-indigo-400 underline underline-offset-4 hover:text-indigo-300"
            >
              🔔 Activar avisos sonoros
            </button>
          )}
        </div>
        <div className="text-right">
          <div className="text-5xl font-black leading-none text-white">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-113px)] overflow-hidden">
        <section className="flex flex-1 flex-col border-r border-slate-800 bg-slate-900/30">
          <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-600/10 p-6">
            <h2 className="flex items-center gap-3 text-2xl font-black uppercase tracking-widest text-rose-500">
              <span className="h-4 w-4 rounded-full bg-rose-500 animate-ping" />
              A domicilio (prioridad)
            </h2>
            <span className="rounded-full bg-rose-500 px-4 py-1 text-xl font-black text-white">
              {pedidosDomicilio.length}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {pedidosDomicilio.map((pedido) => (
              <OrderCard key={pedido.id} pedido={pedido} onUpdate={actualizarEstado} />
            ))}
            {pedidosDomicilio.length === 0 && (
              <p className="py-20 text-center text-xl italic text-slate-700">
                Sin repartos pendientes
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-indigo-500/30 bg-indigo-600/10 p-6">
            <h2 className="text-2xl font-black uppercase tracking-widest text-indigo-400">
              Recoger en tienda
            </h2>
            <span className="rounded-full bg-indigo-500 px-4 py-1 text-xl font-black text-white">
              {pedidosRecogida.length}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {pedidosRecogida.map((pedido) => (
              <OrderCard key={pedido.id} pedido={pedido} onUpdate={actualizarEstado} />
            ))}
            {pedidosRecogida.length === 0 && (
              <p className="py-20 text-center text-xl italic text-slate-700">
                Sin recogidas pendientes
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderCard({
  pedido,
  onUpdate,
}: {
  pedido: Pedido;
  onUpdate: (id: number, nuevoEstado: string) => void;
}) {
  const [itemsListos, setItemsListos] = useState<Record<number, boolean>>({});

  const toggleItem = (index: number) => {
    setItemsListos((current) => ({ ...current, [index]: !current[index] }));
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-6 shadow-2xl transition-all ${
        pedido.estado === 'preparando'
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-slate-700 bg-slate-800/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-3xl font-black uppercase leading-tight text-white">
              {pedido.nombre_cliente}
            </h3>
            <div className="text-2xl font-black text-slate-500">#{pedido.id}</div>
          </div>

          <div className="space-y-3">
            {pedido.contenido.split(', ').map((item, index) => {
              const hasPrep = item.includes('[PREP:');
              const namePart = hasPrep ? item.split(' [PREP: ')[0] : item;
              const prepPart = hasPrep ? item.split(' [PREP: ')[1].replace(']', '') : null;
              const isChecked = itemsListos[index];

              return (
                <div
                  key={`${pedido.id}-${index}`}
                  onClick={() => toggleItem(index)}
                  className={`cursor-pointer select-none rounded-2xl border-2 p-4 transition-all ${
                    isChecked
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-inner'
                      : 'border-slate-700 bg-slate-900/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xl font-bold ${isChecked ? 'line-through opacity-50' : ''}`}>
                      {namePart}
                    </span>
                    {isChecked && (
                      <span className="rounded-full bg-emerald-500 p-1 text-white">
                        <svg
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {prepPart && (
                    <div
                      className={`mt-2 rounded-xl p-2 text-sm font-black uppercase ${
                        isChecked
                          ? 'bg-slate-800/50 text-slate-500'
                          : 'border border-amber-500/40 bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {prepPart}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pedido.tipo_entrega === 'domicilio' && pedido.direccion && (
        <div className="rounded-2xl border-2 border-rose-400 bg-rose-500 p-4 shadow-lg">
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-rose-100">
            Direccion de entrega:
          </p>
          <p className="text-xl font-bold text-white">{pedido.direccion}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {pedido.estado === 'pendiente' ? (
          <button
            onClick={() => onUpdate(pedido.id, 'preparando')}
            className="flex-1 rounded-2xl bg-amber-500 py-5 text-2xl font-black uppercase tracking-tighter text-black shadow-lg shadow-amber-900/20 hover:bg-amber-400"
          >
            Empezar
          </button>
        ) : (
          <button
            onClick={() => onUpdate(pedido.id, 'listo')}
            className="flex-1 rounded-2xl bg-emerald-500 py-5 text-2xl font-black uppercase tracking-tighter text-white shadow-lg shadow-emerald-900/20"
          >
            Listo?
          </button>
        )}
      </div>
    </div>
  );
}
