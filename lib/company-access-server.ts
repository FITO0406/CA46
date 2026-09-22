import { supabaseAdmin } from '@/lib/supabase';

export type AccessPlan = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';
export type AccessFeatureKey = 'labels' | 'ocr' | 'drive' | 'screen' | 'banks' | 'gesico' | 'store';

export const ACCESS_FEATURE_KEYS: AccessFeatureKey[] = ['labels', 'ocr', 'drive', 'screen', 'banks', 'gesico', 'store'];

export type CompanyAccessOverride = {
  active: boolean;
  effective: boolean;
  plan: AccessPlan;
  features: Record<AccessFeatureKey, boolean>;
  startsAt: string | null;
  endsAt: string | null;
  notes: string;
  grantedByUserId: string;
  updatedAt: string | null;
};

export function normalizeAccessFeatures(value: unknown): Record<AccessFeatureKey, boolean> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return ACCESS_FEATURE_KEYS.reduce((result, key) => {
    result[key] = Boolean(source[key]);
    return result;
  }, {} as Record<AccessFeatureKey, boolean>);
}

export function accessOverrideIsEffective(row: any, now = Date.now()) {
  if (!row?.is_active) return false;
  if (!row?.ends_at) return true;
  const end = new Date(row.ends_at).getTime();
  return Number.isFinite(end) && end > now;
}

export async function getCompanyAccessOverride(companyId: string): Promise<CompanyAccessOverride | null> {
  const { data, error } = await supabaseAdmin
    .from('company_access_overrides')
    .select('company_id, is_active, granted_plan, features, starts_at, ends_at, notes, granted_by_user_id, updated_at')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    active: Boolean(data.is_active),
    effective: accessOverrideIsEffective(data),
    plan: data.granted_plan as AccessPlan,
    features: normalizeAccessFeatures(data.features),
    startsAt: data.starts_at || null,
    endsAt: data.ends_at || null,
    notes: data.notes || '',
    grantedByUserId: data.granted_by_user_id || '',
    updatedAt: data.updated_at || null,
  };
}

export async function resolveCompanyEffectiveAccess(companyId: string, basePlan: AccessPlan) {
  const override = await getCompanyAccessOverride(companyId);
  if (override?.effective) {
    return {
      source: 'superadmin' as const,
      plan: override.plan,
      features: override.features,
      complimentary: true,
      endsAt: override.endsAt,
      override,
    };
  }

  return {
    source: 'base' as const,
    plan: basePlan,
    features: normalizeAccessFeatures({}),
    complimentary: false,
    endsAt: null,
    override,
  };
}
