/**
 * Target Guard para CA46 Production
 * Project Ref permitido en Producción: xcjhqyjqakknnfbjxlui
 */
export const ALLOWED_PRODUCTION_PROJECT_REF = 'xcjhqyjqakknnfbjxlui';
export const ALLOWED_PRODUCTION_SUPABASE_URL = `https://${ALLOWED_PRODUCTION_PROJECT_REF}.supabase.co`;

export function assertProductionTarget(url?: string): void {
  const targetUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';

  // Fail-Closed: si se detecta un Project Ref no permitido de Legacy o Staging, abortar inmediatamente
  if (targetUrl.includes('vtflazurmjdbaqgsrioh') || targetUrl.includes('aleaozsueejhasrcalpd')) {
    throw new Error(
      `[TARGET GUARD FAIL-CLOSED] Intento de conexión abortado. Se detectó un Project Ref no permitido en Producción (${targetUrl}). El único ref permitido es: ${ALLOWED_PRODUCTION_PROJECT_REF}`
    );
  }

  if (targetUrl && targetUrl.includes('.supabase.co') && !targetUrl.includes(ALLOWED_PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `[TARGET GUARD FAIL-CLOSED] Intento de conexión abortado. URL (${targetUrl}) no coincide con la Producción oficial (${ALLOWED_PRODUCTION_SUPABASE_URL}).`
    );
  }
}
