import { supabase } from '@/lib/supabase';
import type { CompanyConfig } from '@/lib/company-config';

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function authHeaders(json = false) {
  const token = await accessToken();
  if (!token) throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión.');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

export async function loadTenantCompanyConfig(): Promise<CompanyConfig | null> {
  const response = await fetch('/api/tenant/settings', {
    cache: 'no-store',
    headers: await authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'No se pudo cargar Mi empresa.');
  return payload?.settings || null;
}

export async function ensureTenantCompany(companyName: string, plan = 'gratis') {
  const response = await fetch('/api/tenant/me', {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ companyName, plan }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'No se pudo activar la empresa.');
  return payload?.tenant || null;
}

export async function saveTenantCompanyConfig(config: CompanyConfig): Promise<CompanyConfig> {
  await ensureTenantCompany(config.businessName);
  const response = await fetch('/api/tenant/settings', {
    method: 'PUT',
    headers: await authHeaders(true),
    body: JSON.stringify(config),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar Mi empresa.');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ca46-tenant-settings-updated'));
  }

  return payload.settings as CompanyConfig;
}

export async function tenantAuthorizationHeader() {
  return authHeaders();
}
