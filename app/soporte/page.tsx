import Link from 'next/link';
import { legalProfile } from '@/lib/legal-documents';
export default function SupportPage() {
  const {email} = legalProfile();
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-slate-200">
    <Link href="/" className="text-orange-300 underline">Volver a CA46</Link><h1 className="text-3xl font-black">Soporte y derechos sobre tus datos</h1>
    <p>Para problemas de acceso, funcionamiento, privacidad o baja del servicio puedes contactar con CA46. No envíes contraseñas, enlaces de invitación ni códigos de recuperación.</p>
    <p><a className="text-orange-300 underline" href={'mailto:'+email}>{email}</a></p>
    <Link className="inline-block rounded-xl bg-orange-500 px-5 py-3 font-bold text-black" href="/datos-y-solicitudes">Mis datos y solicitudes</Link>
    <p>Desde tu cuenta puedes registrar una solicitud y consultar su respuesta. El administrador de la empresa puede descargar los datos disponibles o solicitar la baja. Si no puedes entrar, utiliza el correo de contacto.</p>
    <h2 className="text-xl font-bold">Derechos y plazos</h2><p>Las solicitudes de protección de datos se atienden sin dilación indebida y, en general, en un mes; las ampliaciones justificadas se comunicarán conforme a la normativa. Las peticiones sobre datos de otra empresa se coordinan con su responsable. La descarga de datos de negocio y la portabilidad de datos personales son funciones diferentes.</p>
    <h2 className="text-xl font-bold">Incidencias y recuperación</h2><p>Describe lo ocurrido, la fecha y el módulo afectado sin adjuntar datos innecesarios. No existe un plazo de resolución garantizado ni soporte 24/7 salvo acuerdo expreso. La restauración de copias requiere revisión técnica y no se ejecuta automáticamente desde este formulario.</p>
    <Link href="/recuperar-clave" className="text-orange-300 underline">Recuperar contraseña</Link>
  </main>;
}
