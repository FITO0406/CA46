import Link from 'next/link';
import RegistrationForm from '@/components/RegistrationForm';
import { legalProfile } from '@/lib/legal-documents';
export const dynamic = 'force-dynamic';
export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
 if (!legalProfile().ready) return <main className="mx-auto max-w-xl space-y-5 p-8 text-slate-200"><h1 className="text-3xl font-black">Preparando las nuevas altas</h1><p>Estamos completando la documentación del servicio antes de abrir nuevos registros. Si quieres probar CA46, solicita una demostración.</p><Link href="/demo" className="block text-orange-300 underline">Solicitar demostración</Link><Link href="/acceso" className="block underline">Ya tengo cuenta</Link></main>;
 const { plan } = await searchParams;
 const initialPlan = ['gratis', 'autonomo', 'empresa', 'personalizado'].includes(plan || '') ? plan as 'gratis' | 'autonomo' | 'empresa' | 'personalizado' : 'gratis';
 return <RegistrationForm initialPlan={initialPlan} />;
}
