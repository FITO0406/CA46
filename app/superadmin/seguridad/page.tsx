import AccountSecurity from '@/components/AccountSecurity';

export default function SuperAdminSeguridadPage() {
  return <AccountSecurity mode="superadmin" backHref="/superadmin" backLabel="SuperAdmin" />;
}
