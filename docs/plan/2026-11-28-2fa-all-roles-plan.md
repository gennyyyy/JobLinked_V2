# 2FA for All Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every role (super-admin, employer, job-seeker) can enable/disable TOTP two-factor authentication from their own settings UI, and a 2FA user can sign in with either an authenticator code or a backup code.

**Architecture:** Frontend-only. The 2FA machinery already exists: Better Auth's `twoFactor` plugin (server-owned, `server/src/ba.js:37`), the shared role-agnostic `MfaPanel` component, and the login code step in `Login.jsx`. We (1) mount `MfaPanel` in employer and job-seeker Account Settings, and (2) add a backup-code branch to the login 2FA step plus a service function calling Better Auth's existing `/two-factor/verify-backup-code` endpoint.

**Tech Stack:** React (JavaScript/JSX — no TypeScript in this repo), Better Auth `twoFactorClient`, Vitest + Testing Library.

**Spec:** Bounded path — the approved in-chat design (2026-11-28) is the spec and is recorded below in Design Brief. Confirmed decisions from the user: 2FA stays **optional for all roles** (ADR-056 stands, no server-side aal gate), and **backup-code login is included**.

---

## Design Brief (approved)

- **What:** Employer and job-seeker get the same 2FA enrollment/disable UI super-admin already has (`MfaPanel`). Login's 2FA step gains a "use a backup code" mode so a user who loses their phone is not locked out.
- **How:** Mount the existing shared `MfaPanel` in each role's `AccountSettings` children; add `completeTwoFactorBackupCode` to `src/shared/services/auth.js` mirroring `completeTwoFactor`; add a `mfaMode` toggle to the `Login.jsx` 2FA screen.
- **Done-when:** All three roles can manage 2FA from their own settings; login succeeds with a TOTP or a backup code; `npm test` and `npm run lint` pass.
- **Out of scope:** Server-side enforcement / mandatory enrollment for any role (per user decision, ADR-056 unchanged); removing the dead `aal` field from `/auth/me`; the `docs/arch/tech-stack.md:19` Supabase-MFA doc drift; SMS/email OTP.

## Global Constraints

- JavaScript/JSX only. Match each file's existing import style: employer feature uses relative paths (`../../shared/components/...`), job-seeker uses the alias (`@/shared/...`).
- **No changes** to `server/`, `db/schema.sql`, or config files. No new dependencies.
- 2FA remains optional; no aal2 gating, no route protection changes.
- Error copy stays "Invalid code. Please try again." — `INVALID_BACKUP_CODE` is already mapped in `src/shared/services/auth.js:46-48`; do not add new codes.

## Review Focus

The five inputs most likely to bite a real user, each pinned by a test in its owning task:

1. **Backup codes are not 6-digit numeric** (Better Auth issues multi-character codes): in backup mode the input must drop `inputMode="numeric"`, raise `maxLength` 6 → 24, and Verify must enable at ≥ 6 chars. Test: Task 2 types an 8+ char code.
2. **TOTP mode must still require exactly 6 digits** — the backup branch must not loosen the TOTP check. Test: all five existing tests in `Login.mfa.test.jsx` keep passing (Task 2 step 4).
3. **Cancel must reset `mfaMode` to `'totp'`** — a stale backup mode after cancel silently changes the next user's code step. Test: Task 2's cancel test.
4. **`INVALID_BACKUP_CODE` surfaces the shared invalid-code message** — never a raw BA error. Tests: Task 1 (service) and Task 2 (UI shows `role="alert"`).
5. **`AccountSettings.jsx` itself must NOT render `MfaPanel`** — super-admin's `Settings.jsx:235` also embeds that component and would show a duplicate panel. No test; hard constraint on Task 3.

---

### Task 1: `completeTwoFactorBackupCode` service function

**Files:**
- Modify: `src/test/authClientMock.js:29` (spy), `:54-56` (reset), `:65-67` (default)
- Modify: `src/shared/services/auth.js` (new export directly after `completeTwoFactor`, ends line 173)
- Test: `src/shared/services/__tests__/auth.test.js` (new `describe` block after the `completeTwoFactor` block, ends line 203)

**Interfaces:**
- Consumes: `authClient.twoFactor.verifyBackupCode({ code })` — Better Auth two-factor client plugin, maps to `POST /two-factor/verify-backup-code` (confirmed in `node_modules/better-auth/dist/plugins/two-factor/client.mjs:22`).
- Produces: `completeTwoFactorBackupCode(code: string) → Promise<profile>` — identical contract to `completeTwoFactor` (`auth.js:162-173`): resolves the signed-in user's merged profile, throws via `friendlyAuthError` on failure.

- [ ] **Step 1: Add the `verifyBackupCode` spy to the shared mock seam**

In `src/test/authClientMock.js`:
- Line 29 → `twoFactor: { enable: vi.fn(), disable: vi.fn(), verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },`
- In `resetAuthClient()`, add `authClientMock.twoFactor.verifyBackupCode.mockReset();` next to line 56 and `authClientMock.twoFactor.verifyBackupCode.mockResolvedValue({ data: { status: true }, error: null });` next to line 67.

- [ ] **Step 2: Write the failing tests**

In `src/shared/services/__tests__/auth.test.js`, add after the `completeTwoFactor` describe (line 203), reusing the file's existing `signedIn` helper and `profile` fixture, and add `completeTwoFactorBackupCode` to the existing import from `'../auth'`:

```js
describe('completeTwoFactorBackupCode', () => {
  it('verifies the backup code then resolves the session profile', async () => {
    authClientMock.twoFactor.verifyBackupCode.mockResolvedValue({ data: { token: 'x' }, error: null })
    signedIn({ id: 'u1', email: 'test@test.com' })
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1', email: 'test@test.com' } } })
    api.get.mockResolvedValue(profile)

    await expect(completeTwoFactorBackupCode('abcd1234efgh')).resolves.toMatchObject({ id: 'u1', role: 'job-seeker' })
    expect(authClientMock.twoFactor.verifyBackupCode).toHaveBeenCalledWith({ code: 'abcd1234efgh' })
    expect(setApiIdentity).toHaveBeenCalledWith('u1')
  })

  it('maps an invalid backup code to the shared invalid-code message', async () => {
    authClientMock.twoFactor.verifyBackupCode.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_BACKUP_CODE', message: 'Invalid backup code', status: 401 },
    })

    await expect(completeTwoFactorBackupCode('wrong-code')).rejects.toThrow('Invalid code. Please try again.')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/shared/services/__tests__/auth.test.js`
Expected: FAIL — `completeTwoFactorBackupCode` is not exported / not a function.

- [ ] **Step 4: Implement in `src/shared/services/auth.js`** (after line 173, mirroring `completeTwoFactor` exactly apart from the endpoint)

```js
// Backup-code variant of the login challenge: same contract, different BA endpoint.
export async function completeTwoFactorBackupCode(code) {
  let result;
  try {
    result = await authClient.twoFactor.verifyBackupCode({ code });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
  const user = (await sessionUser()) || result.data?.user;
  if (!user) throw new Error('We couldn\u2019t finish signing you in. Please try again.');
  return profileFor(user);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/shared/services/__tests__/auth.test.js`
Expected: PASS — all tests, including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/auth.js src/shared/services/__tests__/auth.test.js src/test/authClientMock.js
git commit -m "feat(auth): backup-code verify service function"
```

---

### Task 2: Backup-code login UI on the 2FA step

**Files:**
- Modify: `src/features/auth/Login.jsx` (state ~lines 32-35; `handleVerifyMfa` ~86-103; `handleCancelMfa` ~105-111; 2FA screen JSX 113-141; import line 7)
- Modify: `src/features/auth/__tests__/Login.mfa.test.jsx` (extend the existing `describe`)

**Interfaces:**
- Consumes: `completeTwoFactorBackupCode(code)` from Task 1.
- Produces: the login 2FA step accepts either a 6-digit TOTP or a backup code (free text, up to 24 chars), switched by a visible toggle.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('Login MFA')` block in `src/features/auth/__tests__/Login.mfa.test.jsx`, following the file's existing client-mock pattern:

```jsx
it('accepts a backup code instead of a TOTP code', async () => {
  authClientMock.signIn.email.mockResolvedValue({
    data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
    error: null,
  })
  authClientMock.twoFactor.verifyBackupCode.mockResolvedValue({ data: { token: 'session' }, error: null })
  const authenticate = vi.fn()
  useAuth.mockReturnValue({ user: null, authenticate })
  renderLogin()
  await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await screen.findByLabelText(/verification code/i)
  await userEvent.click(screen.getByRole('button', { name: /use a backup code/i }))
  const input = screen.getByLabelText(/backup code/i)
  await userEvent.type(input, 'abcd1234efgh')
  await userEvent.click(screen.getByRole('button', { name: /verify/i }))

  await waitFor(() => expect(authClientMock.twoFactor.verifyBackupCode).toHaveBeenCalledWith({ code: 'abcd1234efgh' }))
  expect(await screen.findByText('employer home')).toBeInTheDocument()
})

it('returns to authenticator mode after cancel', async () => {
  authClientMock.signIn.email.mockResolvedValue({
    data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
    error: null,
  })
  renderLogin()
  await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
  await screen.findByLabelText(/verification code/i)

  await userEvent.click(screen.getByRole('button', { name: /use a backup code/i }))
  expect(screen.getByLabelText(/backup code/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
  await screen.findByLabelText(/email/i)

  // Sign in again: the code step must be back in TOTP mode.
  await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
  expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /use a backup code/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/auth/__tests__/Login.mfa.test.jsx`
Expected: FAIL — no button named "use a backup code" exists yet.

- [ ] **Step 3: Implement in `src/features/auth/Login.jsx`**

- Import (line 7): add `completeTwoFactorBackupCode` alongside `completeTwoFactor`.
- State (near line 35): `const [mfaMode, setMfaMode] = useState('totp')`.
- `handleVerifyMfa` (line 86): guard becomes `if (mfaMode === 'totp' ? mfaCode.length !== 6 : mfaCode.length < 6) return`, and the verify call becomes `mfaMode === 'totp' ? completeTwoFactor(mfaCode) : completeTwoFactorBackupCode(mfaCode)`.
- `handleCancelMfa` (line 105): add `setMfaMode('totp')` so the next attempt starts in authenticator mode.
- 2FA screen JSX (lines 116-135), branch the TextField on `mfaMode`:
  - TOTP: label "Verification code", `inputMode="numeric"`, `maxLength={6}` (unchanged — existing tests depend on this).
  - Backup: label "Backup code", no `inputMode`, `maxLength={24}`.
- Verify button disabled logic: `mfaLoading || (mfaMode === 'totp' ? mfaCode.length !== 6 : mfaCode.length < 6)`.
- Below the Verify/Cancel row: a `type="button"` `variant="link"` Button, disabled while `mfaLoading`, labeled "Use a backup code instead" in TOTP mode and "Use an authenticator app code" in backup mode. On click: flip `mfaMode`, clear `mfaCode` and `mfaError`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/auth/__tests__/Login.mfa.test.jsx`
Expected: PASS — all 7 tests (5 existing + 2 new). The 5 existing passing is the Review-Focus #2 pin.

- [ ] **Step 5: Full suite + lint**

Run: `npm test` and `npm run lint`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/Login.jsx src/features/auth/__tests__/Login.mfa.test.jsx
git commit -m "feat(auth): backup-code login on the 2FA step"
```

---

### Task 3: Mount `MfaPanel` for employer and job-seeker

**Files:**
- Modify: `src/features/employer/CompanyProfile.jsx:505-507` + import (relative style, per line 11)
- Modify: `src/features/job-seeker/Profile.jsx:852-854` + import (alias style, per line 26)

**Interfaces:**
- Consumes: `MfaPanel` — default export, takes no props (`src/shared/components/MfaPanel.jsx`), already proven for any logged-in user (super-admin mounts it bare in `Profile.jsx:120`).
- Produces: visible 2FA enrollment/disable panel in both roles' Account tab.

**Constraint (Review Focus #5):** Do NOT add `MfaPanel` inside `AccountSettings.jsx` itself — super-admin's `Settings.jsx:235` also embeds that component and would show a duplicate panel.

- [ ] **Step 1: Add the import and mount in both files**

Employer (`src/features/employer/CompanyProfile.jsx`) — relative import matching line 11, and inside the `account` tab (lines 505-507):

```jsx
import MfaPanel from "../../shared/components/MfaPanel";
```

Job-seeker (`src/features/job-seeker/Profile.jsx`) — alias import matching line 26, inside the `account` tab (lines 852-854):

```jsx
import MfaPanel from '@/shared/components/MfaPanel'
```

In both, `<MfaPanel />` goes directly below `<ChangePassword embedded />` inside the `AccountSettings` children.

- [ ] **Step 2: Suite + lint**

Run: `npm test` and `npm run lint`
Expected: PASS, no regressions.

- [ ] **Step 3: Manual end-to-end check**

Per the dev-server rules: probe the port first (`curl.exe -s -o NUL -w "%{http_code}" http://localhost:5173/`); reuse a listening server, start `npm run dev` only if nothing responds.

- Sign in as employer → Profile → Account tab: "Two-factor authentication" panel present; enable flow shows QR (scannable by Google Authenticator — standard TOTP), verify code, backup codes shown once; disable is password-gated.
- Sign in as job-seeker → Profile → Account tab: same panel present.
- Sign in as super-admin → Settings: **exactly one** 2FA-related surface (their Profile security tab; Settings must not show one from this change).
- Sign out, sign in as the 2FA-enabled user: code step appears; "Use a backup code instead" accepts an enrollment backup code and lands on the portal.

- [ ] **Step 4: Commit**

```bash
git add src/features/employer/CompanyProfile.jsx src/features/job-seeker/Profile.jsx
git commit -m "feat(auth): show MFA panel in employer and job-seeker account settings"
```
