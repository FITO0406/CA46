const employeeOperations = new Set([
  'POST /api/analyze-invoice',
  'POST /api/analyze-physical-label',
  'POST /api/publish-labels',
]);

export function employeeOperationAllowed(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  return employeeOperations.has(`${request.method.toUpperCase()} ${path}`);
}
