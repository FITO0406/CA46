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

  // Cargar productos
  useEffect(() => {
    async function fetchProductos() {
      const { data } = await supabase.from('productos').select('*').order('nombre');
      if (data) setProductos(data);
    }
    fetchProductos();
  }, []);

  const addProducto = async () => {
    if (!nuevoNombre || !nuevoPrecio) return;
    const { data, error } = await supabase
      .from('productos')
      .insert([{ nombre: nuevoNombre, precio_kilo: parseFloat(nuevoPrecio) }])
      .select();
    
    if (data) {
      setProductos([...productos, data[0]]);
      setNuevoNombre('');
      setNuevoPrecio('');
    }
  };

  const deleteProducto = async (id: string) => {
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (!error) {
      setProductos(productos.filter(p => p.id !== id));
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
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">Base de Datos de Productos</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-50 p-6 rounded-2xl">
            <input 
              type="text" 
              placeholder="Nombre del pescado" 
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
            <button 
              onClick={addProducto}
              className="bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700"
            >
              Añadir al catálogo
            </button>
          </div>

          <div className="grid gap-3">
            {productos.length === 0 ? (
              <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50 text-slate-400 italic text-center">
                No hay productos. Añade el primero arriba.
              </div>
            ) : (
              productos.map((p) => (
                <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="font-bold text-slate-800">{p.nombre}</span>
                    <span className="ml-4 text-indigo-600 font-mono">{p.precio_kilo} €/kg</span>
                  </div>
                  <button 
                    onClick={() => deleteProducto(p.id)}
                    className="text-rose-400 hover:text-rose-600 p-2"
                  >
                    Eliminar
                  </button>
                </div>
              ))
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
