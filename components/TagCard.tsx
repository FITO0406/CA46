'use client';

import { useState } from 'react';

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

interface TagCardProps {
    tag: Tag;
    onUpdate: () => void;
}

export default function TagCard({ tag, onUpdate }: TagCardProps) {
    const [editing, setEditing] = useState(false);
    const [price, setPrice] = useState<string>(tag.price !== null ? tag.price.toString() : '');
    const [origin, setOrigin] = useState<string>(tag.origin || '');
    const [saving, setSaving] = useState(false);

  async function handleSave() {
        setSaving(true);
        try {
                const parsedPrice = price === '' ? null : parseFloat(price);
                const res = await fetch('/api/digital-tags', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      id: tag.id,
                                      price: parsedPrice,
                                      origin: origin === '' ? null : origin,
                          }),
                });

          if (!res.ok) {
                    throw new Error('Error al actualizar la etiqueta');
          }

          setEditing(false);
                onUpdate();
        } catch (err: any) {
                console.error(err);
                alert(err.message || 'Error al guardar los cambios');
        } finally {
                setSaving(false);
        }
  }

  const daysLeft = Math.ceil(
        (new Date(tag.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

  return (
        <div className="flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div>
                      <div className="flex items-center justify-between mb-4">
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                                  {tag.category}
                                </span>span>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                      tag.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${tag.is_active ? 'bg-green-600' : 'bg-red-600'}`} />
                                  {tag.is_active ? 'Activo' : 'Inactivo'}
                                </span>span>
                      </div>div>
              
                      <h3 className="text-lg font-bold text-gray-900 line-clamp-2 min-h-[3.5rem] mb-4">
                        {tag.product_name}
                      </h3>h3>
              
                {editing ? (
                    <div className="space-y-4 mb-4">
                                <div>
                                              <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Precio</labe              <div className="relative rounded-md shadow-sm">
                                                              <input
                                                                                  type="number"
                                                                                  step="0.01"
                                                                                  value={price}
                                                                                  onChange={(e) => setPrice(e.target.value)}
                                                                                  className="block w-full rounded-md border-gray-300 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                                                                  placeholder="0.00"
                                                                                />
                                                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                                                                <span className="text-gray-500 sm:text-sm">EUR/{tag.unit}</span>span>
                                                              </div>div>
                                              </div>div>
                                </div>div>
                    
                                <div>
                                              <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Origen</label>label>
                                              <input
                                                                type="text"
                                                                value={origin}
                                                                onChange={(e) => setOrigin(e.target.value)}
                                                                className="block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                                                placeholder="Ej. Espana"
                                                              />
                                </div>div>
                    </div>div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="rounded-lg bg-gray-50 p-3">
                                              <span className="block text-xs font-medium text-gray-400 uppercase mb-1">Precio</span>span>
                                              <span className="text-xl font-bold text-blue-600">
                                                {tag.price !== null ? `${tag.price.toFixed(2)} EUR` : 'N/A'}
                                              </span>span>
                                              <span className="text-xs text-gray-500">/{tag.unit}</span>span>
                                </div>div>
                                <div className="rounded-lg bg-gray-50 p-3">
                                              <span className="block text-xs font-medium text-gray-400 uppercase mb-1">Origen</span>span>
                                              <span className="text-sm font-semibold text-gray-800 truncate block">
                                                {tag.origin || 'No especificado'}
                                              </span>span>
                                </div>div>
                    </div>div>
                      )}
              </div>div>
        
              <div>
                      <div className="border-t border-gray-100 pt-4 mb-4 flex justify-between text-xs text-gray-400">
                                <span>ID: {tag.drive_file_id ? 'Drive' : 'Manual'}</span>span>
                                <span className={daysLeft < 2 ? 'text-red-500 font-semibold' : ''}>
                                  {daysLeft > 0 ? `Expira en ${daysLeft} d` : 'Expirado'}
                                </span>span>
                      </div>div>
              
                {editing ? (          <div className="flex gap-2">
                            <button
                                            onClick={() => setEditing(false)}
                                            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                                          >
                                          Cancelar
                            </button>
                              <button
                                              onClick={handleSave}
                                              disabled={saving}
                                              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                                            >
                                {saving ? 'Guardando...' : 'Guardar'}
                              </button>
                </div>
                                    ) : (
                    <button
                                  onClick={() => setEditing(true)}
                                  className="w-full rounded-lg border border-blue-600 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-all active:scale-98"
                                >
                                Editar Detalles
                    </button>
                  )}
              </div>
        </div>
      );
}
