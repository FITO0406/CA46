'use client'
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import TagCard from '../../components/TagCard';

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

export default function EtiquetasPage() {
  const [tags, setTags] = useState<DigitalTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();

    // Sincronizar desde Google Drive de forma silenciosa en segundo plano
    fetch('/api/sync-drive').catch((err) => console.error('Error al sincronizar Google Drive:', err));

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('digital_tags_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'digital_tags' },
        (payload) => {
          console.log('Cambio en etiquetas:', payload);
          fetchTags(); // Recargar etiquetas al haber cambios
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  async function fetchTags() {
    setLoading(true);
    // Filtrar etiquetas activas y no expiradas
    const { data, error } = await supabase
      .from('digital_tags')
      .select('*')
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tags:', error);
    } else {
      setTags(data || []);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0f18] font-sans selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 tracking-tighter mb-4">
            Mercasevilla <span className="text-cyan-500">En Vivo</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl">
            Catálogo digital de productos frescos actualizados en tiempo real mediante IA.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-24 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-xl font-medium text-white mb-2">No hay etiquetas activas</h3>
            <p className="text-gray-400">Las nuevas llegadas aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tags.map((tag) => (
              <TagCard key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
