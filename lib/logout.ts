import { supabase } from '@/lib/supabaseClient';
import { ALLOWED_PRODUCTION_PROJECT_REF } from '@/lib/targetGuard';

// Account switching must finish even if the network or Auth client stalls.
// Only this project's credentials are removed; business data stays in Supabase.
export async function logoutAndRedirect(destination = '/acceso') {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, 5000); }),
    ]);
  } catch {
    // A failed revocation must not leave this browser logged into the old account.
  } finally {
    if (timeout) clearTimeout(timeout);
    const key = `sb-${ALLOWED_PRODUCTION_PROJECT_REF}-auth-token`;
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      try {
        for (const suffix of ['', '-code-verifier', '-user']) window[name].removeItem(`${key}${suffix}`);
      } catch { /* Some embedded browsers disable storage. Still return to login. */ }
    }
    window.location.replace(destination);
  }
}
