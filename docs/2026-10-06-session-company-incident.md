# Company access incident — 6 October 2026

## Evidence

Production Supabase `xcjhqyjqakknnfbjxlui` retains both active companies,
their administrator memberships, settings, four Auth users and 15 current tags.
The most recently refreshed session at 02:36 UTC belongs to the global
administrator, who has no company membership. Production requests around
02:43–02:44 UTC returned 200 for `/api/tenant/me` and `/api/tenant/settings`,
but 409 for `/api/company-drive/status`. This matches a valid account without
a company membership, rather than deleted company data.

## Flow and corrections

- `/acceso` and private gates share the production Supabase browser session.
- `/api/tenant/me` authenticates the token, resolves the active membership and
  company, and now distinguishes a global administrator from an unlinked signup.
- `PrivateAreaGate` blocks company onboarding for a global administrator and
  offers the global dashboard or an explicit account switch. It displays the
  current account on small screens as well as desktop.
- Logout previously awaited default global sign-out without checking its result
  or redirecting. `logoutAndRedirect` uses current-session sign-out, a five-second
  deadline, project-specific credential cleanup and a full navigation to login.
  It does not claim to revoke access tokens immediately or delete business data.
- Auth listeners defer validation to avoid nested Auth calls during notification.
- A failed company/settings lookup now shows an error and retry action instead
  of presenting an activation form or editable empty settings.
- The existing lockfile contained a truncation warning and was invalid JSON.
  It is regenerated, Supabase is pinned at the existing requested version
  2.105.2, and reproducible `npm ci` is checked.

## Validation

- Production database read confirms both administrators and settings are intact.
- Production build and TypeScript checks pass.
- Existing employee isolation, OCR and kitchen tests pass.
- Added API tests cover both company administrators, global administrator,
  new signup, database failure and invalid session.
- Added logout tests cover success, rejection, returned errors and a stalled call.
- Mounted React tests cover global administrator blocking, account switching,
  company content, failed queries and signed-out login.
- Scoped ESLint has no errors; existing warnings remain.
- Browser verification could not run: browser download failed in the execution
  environment. No claim of a live password login or mobile browser test is made.

No company, membership, password, plan or stored business record is modified
by this recovery. Each company continues to use its own administrator account.
