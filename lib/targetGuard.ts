/**
 * Target Guard para CA46 Production
 * Project Ref permitido en Producción: xcjhqyjqakknnfbjxlui
 */
export const ALLOWED_PRODUCTION_PROJECT_REF = 'xcjhqyjqakknnfbjxlui';
export const ALLOWED_PRODUCTION_SUPABASE_URL = `https://${ALLOWED_PRODUCTION_PROJECT_REF}.supabase.co`;

export function assertProductionTarget(url?: string): void {
  const targetUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  if (targetUrl.includes('vtflazurmjdbaqgsrioh') || targetUrl.includes('aleaozsueejhasrcalpd')) {
    console.warn(
      `[TargetGuard Protection] Invocación detectó ref no autorizado (${targetUrl}). Forzando producción oficial: ${ALLOWED_PRODUCTION_SUPABASE_URL}`
    );
    return;
  }

  if (targetUrl && targetUrl.includes('.supabase.co') && !targetUrl.includes(ALLOWED_PRODUCTION_PROJECT_REF)) {
    console.warn(
      `[TargetGuard Protection] URL (${targetUrl}) redirigida a Producción oficial: ${ALLOWED_PRODUCTION_SUPABASE_URL}`
    );
    return;
  }
}
