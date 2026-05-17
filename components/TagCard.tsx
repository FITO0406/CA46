import React from 'react';

interface DigitalTag {
  id: number;
  product_name: string;
  price: number | null;
  unit: string | null;
  origin: string | null;
  category: string | null;
  created_at: string;
  expires_at: string;
}

export default function TagCard({ tag }: { tag: DigitalTag }) {
  const expiresAt = new Date(tag.expires_at);
  const now = new Date();
  const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isExpiringSoon = hoursLeft > 0 && hoursLeft < 24;

  return (
    <div className="relative group rounded-3xl bg-[#111827] border border-white/10 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden flex flex-col shadow-2xl">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="p-6 border-b border-white/5 flex justify-between items-start">
        <div>
          <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-400/10 rounded-full mb-3">
            {tag.category || 'Pescado Fresco'}
          </span>
          <h3 className="text-2xl font-black text-white leading-tight">
            {tag.product_name}
          </h3>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest">Activo</span>
          </div>
          {isExpiringSoon && (
             <span className="text-[10px] text-amber-500 font-bold uppercase mt-2">Expira pronto</span>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Procedencia</span>
          <span className="text-sm font-semibold text-gray-300 truncate">
            {tag.origin || 'Desconocida'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Formato</span>
          <span className="text-sm font-semibold text-gray-300">
            Cajas / {tag.unit || 'Kg'}
          </span>
        </div>
      </div>

      <div className="p-6 pt-0 mt-auto">
        <div className="w-full bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 group-hover:bg-white/10 transition-colors">
          <span className="text-sm text-gray-400 font-medium">Llegada: {new Date(tag.created_at).toLocaleDateString()}</span>
          {tag.price && tag.price > 0 ? (
            <span className="text-2xl font-black text-white">{tag.price}€<span className="text-sm text-gray-500 font-normal">/{tag.unit}</span></span>
          ) : (
            <span className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Consultar</span>
          )}
        </div>
      </div>
    </div>
  );
}
