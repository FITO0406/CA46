import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { assertProductionTarget } from './targetGuard';
import { assertGoogleTarget, ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION } from './googleTargetGuard';

function formatPemPrivateKey(rawKey: string): string {
  if (!rawKey) return '';
  let cleaned = rawKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  const headerMatch = cleaned.match(/-----BEGIN PRIVATE KEY-----\s*([\s\S]*?)\s*-----END PRIVATE KEY-----/);
  if (headerMatch && headerMatch[1]) {
    const body = headerMatch[1].replace(/\s+/g, '');
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }
  return cleaned;
}

function getStorageClient(): Storage {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!saJson) {
    throw new Error('[D51 GCS Error] GOOGLE_SERVICE_ACCOUNT_JSON no está presente en el entorno.');
  }

  let credentials;
  try {
    let jsonString = saJson.trim();
    if ((jsonString.startsWith("'") && jsonString.endsWith("'")) ||
        (jsonString.startsWith('"') && jsonString.endsWith('"')) ) {
      jsonString = jsonString.slice(1, -1);
    }
    credentials = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`[D51 GCS Error] Error al decodificar GOOGLE_SERVICE_ACCOUNT_JSON: ${err.message}`);
  }

  const clientEmail = credentials.client_email;
  const privateKey = formatPemPrivateKey(credentials.private_key);

  return new Storage({
    projectId: credentials.project_id || 'opengravityfito',
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    }
  });
}

/**
 * Aprovisiona y verifica el Bucket D51 Vault en GCS con las condiciones aprobadas.
 */
export async function createOrVerifyD51Bucket(): Promise<any> {
  assertProductionTarget();
  assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

  const storage = getStorageClient();
  const bucket = storage.bucket(ALLOWED_GCS_BUCKET_NAME);

  const [exists] = await bucket.exists();
  if (!exists) {
    console.log(`[D51 GCS] Creando bucket ${ALLOWED_GCS_BUCKET_NAME} en ${ALLOWED_GCS_REGION}...`);
    await storage.createBucket(ALLOWED_GCS_BUCKET_NAME, {
      location: ALLOWED_GCS_REGION,
      storageClass: 'STANDARD',
      retentionPolicy: {
        retentionPeriod: 31536000 // 365 días en segundos
      },
      iamConfiguration: {
        uniformBucketLevelAccess: {
          enabled: true
        },
        publicAccessPrevention: 'enforced'
      },
      versioning: {
        enabled: true
      }
    });
    console.log(`[D51 GCS] Bucket ${ALLOWED_GCS_BUCKET_NAME} creado exitosamente con WORM retention (365d, Unlocked).`);
  } else {
    console.log(`[D51 GCS] Bucket ${ALLOWED_GCS_BUCKET_NAME} verificado existente en GCS.`);
  }

  const [metadata] = await bucket.getMetadata();
  return {
    bucketName: ALLOWED_GCS_BUCKET_NAME,
    location: metadata.location,
    retentionPolicy: metadata.retentionPolicy,
    versioning: metadata.versioning,
    iamConfiguration: metadata.iamConfiguration
  };
}

/**
 * Escribe un objeto D51 Outbox en la bóveda WORM de GCS
 */
export async function writeOutboxToD51Vault(filename: string, content: string | Buffer): Promise<{
  filename: string;
  sha256: string;
  bytes: number;
  updatedAt: string;
  gcsPath: string;
}> {
  assertProductionTarget();
  assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

  const storage = getStorageClient();
  const bucket = storage.bucket(ALLOWED_GCS_BUCKET_NAME);
  const fileKey = `ca46_outbox/${filename}`;
  const file = bucket.file(fileKey);

  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  await file.save(buffer, {
    contentType: 'application/json',
    metadata: {
      metadata: {
        project: 'CA46',
        environment: 'production',
        purpose: 'D51_OUTBOX',
        sha256: sha256Hash,
        created_at: new Date().toISOString()
      }
    }
  });

  const [fileMetadata] = await file.getMetadata();

  return {
    filename,
    sha256: sha256Hash,
    bytes: buffer.length,
    updatedAt: fileMetadata.updated || new Date().toISOString(),
    gcsPath: `gs://${ALLOWED_GCS_BUCKET_NAME}/${fileKey}`
  };
}

/**
 * Lee y verifica la integridad de un objeto en la bóveda D51 GCS
 */
export async function verifyD51Object(filename: string): Promise<{
  exists: boolean;
  sha256Match: boolean;
  metadata: any;
  content: string;
}> {
  assertProductionTarget();
  assertGoogleTarget(ALLOWED_GCS_BUCKET_NAME, ALLOWED_GCS_REGION);

  const storage = getStorageClient();
  const bucket = storage.bucket(ALLOWED_GCS_BUCKET_NAME);
  const fileKey = `ca46_outbox/${filename}`;
  const file = bucket.file(fileKey);

  const [exists] = await file.exists();
  if (!exists) {
    return { exists: false, sha256Match: false, metadata: null, content: '' };
  }

  const [downloadedContent] = await file.download();
  const [metadata] = await file.getMetadata();
  const readHash = crypto.createHash('sha256').update(downloadedContent).digest('hex');
  const expectedHash = metadata.metadata?.sha256;

  return {
    exists: true,
    sha256Match: readHash === expectedHash,
    metadata,
    content: downloadedContent.toString('utf-8')
  };
}
