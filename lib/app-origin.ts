export function appOrigin(fallback?: string): string {
  const value = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || fallback || 'https://ca-46.vercel.app').trim();
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Origen público no válido.');
  return url.origin;
}
