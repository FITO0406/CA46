import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { google } from 'googleapis';

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const DRIVE_OAUTH_STATE_SECRET = process.env.DRIVE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const DRIVE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

type DriveOAuthState = {
  companyId: string;
  userId: string;
  nonce: string;
  iat: number;
};

function base64url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signature(payload: string) {
  if (!DRIVE_OAUTH_STATE_SECRET) throw new Error('Falta DRIVE_OAUTH_STATE_SECRET.');
  return createHmac('sha256', DRIVE_OAUTH_STATE_SECRET).update(payload).digest('base64url');
}

export function driveOAuthConfigured() {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && DRIVE_OAUTH_STATE_SECRET);
}

export function assertDriveOAuthConfigured() {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Falta configurar GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en Vercel.');
  }
  if (!DRIVE_OAUTH_STATE_SECRET) {
    throw new Error('Falta configurar DRIVE_OAUTH_STATE_SECRET en Vercel.');
  }
}

export function driveOAuthClient(origin?: string) {
  assertDriveOAuthConfigured();
  const redirectUri = origin ? `${origin.replace(/\/$/, '')}/api/company-drive/callback` : undefined;
  return new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, redirectUri);
}

export function createDriveOAuthState(companyId: string, userId: string) {
  const state: DriveOAuthState = {
    companyId,
    userId,
    nonce: randomBytes(18).toString('hex'),
    iat: Date.now(),
  };
  const payload = base64url(JSON.stringify(state));
  return `${payload}.${signature(payload)}`;
}

export function verifyDriveOAuthState(value: string): DriveOAuthState {
  const [payload, providedSignature] = String(value || '').split('.');
  if (!payload || !providedSignature) throw new Error('Estado de Google Drive no válido.');

  const expectedSignature = signature(payload);
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('Estado de Google Drive no válido.');
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DriveOAuthState;
  if (!decoded.companyId || !decoded.userId || !decoded.iat) throw new Error('Estado de Google Drive incompleto.');
  if (Date.now() - Number(decoded.iat) > 10 * 60 * 1000) throw new Error('La conexión con Google Drive ha caducado. Repite el proceso.');
  return decoded;
}
