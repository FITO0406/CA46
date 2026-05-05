'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar estado inicial
  useEffect(() => {
    async function fetchStatus() {
      const { data, error } = await supabase
        .from('configuracion')
        .select('tienda_abierta')
        .eq('id', 1)
        .single();
      
      if (data) setIsOpen(data.tienda_abierta);
      setLoading(false);
    }
    fetchStatus();
  }, []);

  // Alternar estado
  const toggleShop = async () => {
    const nextStatus = !isOpen;
    setIsOpen(nextStatus);
    const { error } = await supabase
      .from('configuracion')
      .update({ tienda_abierta: nextStatus, ultima_actualizacion: new Date() })
      .eq('id', 1);
    
    if (error) {
      alert('Error al actualizar el estado: ' + error.message);
      setIsOpen(!nextStatus); // Revertir si hay error
    }
  };

  const [productos, setProductos] = useState<any[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [seccionSeleccionada, setSeccionSeleccionada] = useState('Por kilos');
  const [otraSeccion, setOtraSeccion] = useState('');
  const [permitePreparacion, setPermitePreparacion] = useState(true);

  const SECCIONES_FIJAS = [
    'Por kilos', 
    'Frescos', 
    'Mariscos vivos', 
    'Elaborados', 
    'Recién cocidos', 
    'Congelados'
  ];

  // Cargar productos
  useEffect(() => {
    async function fetchProductos() {
      const { data } = await supabase.from('productos').select('*').order('seccion').order('nombre');
      if (data) setProductos(data);
    }
    fetchProductos();
  }, []);

  const addProducto = async () => {
    if (!nuevoNombre || !nuevoPrecio) return;
    
    const seccionFinal = seccionSeleccionada === 'Otros' ? otraSeccion : seccionSeleccionada;
    if (!seccionFinal) return alert('Indica una sección');

    const { data, error } = await supabase
      .from('productos')
      .insert([{ 
        nombre: nuevoNombre, 
        precio_kilo: parseFloat(nuevoPrecio),
        seccion: seccionFinal,
        permite_preparacion: permitePreparacion
      }])
      .select();
    
    if (data) {
      setProductos([...productos, data[0]]);
      setNuevoNombre('');
      setNuevoPrecio('');
      setOtraSeccion('');
      setPermitePreparacion(true);
    }
  };

  const togglePreparacion = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('productos')
      .update({ permite_preparacion: !currentStatus })
      .eq('id', id);
    
    if (!error) {
      setProductos(productos.map(p => p.id === id ? { ...p, permite_preparacion: !currentStatus } : p));
    }
  };

  const toggleProducto = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('productos')
      .update({ disponible: !currentStatus })
      .eq('id', id);
    
    if (!error) {
      setProductos(productos.map(p => p.id === id ? { ...p, disponible: !currentStatus } : p));
    }
  };

  const deleteProducto = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto para siempre?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (!error) {
      setProductos(productos.filter(p => p.id !== id));
    }
  };

  const updatePrecio = async (id: string, nuevoPrecio: string) => {
    const precio = parseFloat(nuevoPrecio);
    if (isNaN(precio)) return;

    const { error } = await supabase
      .from('productos')
      .update({ precio_kilo: precio })
      .eq('id', id);
    
    if (!error) {
      setProductos(productos.map(p => p.id === id ? { ...p, precio_kilo: precio } : p));
    } else {
      alert('Error al actualizar el precio: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900">
      <header className="max-w-4xl mx-auto mb-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Control Fito</h1>
        <p className="text-slate-500 text-lg">Gestión centralizada de Pescadería R. Vicente</p>
      </header>

      <main className="max-w-4xl mx-auto grid gap-8">
        {/* Estado de la Tienda */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-800">Estado de la Tienda</h2>
              <p className="text-slate-500">Activa o desactiva la recepción de pedidos</p>
            </div>
            {loading ? (
              <div className="animate-pulse bg-slate-200 h-14 w-48 rounded-2xl"></div>
            ) : (
              <button 
                onClick={toggleShop}
                className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all ${
                  isOpen 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200' 
                  : 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-200'
                }`}
              >
                {isOpen ? 'TIENDA ABIERTA' : 'TIENDA CERRADA'}
              </button>
            )}
          </div>
        </section>

        {/* Gestión de Productos */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-all hover:shadow-md">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">Catálogo de Pescados</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 bg-slate-50 p-6 rounded-2xl">
            <input 
              type="text" 
              placeholder="Nombre (ej: Merluza)" 
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="p-3 rounded-xl border-slate-200"
            />
            <input 
              type="number" 
              placeholder="Precio €/kg" 
              value={nuevoPrecio}
              onChange={(e) => setNuevoPrecio(e.target.value)}
              className="p-3 rounded-xl border-slate-200"
            />
            <div className="flex flex-col gap-2">
              <select 
                value={seccionSeleccionada}
                onChange={(e) => setSeccionSeleccionada(e.target.value)}
                className="p-3 rounded-xl border-slate-200 bg-white"
              >
                {SECCIONES_FIJAS.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Otros">-- Otros (Nueva sección) --</option>
              </select>
              {seccionSeleccionada === 'Otros' && (
                <input 
                  type="text" 
                  placeholder="Escribe la sección..." 
                  value={otraSeccion}
                  onChange={(e) => setOtraSeccion(e.target.value)}
                  className="p-3 rounded-xl border-indigo-300 bg-indigo-50 animate-in fade-in zoom-in duration-200"
                />
              )}
            </div>
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
              <input 
                type="checkbox" 
                id="prep" 
                checked={permitePreparacion}
                onChange={(e) => setPermitePreparacion(e.target.checked)}
                className="w-5 h-5 accent-indigo-600"
              />
              <label htmlFor="prep" className="text-sm font-medium text-slate-600">Permitir preparación personalizada</label>
            </div>
            <button 
              onClick={addProducto}
              className="bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 h-fit self-start"
            >
              + Añadir Producto
            </button>
          </div>

          <div className="space-y-8">
            {Object.entries(
              productos.reduce((acc: any, p) => {
                const sec = p.seccion || 'Sin sección';
                if (!acc[sec]) acc[sec] = [];
                acc[sec].push(p);
                return acc;
              }, {})
            ).sort(([a], [b]) => {
              const order = [...SECCIONES_FIJAS, 'Otros'];
              return order.indexOf(a) - order.indexOf(b);
            }).map(([seccion, items]: any) => (
              <div key={seccion} className="space-y-3">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">{seccion}</h3>
                <div className="grid gap-3">
                  {items.map((p: any) => (
                    <div key={p.id} className={`flex justify-between items-center p-4 border rounded-2xl transition-all ${p.disponible ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${p.disponible ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div>
                          <span className={`font-bold ${p.disponible ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{p.nombre}</span>
                          <div className="inline-flex items-center ml-4 group bg-indigo-50/50 p-1 px-2 rounded-xl border border-transparent hover:border-indigo-100 transition-all">
                            <input 
                              type="number" 
                              step="0.01"
                              defaultValue={p.precio_kilo}
                              onBlur={(e) => updatePrecio(p.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updatePrecio(p.id, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-16 p-1 text-indigo-600 font-mono text-sm bg-transparent focus:outline-none"
                            />
                            <span className="text-indigo-400 font-mono text-xs mr-2">€/kg</span>
                            <button 
                              onClick={(e) => {
                                const input = e.currentTarget.parentElement?.querySelector('input');
                                if (input) updatePrecio(p.id, input.value);
                              }}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
                              title="Guardar precio"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button 
                          onClick={() => togglePreparacion(p.id, p.permite_preparacion)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                            p.permite_preparacion 
                            ? 'bg-amber-50 border-amber-200 text-amber-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-400 opacity-40'
                          }`}
                          title="¿Permitir instrucciones de limpieza/corte?"
                        >
                          PREPARACIÓN
                        </button>
                        <button 
                          onClick={() => toggleProducto(p.id, p.disponible)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            p.disponible 
                            ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                            : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          }`}
                        >
                          {p.disponible ? 'AGOTAR' : 'ACTIVAR'}
                        </button>
                        <button 
                          onClick={() => deleteProducto(p.id)}
                          className="p-2 text-slate-300 hover:text-rose-500"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {productos.length === 0 && (
              <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50 text-slate-400 italic text-center">
                No hay productos en el catálogo.
              </div>
            )}
          </div>
        </section>

        {/* Acciones Rápidas */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-6 bg-slate-900 text-white rounded-3xl font-bold text-xl hover:bg-black transition-all">
            RESET DEL DÍA
          </button>
          <button className="p-6 bg-white border border-slate-200 text-slate-600 rounded-3xl font-bold text-xl hover:bg-slate-50 transition-all">
            HISTORIAL DE PEDIDOS
          </button>
        </section>
      </main>
    </div>
  );
}
