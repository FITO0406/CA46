'use client';

import { useState } from 'react';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';

type Props = {
  compact?: boolean;
};

export default function DriveSyncButton({ compact = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function syncNow() {
    if (loading) return;
    setLoading(true);
    setMessage('');
    setError(false);

    try {
      const response = await fetch('/api/sync-drive', {
        method: 'POST',
        headers: await tenantAuthorizationHeader(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudo sincronizar Drive.');

      const imported = Number(payload?.imported || 0);
      const found = Number(payload?.found || 0);
      const errors = Array.isArray(payload?.errors) ? payload.errors.length : 0;
      setMessage(
        imported > 0
          ? `✓ ${imported} ${imported === 1 ? 'etiqueta nueva' : 'etiquetas nuevas'} cargada${imported === 1 ? '' : 's'}.`
          : found > 0
            ? '✓ Drive revisado. No hay etiquetas nuevas.'
            : '✓ Drive revisado. La carpeta Etiquetas está vacía.',
      );
      if (errors > 0) setMessage((current) => `${current} ${errors} archivo(s) necesitan revisión.`);
    } catch (requestError: any) {
      setError(true);
      setMessage(requestError?.message || 'No se pudo sincronizar Drive.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? '' : 'w-full'}>
      <button
        type="button"
        onClick={syncNow}
        disabled={loading}
        className={compact
          ? 'rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-200 disabled:opacity-50'
          : 'w-full rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-200 disabled:opacity-50'}
      >
        {loading ? 'Sincronizando…' : '🔄 Sincronizar etiquetas de Drive'}
      </button>
      {message ? (
        <p className={`mt-2 text-xs font-bold ${error ? 'text-rose-300' : 'text-emerald-300'}`}>{message}</p>
      ) : null}
    </div>
  );
}
