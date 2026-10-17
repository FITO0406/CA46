import Link from 'next/link';
export default function Page() {
  return <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-200"><h1 className="text-3xl font-black">Copias, devolución y restauración</h1>
    <h2 className="text-xl font-bold">Tus archivos y tus datos</h2><p>Los documentos archivados en tu Google Drive permanecen en la cuenta que hayas conectado. La exportación operativa de CA46 descarga registros en JSON; no descarga los originales de Drive ni constituye una copia completa del servicio.</p>
    <h2 className="text-xl font-bold">Solicitar una devolución completa</h2><p>El administrador de empresa puede solicitar la devolución asistida, indicando el alcance y el periodo que necesita. Se comprobará su representación y se acordará un canal seguro. No se incluyen contraseñas ni credenciales de servicios externos.</p>
    <h2 className="text-xl font-bold">Restauración</h2><p>Si se ha perdido información, comunica el momento aproximado, la empresa y los registros afectados. Se estudiarán las copias disponibles y el alcance de la recuperación antes de realizar cambios. Una restauración puede afectar a información posterior al punto recuperado.</p>
    <h2 className="text-xl font-bold">Estado de preparación</h2><p>El procedimiento de copias y restauración está pendiente de validación operativa antes del lanzamiento. Todavía no se ofrece un plazo garantizado de recuperación ni se afirma que se haya realizado una restauración de prueba de producción.</p>
    <Link href="/datos-y-solicitudes" className="block text-orange-300 underline">Solicitar devolución o consultar una restauración</Link><Link href="/soporte" className="block underline">Contacto de soporte</Link>
  </main>;
}
