# CA46

Primera versión operativa de CA46 para trazabilidad alimentaria, etiquetado,
gestión de cocina y control de temperaturas.

## Desarrollo local

```bash
npm ci
npm run dev
```

La aplicación requiere Node.js 20 o superior y las variables de
`.env.example`. No se deben guardar secretos reales en el repositorio.

## Verificación antes de publicar

```bash
npm run lint
npm run build
```

## Despliegue

El repositorio está conectado al proyecto de Vercel de CA46. Los cambios en
la rama principal generan el despliegue de producción. Antes de activar pagos,
correo, Telegram o IA hay que completar sus variables y webhooks en Vercel.

Las migraciones versionadas de Supabase están en `supabase/migrations`.

## Alcance de la v1

- Acceso multiempresa y SuperAdmin.
- Etiquetado y publicación de pantallas.
- Cocina, conservación y control de equipos de frío.
- Configuración de empresa e integraciones preparadas.
- Facturación interna preparada; Stripe, correo y VERI*FACTU requieren las
  credenciales y proveedores reales antes de considerarse activos.
