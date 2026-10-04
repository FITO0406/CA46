import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Información sobre los datos tratados por CA46 y su conexión opcional con Google Drive.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#080b0d] px-5 py-10 text-slate-200 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8 text-base leading-7">
        <header className="space-y-4 border-b border-white/10 pb-8">
          <Link href="/" className="text-orange-300 underline underline-offset-4">← Volver a CA46</Link>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Política de privacidad de CA46</h1>
          <p className="text-sm text-slate-400">Última actualización: 4 de octubre de 2026</p>
          <p>CA46 es una aplicación de trazabilidad alimentaria para empresas. Esta página explica el tratamiento de los datos del servicio y, en particular, la conexión opcional con el Google Drive de cada empresa.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">1. Contacto y gestión de los datos</h2>
          <p>Para consultas de privacidad, acceso, rectificación o eliminación de datos, contacta con el equipo de CA46 en <a href="mailto:oriya.fbm@gmail.com" className="text-orange-300 underline underline-offset-4">oriya.fbm@gmail.com</a>. Identifica la empresa y la cuenta afectadas, sin enviar contraseñas ni códigos de autorización.</p>
          <p>La empresa cliente administra sus usuarios, los datos de su actividad y los permisos de sus documentos. CA46 trata esa información para prestar las funciones que la empresa utiliza.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">2. Información utilizada por el servicio</h2>
          <p>CA46 utiliza los datos de cuenta, correo electrónico, empresa, miembros y roles necesarios para identificar a los usuarios y gestionar sus accesos. También procesa los datos que la empresa introduce: productos, etiquetas, lotes, procedencias, facturas, transformaciones y registros de su actividad alimentaria.</p>
          <p>Cuando se utiliza el análisis de fotografías de facturas o etiquetas, la imagen y la información necesaria para extraer sus campos se envían al servicio de análisis de Google. Esta función es independiente de la autorización de Google Drive: conectar Drive no autoriza a analizar el resto de sus archivos.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">3. Conexión opcional con Google Drive</h2>
          <p>Un administrador de la empresa inicia la conexión, elige su cuenta en Google y autoriza los permisos. La contraseña de Google se introduce en Google; CA46 no la solicita ni la recibe.</p>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Correo de la cuenta de Google:</strong> se consulta y guarda para mostrar qué cuenta está conectada.</li>
            <li><strong>Archivos y carpetas:</strong> el permiso <code>drive.file</code> permite gestionar los archivos creados por CA46 o expresamente compartidos con la aplicación. No concede acceso general a todo el Drive.</li>
            <li><strong>Acceso sin presencia del usuario:</strong> se conserva un token de renovación cifrado para realizar el archivado mientras la conexión siga autorizada.</li>
          </ul>
          <p>La aplicación crea una carpeta «CA46 - [nombre de la empresa]», con las subcarpetas «Facturas», «Etiquetas» e «Histórico». El archivado genera y actualiza copias PDF de las etiquetas y su trazabilidad en «Histórico». CA46 consulta identificadores, nombres, ubicación y estado de esos archivos para comprobar el guardado y evitar duplicados.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">4. Finalidad y límites de uso</h2>
          <p>Los datos de Google se utilizan para identificar la cuenta conectada, preparar las carpetas y guardar o comprobar el histórico solicitado por la empresa. No se utilizan para publicidad, venta de datos ni entrenamiento de modelos de inteligencia artificial. La integración de Drive no envía sus archivos al análisis de imágenes.</p>
          <p>El uso y la transferencia de información recibida de las API de Google se ajustarán a la <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-orange-300 underline underline-offset-4">Política de Datos de Usuario de los Servicios API de Google</a>, incluidos sus requisitos de uso limitado.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">5. Almacenamiento, proveedores y acceso</h2>
          <p>CA46 utiliza Vercel para alojar la aplicación, Supabase para las cuentas y la base de datos, y Google para los servicios de análisis y Drive. Estos proveedores procesan la información necesaria para prestar esas funciones. Las comunicaciones utilizan HTTPS y el token de renovación de Drive se guarda cifrado en el servidor.</p>
          <p>La base de datos guarda el correo conectado, los identificadores y enlaces de las carpetas y archivos, el estado del archivado y el token cifrado, asociados a la empresa. Los PDF históricos se guardan en la cuenta de Drive elegida. La conexión no crea enlaces públicos ni comparte automáticamente esos documentos con otras empresas; los permisos que el titular configure en Google Drive también afectan a su acceso.</p>
          <p>El acceso operativo a los datos se limita a las funciones del servicio y a las tareas de soporte o seguridad necesarias. No vendemos los datos de Google ni los compartimos con plataformas publicitarias.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">6. Conservación y eliminación</h2>
          <p>Las etiquetas permanecen en CA46 durante su actividad y mientras sea necesario completar su archivado. Con Drive conectado, el proceso elimina las etiquetas vencidas del almacenamiento operativo solo después de confirmar su copia histórica final. Si el guardado falla, se conservan para reintentar.</p>
          <p>El correo, los datos de conexión y los metadatos de archivado se mantienen para gestionar la conexión y el servicio. Puedes solicitar su eliminación mediante el correo de contacto. La supresión se tramita tras comprobar que la solicitud corresponde al titular o a un administrador autorizado, teniendo en cuenta las obligaciones de conservación aplicables.</p>
          <p>Los archivos históricos en Google Drive permanecen bajo el control de la cuenta que los recibe. Revocar el permiso de CA46 o solicitar la eliminación de datos en CA46 no elimina automáticamente esos PDF; su titular puede gestionarlos o borrarlos directamente en Drive.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">7. Revocar la autorización y ejercer tus derechos</h2>
          <p>Puedes retirar el acceso de CA46 desde las conexiones de terceros de tu cuenta de Google. Al revocarlo, CA46 dejará de poder archivar con esa autorización. Para retirar también los datos de conexión guardados en CA46, escribe al correo de contacto.</p>
          <p>Puedes solicitar acceso, rectificación, supresión, limitación, oposición o portabilidad de tus datos cuando corresponda. Si la información pertenece a la actividad de una empresa cliente, dirígete también a su administrador. Puedes presentar una reclamación ante la Agencia Española de Protección de Datos.</p>
        </section>

        <section className="space-y-3 border-t border-white/10 pt-8">
          <h2 className="text-xl font-bold text-white">8. Cambios de esta política</h2>
          <p>Los cambios se publicarán en esta página con su fecha. Si cambia la finalidad del uso de los datos de Google o se necesitan permisos adicionales, se informará al usuario y se solicitará la autorización correspondiente antes de aplicar ese nuevo uso.</p>
        </section>
      </article>
    </main>
  );
}
