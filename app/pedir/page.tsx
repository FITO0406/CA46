'use client';

import { useState } from 'react';

export default function PedirPage() {
  const [nombre, setNombre] = useState('');
  const [pedido, setPedido] = useState('');

  return (
    <div className="min-h-screen bg-[#ece5dd] flex flex-col">
      {/* Header tipo WhatsApp */}
      <header className="bg-[#075e54] p-4 flex items-center gap-4 text-white shadow-md">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-xl">
          PV
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">Pescadería R. Vicente</h1>
          <p className="text-xs opacity-80 text-emerald-100 flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            En línea
          </p>
        </div>
      </header>

      {/* Cuerpo del Chat */}
      <main className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] text-slate-800">
          <p className="text-sm">¡Hola! Soy Fito. 👋</p>
          <p className="text-sm mt-1">Escribe tu nombre y lo que necesitas que te preparemos hoy.</p>
        </div>
      </main>

      {/* Input de Pedido */}
      <footer className="p-4 bg-[#f0f2f5] border-t border-slate-200">
        <div className="max-w-4xl mx-auto space-y-3">
          <input 
            type="text" 
            placeholder="¿Cómo te llamas?" 
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full p-4 rounded-xl border-none focus:ring-2 focus:ring-[#075e54] text-slate-800 shadow-sm"
          />
          <div className="flex gap-2">
            <textarea 
              placeholder="Escribe tu pedido aquí..." 
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              className="flex-1 p-4 rounded-xl border-none focus:ring-2 focus:ring-[#075e54] text-slate-800 shadow-sm resize-none"
              rows={2}
            />
            <button className="bg-[#075e54] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-[#054d44] transition-colors shrink-0">
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
