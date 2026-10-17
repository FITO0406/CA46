import Link from 'next/link';
import { legalDocuments, legalProfile, LEGAL_VERSION } from '@/lib/legal-documents';
export default function LegalDocument({ slug }: { slug: string }) {
  const document = legalDocuments().find(item => item.slug === slug);
  if (!document) return null;
  const profile = legalProfile();
  return <main className="mx-auto max-w-3xl space-y-7 px-5 py-10 text-slate-200">
    <Link href="/" className="text-orange-300 underline">Volver a CA46</Link>
    <h1 className="text-3xl font-black">{document.title}</h1>
    <p className="text-sm text-slate-400">Versión {LEGAL_VERSION}</p>
    {!profile.ready && <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">Borrador pendiente de completar y aprobar. No se admiten nuevas aceptaciones contractuales con esta versión mientras falten los datos del prestador y su revisión.</p>}
    {document.sections.map(section => <section key={section.title} className="space-y-3"><h2 className="text-xl font-bold">{section.title}</h2>{section.paragraphs.map((paragraph, i) => <p key={i} className="leading-7">{paragraph}</p>)}</section>)}
    <p className="text-sm"><Link href="/soporte" className="text-orange-300 underline">Contacto, soporte y derechos</Link></p>
  </main>;
}
