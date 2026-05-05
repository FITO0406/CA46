'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Step = 'inicio' | 'ver_lista' | 'pedido';

export default function PedirPage() {
  const [step, setStep] = useState<Step>('inicio');
  const [nombre, setNombre] = useState('');
  const [tiendaAbierta, setTiendaAbierta] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [tipoEntrega, setTipoEntrega] = useState<'recoger' | 'domicilio' | null>(null);
  const [direccion, setDireccion] = useState('');
  const [carrito, setCarrito] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [tempPrep, setTempPrep] = useState<{[key: string]: string}>({});

  useEffect(() => {
    const fetchTienda = async () => {
      const { data } = await supabase.from('configuracion').select('tienda_abierta').eq('id', 1).single();
      if (data) setTiendaAbierta(data.tienda_abierta);
    };
    const fetchProductos = async () => {
      const { data } = await supabase.from('productos').select('*').eq('disponible', true);
      if (data) setProductos(data);
    };
    fetchTienda();
    fetchProductos();

    const configChannel = supabase.channel('config-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion' }, (payload) => {
      setTiendaAbierta(payload.new.tienda_abierta);
    }).subscribe();

    return () => { supabase.removeChannel(configChannel); };
  }, []);

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.precio_kilo * item.cantidad), 0);
  const faltaParaMinimo = tipoEntrega === 'domicilio' ? Math.max(0, 30 - totalCarrito) : 0;
  const puedePedir = tipoEntrega === 'recoger' || (tipoEntrega === 'domicilio' && totalCarrito >= 30 && direccion);

  const agregarAlCarrito = (producto: any, cantidad: number | string, instruccion?: string, textoManual?: string) => {
    const cantNum = typeof cantidad === 'string' ? 1 : cantidad; // Si es 'otra', ponemos 1 de base
    setCarrito([...carrito, { 
      ...producto, 
      cantidad: cantNum, 
      cantidadTexto: textoManual || (typeof cantidad === 'string' ? '' : `${cantidad}kg`),
      preparacion: instruccion || '' 
    }]);
  };

  const enviarPedido = async () => {
    if (!puedePedir || !nombre) return;
    setEnviando(true);
    
    const contenidoTexto = carrito.map(item => {
      const prep = item.preparacion ? ` [PREP: ${item.preparacion}]` : '';
      return `${item.nombre} (${item.cantidadTexto || item.cantidad + 'kg'})${prep}`;
    }).join(', ');
    
    const { error } = await supabase
      .from('pedidos')
      .insert([{ 
        nombre_cliente: nombre, 
        contenido: contenidoTexto, 
        estado: 'pendiente',
        tipo_entrega: tipoEntrega,
        direccion: tipoEntrega === 'domicilio' ? direccion : null
      }]);
    
    if (!error) {
      alert('¡Pedido enviado con éxito!');
      window.location.reload();
    }
    setEnviando(false);
  };

  if (!tiendaAbierta) {
    return (
      <div className="min-h-screen bg-[#ece5dd] flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Pescadería Cerrada</h1>
          <p className="text-slate-500">Lo sentimos, Fito está ahora mismo fuera del mostrador. Vuelve más tarde.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ece5dd] flex flex-col text-slate-900 pb-20">
      <header className="bg-[#075e54] p-4 text-white shadow-lg sticky top-0 z-50">
        <h1 className="font-bold text-xl">Pescadería R. Vicente</h1>
        <p className="text-xs opacity-80">Asistente de Pedidos Realtime</p>
      </header>

      <main className="flex-1 p-4 max-w-xl mx-auto w-full space-y-6">
        {/* PASO 1: NOMBRE Y TIPO */}
        <section className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-lg font-bold">¿Qué quieres hoy? 👋</h2>
          <input 
            type="text" 
            placeholder="Escribe tu nombre..." 
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#075e54]"
          />
          
          <div className="flex gap-2">
            <button 
              onClick={() => setTipoEntrega('recoger')}
              className={`flex-1 p-4 rounded-2xl font-bold transition-all ${tipoEntrega === 'recoger' ? 'bg-[#075e54] text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Recogida
            </button>
            <button 
              onClick={() => setTipoEntrega('domicilio')}
              className={`flex-1 p-4 rounded-2xl font-bold transition-all ${tipoEntrega === 'domicilio' ? 'bg-[#075e54] text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              A domicilio
            </button>
          </div>

          {tipoEntrega === 'domicilio' && (
            <input 
              type="text" 
              placeholder="Dirección completa..." 
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full p-4 bg-rose-50 rounded-2xl border-none focus:ring-2 focus:ring-rose-500"
            />
          )}
        </section>

        {/* PASO 2: VER LISTA */}
        {tipoEntrega && nombre && step === 'inicio' && (
          <button 
            onClick={() => setStep('ver_lista')}
            className="w-full bg-indigo-600 text-white p-6 rounded-3xl font-black text-xl shadow-xl animate-bounce"
          >
            ¿QUIERES LA LISTA DE HOY? 🐟
          </button>
        )}

        {/* PASO 3: CATÁLOGO AGRUPADO */}
        {step === 'ver_lista' && (
          <div className="space-y-8">
            {Object.entries(
              productos.reduce((acc: any, p) => {
                const sec = p.seccion || 'Por kilos';
                if (!acc[sec]) acc[sec] = [];
                acc[sec].push(p);
                return acc;
              }, {})
            ).sort(([a], [b]) => {
              const order = ['Por kilos', 'Frescos', 'Mariscos vivos', 'Elaborados', 'Recién cocidos', 'Congelados'];
              const idxA = order.indexOf(a);
              const idxB = order.indexOf(b);
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            }).map(([seccion, items]: any) => (
              <div key={seccion} className="space-y-4">
                <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs px-2 border-l-4 border-[#075e54] ml-1">
                  {seccion}
                </h3>
                {items.map((p: any) => (
                  <div key={p.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-bold text-slate-800">{p.nombre}</span>
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-black font-mono">
                        {p.precio_kilo.toFixed(2)} €/kg
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(p.unidad_medida === 'pieza' ? [1, 2, 3] : [0.25, 0.5, 1]).map(q => (
                        <button 
                          key={q}
                          onClick={() => {
                            const qTexto = p.unidad_medida === 'pieza' ? `${q} pieza${q > 1 ? 's' : ''}` : `${q}kg`;
                            agregarAlCarrito(p, q, tempPrep[p.id], qTexto);
                            setTempPrep({...tempPrep, [p.id]: ''});
                          }}
                          className="bg-slate-50 hover:bg-[#075e54] hover:text-white p-2 rounded-xl text-xs font-bold transition-colors"
                        >
                          {p.unidad_medida === 'pieza' ? `${q} pza.` : (q === 0.25 ? '1/4' : q === 0.5 ? '1/2' : '1')} 
                          {p.unidad_medida !== 'pieza' && ' kg'}
                        </button>
                      ))}
                      <button 
                        onClick={() => {
                          const unitLabel = p.unidad_medida === 'pieza' ? 'piezas' : 'kg';
                          const cant = prompt(`¿Cuántas ${unitLabel} quieres? (ej: 3, 5, 2kg, 3 rodajas...)`);
                          if (cant) {
                            const unitSufijo = p.unidad_medida === 'pieza' ? 'piezas' : 'kg';
                            const textoFinal = isNaN(Number(cant)) ? cant : `${cant} ${unitSufijo}`;
                            agregarAlCarrito(p, cant, tempPrep[p.id], textoFinal);
                            setTempPrep({...tempPrep, [p.id]: ''});
                          }
                        }}
                        className="bg-slate-100 p-2 rounded-xl text-xs font-bold"
                      >
                        Otra...
                      </button>
                    </div>

                    {p.permite_preparacion !== false && (
                      <div className="pt-3 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center gap-2 mb-2 ml-1">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Modo Preparación</span>
                        </div>
                        <textarea 
                          placeholder="Escribe aquí: Limpio, en rodajas para freír, sin espinas..." 
                          value={tempPrep[p.id] || ''}
                          onChange={(e) => setTempPrep({...tempPrep, [p.id]: e.target.value})}
                          rows={2}
                          className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300 resize-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* CARRITO Y TOTAL (SIN PRECIOS VISIBLES) */}
        {carrito.length > 0 && (
          <section className="bg-white p-6 rounded-3xl shadow-xl border-2 border-[#075e54] space-y-4">
            <h2 className="font-bold text-lg border-b pb-2">Tu Lista de Compra:</h2>
            <div className="space-y-4">
              {carrito.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">
                      • {item.nombre} <span className="text-slate-400 font-normal">({item.cantidadTexto || item.cantidad + 'kg'})</span>
                    </span>
                    {item.preparacion && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full w-fit mt-1 font-bold">
                        {item.preparacion}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setCarrito(carrito.filter((_, idx) => idx !== i))}
                    className="text-rose-500 text-xs font-bold p-1"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            {tipoEntrega === 'domicilio' && faltaParaMinimo > 0 ? (
              <div className="bg-rose-50 p-4 rounded-2xl text-rose-600 text-center font-bold text-sm">
                Añade algo más para llegar al pedido mínimo de envío.
              </div>
            ) : tipoEntrega === 'domicilio' ? (
              <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 text-center font-bold text-sm">
                ✅ Pedido mínimo alcanzado
              </div>
            ) : null}
            
            <p className="text-[10px] text-slate-400 italic text-center">
              * El peso y precio final se confirmarán en el mostrador tras el pesaje exacto.
            </p>
          </section>
        )}
      </main>

      {/* BOTÓN FINAL FIJO */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-[100]">
        <button 
          onClick={enviarPedido}
          disabled={!puedePedir || enviando}
          className={`w-full p-5 rounded-2xl font-black text-2xl uppercase tracking-tighter shadow-2xl transition-all ${
            puedePedir ? 'bg-[#075e54] text-white' : 'bg-slate-300 text-slate-500 opacity-50'
          }`}
        >
          {enviando ? 'Enviando...' : 'REALIZAR PEDIDO'}
        </button>
      </footer>
    </div>
  );
}
