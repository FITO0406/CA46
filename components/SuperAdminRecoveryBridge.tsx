'use client';

import { useEffect } from 'react';

export default function SuperAdminRecoveryBridge() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const isRecovery = hash.get('type') === 'recovery';
    const hasRecoveryTokens = Boolean(hash.get('access_token') && hash.get('refresh_token'));
    const hasAuthCode = Boolean(url.searchParams.get('code'));

    if (!isRecovery && !hasRecoveryTokens && !hasAuthCode) return;
    if (url.pathname === '/superadmin-nueva-clave') return;

    const next = new URL('/superadmin-nueva-clave', window.location.origin);
    const code = url.searchParams.get('code');
    if (code) next.searchParams.set('code', code);
    next.hash = url.hash;
    window.location.replace(next.toString());
  }, []);

  return null;
}
