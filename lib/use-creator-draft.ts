'use client';

import { useEffect, useRef, useState } from 'react';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';
import { readCreatorDraft, writeCreatorDraft } from '@/lib/creator-draft-storage';

export function useCreatorDraft<T>(mode: string, snapshot: T, restore: (value: T) => void) {
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useState<{ companyId: string; userId: string } | null>(null);
  const [message, setMessage] = useState('Recuperando trabajo guardado…');
  const key = useRef('');
  const restoreRef = useRef(restore);
  const writes = useRef(Promise.resolve());
  useEffect(() => { restoreRef.current = restore; }, [restore]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/label-jobs', { cache: 'no-store', headers: await tenantAuthorizationHeader() });
        const scope = await response.json();
        if (!response.ok) throw new Error(scope.error || 'No se pudo recuperar el trabajo.');
        const scopedKey = `${scope.companyId}:${scope.userId}:${mode}`;
        const saved = await readCreatorDraft<T>(scopedKey);
        if (!active) return;
        key.current = scopedKey;
        setScope({ companyId: scope.companyId, userId: scope.userId });
        if (saved) restoreRef.current(saved);
        setMessage(saved ? 'Trabajo recuperado. Las fotos y los cambios se guardan automáticamente en este móvil.' : 'Las fotos y los cambios se guardan automáticamente en este móvil.');
        setReady(true);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'No se pudo recuperar el trabajo guardado. Recarga para reintentarlo.');
      }
    }
    void load();
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    if (!ready || !key.current) return;
    const currentKey = key.current;
    // Serialize commits so a slow save cannot overwrite a newer edit/reset.
    writes.current = writes.current.catch(() => {}).then(() => writeCreatorDraft(currentKey, snapshot));
    void writes.current.catch(() => setMessage('No se pudo guardar el borrador en este móvil. Libera espacio antes de salir de la pantalla.'));
  }, [snapshot, ready]);

  return { ready, message, scope, async flush(value?: T) {
    if (!key.current) throw new Error('El guardado de trabajo todavía no está preparado.');
    const currentKey = key.current;
    const current = value ?? snapshot;
    writes.current = writes.current.catch(() => {}).then(() => writeCreatorDraft(currentKey, current));
    await writes.current;
  } };
}
