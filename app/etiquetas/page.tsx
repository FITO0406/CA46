'use client';

import { useState, useEffect } from 'react';
import TagCard from '@/components/TagCard';

interface Tag {
  id: string;
  product_name: string;
  price: number | null;
  unit: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  expires_at: string;
  drive_file_id?: string;
}

export default function EtiquetasPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchTags() {
    try {
      const res = await fetch('/api/digital-tags');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTags(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTags();
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-drive');
      const data = await res.json();
      alert(`Sincronizacion completada. Nuevas etiquetas: ${data.inserted || 0}`);
      fetchTags();
    } catch (err) {
      console.error(err);
      alert('Error en la sincronizacion');
    } finally {
      setSyncing(false);
    }
  }


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-600">Cargando etiquetas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Etiquetas Digitales</h1>
            <p className="text-gray-600">Gestione los precios and productos de las etiquetas electronicas</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`rounded-lg px-6 py-3 font-semibold text-white shadow-md transition-all ${
              syncing
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar Drive'}
          </button>
        </div>

        {tags.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-lg text-gray-500">No hay etiquetas disponibles en el sistema.</p>
            <p className="text-sm text-gray-400 mt-2">Haga clic en 'Sincronizar Drive' para importar etiquetas desde Google Drive.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tags.map((tag) => (
              <TagCard key={tag.id} tag={tag} onUpdate={fetchTags} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
