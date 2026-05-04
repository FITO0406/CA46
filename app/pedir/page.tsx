'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PedirPage() {
  const [nombre, setNombre] = useState('');
  const [pedido, setPedido] = useState('');
  const [tiendaAbierta, setTiendaAbierta] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Escuchar estado de la tienda
    const fetchTienda = async () => {
      const { data } = await supabase.from('configuracion').select('tienda_abierta').eq('id', 1).single();
      if (data) setTiendaAbierta(data.tienda_abierta);
    };

    // Escuchar catálogo de productos
    const fetchProductos = async () => {
      const { data } = await supabase.from('productos').select('*').eq('disponible', true);
      if (data) setProductos(data);
    };

    fetchTienda();
    fetchProductos();

    // Suscribirse a cambios en tiempo real en la configuración
    const configChannel = supabase
      .channel('config-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion' }, (payload) => {
        setTiendaAbierta(payload.new.tienda_abierta);
      })
      .subscribe();

    // Suscribirse a cambios en el catálogo de productos
    const productsChannel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => {
        fetchProductos();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(configChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  const enviarPedido = async () => {
    if (!nombre || !pedido || !tiendaAbierta) return;
    setEnviando(true);
    const { error } = await supabase
      .from('pedidos')
      .insert([{ nombre_cliente: nombre, contenido: pedido, estado: 'pendiente' }]);
    
    if (!error) {
      alert('¡Pedido enviado con éxito! Estate atento a la pantalla.');
      setPedido('');
    } else {
      alert('Error al enviar: ' + error.message);
    }
    setEnviando(false);
  };

  return (
    <div className="min-h-screen bg-[#ece5dd] flex flex-col text-slate-900">
      {/* Header tipo WhatsApp */}
      <header className={`p-4 flex items-center gap-4 text-white shadow-md transition-colors ${tiendaAbierta ? 'bg-[#075e54]' : 'bg-slate-600'}`}>
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-xl uppercase">
          {nombre ? nombre[0] : 'PV'}
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">Pescadería R. Vicente</h1>
          <p className="text-xs opacity-80 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${tiendaAbierta ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            {tiendaAbierta ? 'En línea (Tienda Abierta)' : 'Cerrado (No se reciben pedidos)'}
          </p>
        </div>
      </header>

      {/* Cuerpo del Chat / Catálogo */}
      <main className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] text-slate-800">
          <p className="text-sm">¡Hola! {tiendaAbierta ? 'Hoy tenemos género fresco. ¿Qué te preparo?' : 'Lo siento, ahora mismo estamos cerrados.'} 👋</p>
        </div>

        {tiendaAbierta && productos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {productos.map(p => (
              <button 
                key={p.id}
                onClick={() => setPedido(prev => prev + (prev ? ', ' : '') + p.nombre)}
                className="bg-white p-3 rounded-xl border border-slate-200 text-left shadow-sm hover:border-emerald-500 transition-colors"
              >
                <p className="font-bold text-sm">{p.nombre}</p>
                <p className="text-xs text-emerald-600">{p.precio_kilo} €/kg</p>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Input de Pedido */}
      <footer className="p-4 bg-[#f0f2f5] border-t border-slate-200">
        <div className="max-w-4xl mx-auto space-y-3">
          <input 
            type="text" 
            placeholder="¿Cómo te llamas?" 
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={!tiendaAbierta}
            className="w-full p-4 rounded-xl border-none focus:ring-2 focus:ring-[#075e54] text-slate-800 shadow-sm disabled:opacity-50"
          />
          <div className="flex gap-2">
            <textarea 
              placeholder={tiendaAbierta ? "Escribe tu pedido aquí..." : "Tienda cerrada actualmente"}
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              disabled={!tiendaAbierta}
              className="flex-1 p-4 rounded-xl border-none focus:ring-2 focus:ring-[#075e54] text-slate-800 shadow-sm resize-none disabled:opacity-50"
              rows={2}
            />
            <button 
              onClick={enviarPedido}
              disabled={!tiendaAbierta || !nombre || !pedido || enviando}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all shrink-0 ${
                tiendaAbierta && nombre && pedido ? 'bg-[#075e54] text-white hover:bg-[#054d44]' : 'bg-slate-300 text-slate-500'
              }`}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
