'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import type { LegalDocument } from '@/lib/legal-documents';
type Contract = { ready: boolean; accepted: boolean; canAccept: boolean; version: string; checksum: string; documents: LegalDocument[]; company: { legal_name: string; tax_id: string; address: string } | null };
export default function ContractAcceptance() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [terms, setTerms] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [representative, setRepresentative] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function token() { return (await supabase.auth.getSession()).data.session?.access_token || ''; }
  useEffect(() => { let mounted = true; void (async () => {
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Inicia sesión para revisar el contrato de tu empresa.');
      const response = await fetch('/api/legal/acceptance', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (mounted) setContract(body);
    } catch (error) { if (mounted) setMessage(error instanceof Error ? error.message : 'No se pudo consultar.'); }
  })(); return () => { mounted = false; }; }, []);
  async function accept() {
    if (!contract || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/legal/acceptance', { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: contract.version, checksum: contract.checksum, terms, processing, representative }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setContract({ ...contract, accepted: true }); setMessage(body.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!contract) return;
    const blob = new Blob([JSON.stringify(contract, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ca46-documentos-contractuales.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-200"><h1 className="text-3xl font-black">Contrato de tu empresa</h1>
    <p>El administrador acepta en representación de la empresa. La privacidad informa del tratamiento; no se solicita un consentimiento comercial.</p>
    <div className="flex flex-wrap gap-5 text-orange-300 underline"><Link href="/acceso">Acceso</Link><Link href="/datos-y-solicitudes">Datos, derechos o baja</Link><Link href="/soporte">Soporte</Link></div>
    {message && <p role="status" className="rounded-xl border p-4">{message}</p>}
    {contract && <><p>Versión {contract.version}</p>{!contract.ready && <p className="text-amber-300">Borrador pendiente de aprobación. La aceptación está desactivada.</p>}
      {contract.company && <p>Empresa representada: {contract.company.legal_name} · {contract.company.tax_id} · {contract.company.address}</p>}
      {contract.documents.map(document => <details key={document.slug} className="rounded-xl border border-white/20 p-4"><summary className="cursor-pointer font-bold">{document.title}</summary>{document.sections.map(section => <section key={section.title} className="mt-5 space-y-3"><h2 className="font-bold">{section.title}</h2>{section.paragraphs.map((paragraph, i) => <p key={i} className="leading-7">{paragraph}</p>)}</section>)}</details>)}
      <button onClick={download} className="rounded-xl border px-4 py-3">Guardar copia de los documentos</button>
      {contract.accepted ? <p className="text-emerald-300">La empresa ya tiene registrada esta versión. <a href="/mi-empresa" className="underline">Continuar a Mi empresa</a></p> : contract.canAccept && contract.ready ? <div className="space-y-4 rounded-xl border p-5">
        <label className="flex gap-3"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />He leído y acepto las condiciones SaaS.</label>
        <label className="flex gap-3"><input type="checkbox" checked={processing} onChange={e => setProcessing(e.target.checked)} />Acepto el encargo de tratamiento como anexo.</label>
        <label className="flex gap-3"><input type="checkbox" checked={representative} onChange={e => setRepresentative(e.target.checked)} />Tengo capacidad para representar a esta empresa.</label>
        <button onClick={() => void accept()} disabled={!terms || !processing || !representative || busy} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-black disabled:opacity-40">{busy ? 'Registrando…' : 'Registrar aceptación'}</button>
      </div> : <p>Debe aceptar el administrador de empresa con su correo confirmado y con razón social, NIF y domicilio completos. Puedes completarlos en <Link href="/mi-empresa" className="text-orange-300 underline">Mi empresa</Link>.</p>}</>}
  </main>;
}
