import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('check') !== 'ca46-check-9f6b2d7a4c') return NextResponse.json({ ok: false }, { status: 404 });
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.OPENAI_MODEL || 'gpt-5-mini').trim();
  if (!key) return NextResponse.json({ ok: false, configured: false });
  try {
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: 'Responde solo OK', max_output_tokens: 16 }), signal: AbortSignal.timeout(30000) });
    return NextResponse.json({ ok: response.ok, configured: true, reachable: response.status !== 401, status: response.status });
  } catch { return NextResponse.json({ ok: false, configured: true, reachable: false, status: 0 }); }
}
