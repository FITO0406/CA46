import Link from 'next/link';
import { legalProfile } from '@/lib/legal-documents';
export default function DemoPage() {
  const {email}=legalProfile();
  const subject=encodeURIComponent('Solicitud de demostración CA46');
  const body=encodeURIComponent('Hola, quiero conocer CA46.\n\nNombre de contacto:\nEmpresa:\nTeléfono (opcional):\nQué necesito resolver:\n\nNo incluyo contraseñas ni documentación de clientes.');
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-12 text-slate-200"><Link href="/" className="text-orange-300 underline">Volver a CA46</Link><h1 className="text-3xl font-black">Solicitar una demostración</h1><p>Conoce cómo CA46 ayuda a gestionar etiquetas y trazabilidad. Contactaremos contigo para organizar la demostración y, si procede, activar una prueba de 15 días.</p><a href={'mailto:'+email+'?subject='+subject+'&body='+body} className="inline-block rounded-xl bg-orange-500 px-5 py-3 font-black text-black">Preparar correo de solicitud</a><p>Se abrirá tu aplicación de correo: revisa y envía el mensaje para completar la solicitud. Pulsar el botón no crea una empresa ni activa una suscripción.</p><p>Durante el piloto no se solicita tarjeta ni se cobra al terminar una prueba. Las ampliaciones y cortesías las concede CA46. Los datos de contacto se utilizan para atender la solicitud; consulta la <Link href="/privacidad" className="text-orange-300 underline">política de privacidad</Link>.</p><p>Si no se abre el correo, escribe a <a className="text-orange-300 underline" href={'mailto:'+email}>{email}</a>.</p></main>;
}
