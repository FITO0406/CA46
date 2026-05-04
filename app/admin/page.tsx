'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
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
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all ${
                isOpen 
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200' 
                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-200'
              }`}
            >
              {isOpen ? 'TIENDA ABIERTA' : 'TIENDA CERRADA'}
            </button>
          </div>
        </section>

        {/* Gestión de Productos */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-slate-800">Base de Datos de Productos</h2>
            <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              + Nuevo Producto
            </button>
          </div>
          <div className="grid gap-4">
            <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50 text-slate-400 italic text-center">
              Aún no hay productos registrados. Pulsa el botón para añadir el primer pescado.
            </div>
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
