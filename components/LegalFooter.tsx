'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [['Aviso legal','/aviso-legal'],['Condiciones','/condiciones'],['Privacidad','/privacidad'],['Almacenamiento','/cookies'],['Encargo de tratamiento','/encargo-tratamiento'],['Copias y restauración','/copias-y-restauracion'],['Soporte y derechos','/soporte']];
export default function LegalFooter() {
  const pathname = usePathname();
  if (pathname === '/etiquetas') return null;
  return <footer className="border-t border-white/10 px-5 py-6 pb-28 text-center text-xs text-slate-400 print:hidden"><nav aria-label="Información legal y soporte" className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-5 gap-y-3">{links.map(([label,href]) => <Link key={href} href={href} className="underline underline-offset-4 hover:text-orange-300">{label}</Link>)}</nav></footer>;
}
