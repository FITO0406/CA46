'use client';

import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'ready' | 'error';

export default function CreatorHealthBadge() {
  const [state, setState] = useState<HealthState>('checking');

  useEffect(() => {
    let active = true;

    fetch('/api/analyze-invoice', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        setState(response.ok && payload?.configured ? 'ready' : 'error');
      })
      .catch(() => {
        if (active) setState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === 'checking') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-500" /> Comprobando OCR
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-300">
        <span className="h-2 w-2 rounded-full bg-rose-400" /> OCR no disponible
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-400" /> OCR activo
    </span>
  );
}
