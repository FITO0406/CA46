/**
 * Guard de seguridad para Google Cloud Storage D51 Vault
 * Bucket obligatorio: ca46-d51-production-vault
 * Región obligatoria: europe-west1
 */
export const ALLOWED_GCS_BUCKET_NAME = 'ca46-d51-production-vault';
export const ALLOWED_GCS_REGION = 'europe-west1';

export function assertGoogleTarget(bucketName?: string, region?: string): void {
  const targetBucket = bucketName || process.env.GCS_BUCKET_NAME || ALLOWED_GCS_BUCKET_NAME;
  const targetRegion = region || process.env.GCS_REGION || ALLOWED_GCS_REGION;

  if (targetBucket !== ALLOWED_GCS_BUCKET_NAME) {
    throw new Error(
      `[GOOGLE TARGET GUARD CRITICAL ERROR] Se intentó utilizar un Bucket GCS no autorizado (${targetBucket}). El único bucket permitido en Producción es: ${ALLOWED_GCS_BUCKET_NAME}. Ejecución ABORTADA.`
    );
  }

  if (targetRegion.toLowerCase() !== ALLOWED_GCS_REGION.toLowerCase()) {
    throw new Error(
      `[GOOGLE TARGET GUARD CRITICAL ERROR] Se intentó utilizar una región GCS no autorizada (${targetRegion}). La única región permitida es: ${ALLOWED_GCS_REGION}. Ejecución ABORTADA.`
    );
  }
}
