/**
 * Target Guard para CA46 Production
 * Project Ref permitido en Producción: xcjhqyjqakknnfbjxlui
 */
export const ALLOWED_PRODUCTION_PROJECT_REF = 'xcjhqyjqakknnfbjxlui';
export const ALLOWED_PRODUCTION_SUPABASE_URL = `https://${ALLOWED_PRODUCTION_PROJECT_REF}.supabase.co`;

export function assertProductionTarget(url?: string): void {
  const targetUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!targetUrl) {
    console.warn('[TargetGuard Warning] Target URL no especificada en entorno.');
    return;
  }

  // Verificar si la URL contiene un project ref prohibido (staging / legacy)
  if (targetUrl.includes('vtflazurmjdbaqgsrioh') || targetUrl.includes('aleaozsueejhasrcalpd')) {
    throw new Error(
      `[TARGET GUARD CRITICAL ERROR] Se detectó un Project Ref no permitido en Producción (${targetUrl}). El único ref permitido es: ${ALLOWED_PRODUCTION_PROJECT_REF}. Ejecución ABORTADA.`
    );
  }

  if (targetUrl.includes('.supabase.co') && !targetUrl.includes(ALLOWED_PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `[TARGET GUARD CRITICAL ERROR] La URL (${targetUrl}) no coincide con la instancia de Producción oficial (${ALLOWED_PRODUCTION_PROJECT_REF}). Ejecución ABORTADA.`
    );
  }
}
