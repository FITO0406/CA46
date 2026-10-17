// HTTP smoke test only. No login, cookies, customer data or authenticated writes.
// Run after `npm run build` and `npm run start`: node scripts/check-launch-pages.mjs
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3064';
const results = [];
for (const [path, heading] of [
  ['/aviso-legal', 'Aviso legal'], ['/condiciones', 'Condiciones del servicio CA46'],
  ['/privacidad', 'Política de privacidad'], ['/cookies', 'Cookies y almacenamiento'],
  ['/encargo-tratamiento', 'Encargo de tratamiento'], ['/soporte', 'Soporte y derechos'],
  ['/copias-y-restauracion', 'Copias, devolución y restauración'], ['/demo', 'Solicitar una demostración'],
  ['/aceptar-condiciones', 'Contrato de tu empresa'], ['/datos-y-solicitudes', 'Datos y solicitudes'],
]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes(heading), `Missing heading: ${path}`);
  results.push({ path, status: response.status });
}
for (const path of ['/pedir', '/pedidos', '/pantalla']) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  assert.equal(response.status, 307, path);
  assert.equal(new URL(response.headers.get('location'), base).pathname, '/');
  results.push({ path, status: response.status });
}
for (const [path, method] of [
  ['/api/company-export', 'GET'], ['/api/service-requests', 'GET'], ['/api/service-requests', 'POST'],
  ['/api/legal/acceptance', 'GET'], ['/api/legal/acceptance', 'POST'],
  ['/api/superadmin/service-requests', 'GET'], ['/api/superadmin/service-requests', 'PATCH'],
]) {
  const response = await fetch(new URL(path, base), { method });
  assert.equal(response.status, 401, `${method} ${path}`);
  assert.ok(response.headers.get('cache-control')?.includes('no-store'));
  results.push({ path, method, status: response.status });
}
console.log(JSON.stringify({ base, checks: results.length, results }, null, 2));
