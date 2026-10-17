# CA46 — preparación y operación del piloto

Estado: versión de revisión. No equivale a autorización de publicación ni a una certificación de cumplimiento. No se han aplicado migraciones ni escrito datos en producción durante esta preparación.

## Decisiones confirmadas

- Marca CA46; titulares indicados: Felipe Sánchez Romero y María Rosario Vicente Galán.
- El prestador fiscal del SaaS se decidirá después (confirmado por el propietario el 17 de octubre de 2026). No confundir titularidad intelectual, titular del dominio y prestador del servicio.
- Piloto gratuito. Plan base gratuito y cortesías superiores gestionadas por SuperAdmin, por 15 días, hasta una fecha o indefinidamente hasta retirarlas. Al vencer, vuelve el plan base; no empieza un cargo ni se borran datos por este cambio.
- Demo: solicitud por correo → contacto con Fito → alta y confirmación del cliente → concesión manual. La página prepara el correo; el usuario debe enviarlo. No es un sistema de recepción automática.
- Stripe y balanza quedan fuera de activación inicial. La tienda, pedidos y recogida permanecen conservados en componentes; sus rutas se redirigen temporalmente al inicio antes de montar los layouts.

## Qué incorpora esta rama

| Área | Implementación | Límite real |
|---|---|---|
| Aviso legal, términos, privacidad, almacenamiento y encargo | Páginas y documentos versionados | Borradores hasta completar y aprobar datos verificables |
| Aceptación | Administrador confirmado, representante, texto del servidor, SHA-256, empresa y fecha | No firma un empleado por su empresa; exige razón social/NIF/domicilio del cliente |
| Historial contractual | Registros sin permisos de actualización ni borrado para el rol de servicio | La conservación/supresión de evidencias debe tener política y procedimiento privilegiado |
| Nuevas altas | Plan gratuito en servidor y trigger; interfaz cerrada si falta aprobación legal | La configuración de signup público de Supabase debe verificarse; el cierre visual no desactiva su API |
| Piloto | Checkout desactivado salvo habilitación explícita; cortesía 15 días calculada en servidor | No sustituye una auditoría de cuotas y funciones de todos los módulos |
| Datos y derechos | Área propia, justificantes, seguimiento y plazo de referencia de un mes natural | No presupone que toda solicitud deba estimarse o que el derecho siempre sea portabilidad |
| Baja y restauración | Solicitudes manuales con revisión; no borrado ni restauración automática | Hay que verificar representación, datos a devolver y deberes de conservación |
| Exportación | JSON paginado de empresa, configuración sin tokens, miembros, etiquetas completas, cocina, temperaturas, referencias Drive | No incluye originales externos, facturación, IA ni jobs OCR. No es backup ni snapshot transaccional |
| Soporte | Correo y bandeja SuperAdmin; respuestas visibles al solicitante | Sin correo automático, notificaciones push, atención 24/7 o SLA prometido |
| Seguridad del cambio | Visor público con proyección de campos que excluye comprador, factura, identificadores fiscales privados y referencias de fichero; datos de empresa/rol derivados del servidor; nuevas tablas sin permisos anon/authenticated; RPC restringidas | Se debe contrastar toda la seguridad de la instalación real antes de producción |

## Configuración y orden de activación

1. Completar `CA46_LEGAL_NAME`, `CA46_LEGAL_TAX_ID`, `CA46_LEGAL_ADDRESS`, datos registrales cuando apliquen, contacto, política de conservación y garantías de transferencias. Validar contratos de proveedores, medidas y subencargados. No introducir secretos en estas variables ni en Git.
2. Revisar y aprobar los textos con datos reales. La variable `CA46_LEGAL_APPROVED=true` es una confirmación operativa, no una revisión jurídica automática.
3. Preparar un entorno de prueba aislado. **Bloqueo existente:** `lib/targetGuard.ts`, `lib/supabase.ts` y `lib/supabaseClient.ts` fijan producción y rechazan staging. Una Preview de Vercel no crea por sí sola una base aislada. Esta rama conserva esa protección; no probar operaciones autenticadas de escritura en una Preview que apunte a producción.
4. Probar allí la migración `20261017184533_launch_legal_and_service_requests.sql` y los permisos; probar aceptación, alta manipulada, roles, dos empresas, exportación y solicitudes. PGlite comprueba SQL/PLpgSQL de esta migración con fixtures; no replica toda la instalación Supabase.
5. Antes de aplicar en producción: disponer de copia recuperable verificada, revisar los grants actuales y el impacto de revocar el UPDATE directo de `companies` a `authenticated`. El código de configuración usa `supabaseAdmin` y mantiene su ruta; otros clientes externos deberán revisarse.
6. Aplicar migración, verificar privilegios/RLS y las RPC de esta versión. No repetir migraciones antiguas ni ejecutar `db reset` en el proyecto real. No hay backfill que cambie los planes de empresas existentes.
7. Publicar la versión revisada con `CA46_BILLING_ENABLED=false`. Activar `CA46_REQUIRE_LEGAL_ACCEPTANCE=true` cuando los documentos y la migración estén verificados. Mi empresa permite completar datos fiscales; las operaciones ordinarias que usan tenant/billing guard exigen aceptación. Datos/derechos/soporte permanecen accesibles sin depender del estado comercial. El gate visual conserva una caché de hasta 60 segundos; la autorización de las API se comprueba en servidor.
8. Validar las rutas que no utilizan esos guards por separado: callbacks OAuth, visor público, webhooks, cron y otras integraciones tienen mecanismos propios. No se afirma que el nuevo contrato gate envuelva cualquier ruta imaginable.
9. Realizar la prueba de aceptación del propietario y registrar resultado/fecha antes de abrir nuevos registros.

## Procedimiento de derechos, soporte y baja

- Revisar la bandeja `/superadmin/solicitudes` diariamente durante el piloto; la interfaz no tiene avisos automáticos. La solicitud se recibe al devolver justificante y fecha; un error no acredita recepción. Hay alternativa de contacto por correo.
- El usuario consulta sus últimas 100 solicitudes. SuperAdmin consulta hasta 200 abiertas/en revisión, ordenadas por recepción; el archivo completo permanece en base con acceso autorizado. Las actuaciones se registran mediante RPC transaccional y eventos append-only.
- Derechos: comprobar identidad de forma proporcionada; identificar responsable (prestador o empresa cliente) y alcance. Registrar fechas, actuaciones, respuesta, motivo legal y medio de comunicación. El campo `due_at` es un mes natural de referencia, no una decisión jurídica. Una ampliación requiere motivos y comunicación en plazo; no basta cambiar el estado.
- Baja: verificar representante, ofrecer devolución, acordar fecha efectiva, retirar accesos/conexiones cuando proceda, identificar conservación obligatoria y registrar resultado. No eliminar en cascada trazabilidad, evidencias o archivos compartidos sin evaluar dependencia y autorización.
- Exportación asistida: inventariar tablas y ficheros de esa empresa; incorporar facturación, conversaciones/acciones y OCR cuando proceda; excluir secretos y datos de otras empresas. Entregar por canal seguro y temporal. Registrar manifest, totales, límites, recepción y borrado de temporales. El JSON básico no constituye devolución completa universal.
- No marcar resuelta una solicitud solo para vaciar la bandeja. Escribir una respuesta comprensible. El estado no ejecuta la actuación descrita ni envía un correo.

## Copias y restauración: procedimiento pendiente de ejecutar

No se ha acreditado el plan de backups/PITR contratado ni una restauración de CA46. No hay objetivo RPO/RTO aprobado. Antes de anunciarlos, documentar alcance, frecuencia, ubicación, cifrado, acceso, retención y responsable.

1. Inventariar base de datos, Auth, objetos Storage si se usan, documentos de Drive, configuración de Vercel, secretos/OAuth y código. Una copia de la base no recupera automáticamente todos los objetos o autorizaciones externas.
2. Verificar capacidades y última copia en el panel del proveedor, preparar copia lógica/física según plan, protegerla y comprobar integridad. No exponer claves ni reutilizar las de producción en staging.
3. Restaurar en un proyecto aislado sin correo, cron, Stripe, OCR/IA ni archivado reales. Usar usuarios sintéticos y conexiones desactivadas.
4. Comparar recuentos por empresa, relaciones padre/hijo, estados/anulaciones, temperaturas y acciones correctivas, miembros/roles y referencias Drive. Confirmar aislamiento de dos empresas, login de prueba y existencia de documentos externos requeridos.
5. Medir tiempo y pérdida potencial; documentar resultado, incidencias y recuperación posible. Aprobar RPO/RTO solo con evidencia. La prueba de la migración en PGlite no es esta restauración.
6. Antes de restaurar producción: valorar impacto en datos posteriores, autorización del alcance, copia previa, ventana y rollback. Ejecutar con supervisión y verificar resultados antes de reabrir.

## Registro de tratamientos y proveedores — tareas previas a aprobación

Crear un registro operativo con, por tratamiento: responsable/encargado, finalidad, base, interesados, categorías de datos, destinatarios/subencargados, ubicación, transferencias/garantías, conservación, medidas, canal de derechos y responsable interno. Completar como mínimo cuentas/contactos, datos de actividad y documentos, empleados, OAuth, OCR, Director IA, solicitudes/auditoría y futura facturación.

| Proveedor | Finalidad observada | Evidencia pendiente |
|---|---|---|
| Vercel | Alojamiento, funciones, logs | Contrato/DPA, regiones de ejecución/logs, acceso y retención |
| Supabase | Auth, PostgreSQL | DPA, región real, backup/PITR, políticas, logs y conservación |
| Google | OAuth Drive y análisis de imágenes | Scopes efectivos, condiciones OCR, cuentas/carpeta por empresa, garantías y retención |
| OpenAI | Director cuando se invoca IA | Cuenta/proyecto, contrato, datos enviados, retención y controles reales |
| Stripe/servicio de correo | Preparación futura | Revisar antes de activar; no tratarlo como operativo por tener código |

No es necesario inventar un "registro del proyecto en la AEPD" como trámite sustitutorio del cumplimiento. Deben cumplirse las obligaciones que correspondan al tratamiento real y conservar evidencias.

## Conservación y brechas

- Aprobar plazos por categoría: datos activos/trazabilidad alimentaria según producto y obligaciones aplicables; cuentas cerradas; soporte/derechos; documentos fiscales futuros; evidencias de contrato; logs; borradores; backups y terceros. Exposición de 24/72 h e historial de recuperación de 15 días no son un calendario legal de eliminación.
- Documentar qué queda bloqueado por obligaciones legales y cuándo se purga. Los FK `restrict` protegen evidencias contra borrado accidental; no impiden un procedimiento autorizado de supresión tras evaluar conservación.
- Ante una brecha: contener, conservar evidencias, identificar empresas/datos/fechas, evaluar riesgo y coordinar responsable/encargado. El encargado informa al responsable sin dilación indebida. Cuando corresponda notificar a la autoridad, aplicar el plazo legal de 72 h desde conocimiento, documentando excepciones/retrasos; valorar comunicación a afectados en alto riesgo. No esperar a tener una investigación perfecta para avisar al responsable.
- Contactos, suplente, canal de emergencia y decisiones de notificación deben quedar asignados antes del lanzamiento.

## Cookies y dispositivo

No se ha añadido analítica ni publicidad. Se informa de localStorage y de borradores IndexedDB. La revisión de código no acredita el tráfico efectivo del despliegue: comprobar escritorio/móvil sin sesión y con sesión, proveedores, cookies, almacenamiento y posibles scripts añadidos por plataforma. Si hay tecnología no exenta, bloquearla hasta elección y ofrecer aceptar/rechazar con la misma facilidad. No añadir un banner meramente decorativo.

## ca46.net y migración de dominio

Objetivo: `https://ca46.net` en el proyecto Vercel `ca-46`. No se ha comprado ni reservado. Comprobar disponibilidad y presupuesto vigente antes de cobrar. Confirmar titular/contacto registral, correo operativo, pago y condiciones de renovación. Conservar justificante y control de la cuenta.

- Registrar el dominio; conectarlo a ese proyecto; verificar DNS, propiedad y TLS; decidir `www`/dominio canónico y redirecciones tras verificar que no rompen callbacks.
- Fijar `NEXT_PUBLIC_APP_URL=https://ca46.net` y reconstruir. No copiar valores secretos al navegador. No añadir el dominio a producción antes de decidir qué versión se publica.
- Supabase Auth: Site URL y lista de redirecciones para confirmación, recuperación e invitaciones del dominio; mantener la URL anterior durante transición si es necesario. Evitar comodines de producción amplios.
- Google OAuth: añadir/verificar callback exacto del nuevo dominio en Google Cloud; comprobar estado, scopes, consentimiento y revocación por empresa. No rotar tokens de otras empresas innecesariamente.
- Verificar enlaces de invitación y de recuperar clave. No enviar invitaciones reales en pruebas sin autorización. Las contraseñas existentes no cambian al añadir dominio si se conserva el mismo Auth; localStorage es por origen y puede exigir iniciar sesión otra vez.
- Probar visor público y URLs compartidas sin exponer tokens en informes. Comprar el dominio no registra la marca ni patenta el proceso.
- Rollback de código: volver al deployment previo; no eliminar las tablas aditivas con evidencias. Si se revierte a código antiguo, no reabrir altas que vuelvan a aceptar planes de metadata sin revisar el trigger. El rollback no garantiza revertir cambios de datos.

## Verificación y límites

Comprobación HTTP de páginas y respuestas sin autorización: `node scripts/check-launch-pages.mjs http://127.0.0.1:3065` con el servidor iniciado en ese puerto. Esta prueba no sustituye una revisión visual ni autenticada.

Ejecutar `node --test tests/*.test.mjs`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`. Los tests nuevos cubren empresa ligada al servidor, datos exportados sin secretos, paginación/límites, mes natural, borradores sin aceptación, checksum/texto del servidor, privilegios SQL, cuota de solicitudes y alta gratuita. PGlite es dependencia solo de desarrollo.

Falta prueba autenticada completa en Supabase aislado y aceptación con datos legales reales, prueba real de backups/restore, tráfico cookies, correo de confirmación/recuperación en nuevo dominio, Drive/OCR/visor/cocina/temperaturas con dos empresas y carga representativa. No se ha demostrado capacidad de 1.000 empresas ni ausencia universal de vulnerabilidades.

Referencias primarias para revisión jurídica: LSSI (BOE, Ley 34/2002, artículos 10 y 27–28); RGPD (Reglamento UE 2016/679, artículos 12–22, 28, 30, 32–34 y capítulo V); guías AEPD de cookies, encargo de tratamiento y gestión de brechas. Aplicar las versiones vigentes y las circunstancias concretas, sin convertir los borradores en dictamen jurídico.
