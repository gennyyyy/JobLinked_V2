# Accept-Invite Password Flow — Plan (Set Password, Then Login)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an admin-invited user accepts their invite, they are greeted with a "change password" modal to set their own password (no default password), and on success they are redirected to the login page to sign in with it. Fixes the broken accept-invite redirect/no-password experience.

**Architecture:** Keep the existing Supabase invite + lazy provision flow, but (a) present the password step as a modal ("change password") instead of a bare inline form, and (b) on success sign out the invite session and navigate to `/login` (not into the portal). Add an ops step to ensure `/accept-invite` is in the Supabase redirect allowlist so the link lands on the right page.

**Tech Stack:** React (JSX), React Router, Supabase auth, existing `AuthFrame`/`PublicShell`, Vitest + Testing Library.

**Spec:** `docs/arch/specs/2026-10-14-super-admin-user-invite-design.md` (invite flow); `docs/plan/done/2026-10-14-super-admin-user-invite.md`.

## Global Constraints

- No default/generated password: the invitee sets their own (password policy in `src/shared/utils/password`).
- No schema change. No new env var (reuse `CORS_ORIGIN` first entry as app origin).
- Bare route (not wrapped in `PublicRoute`) so the invite session survives.
- Keep provision lazy and idempotent on `(id)`.

## Review Focus

- The invite session must be revoked after password set, otherwise redirecting to `/login` leaves them auto-logged-in.
- Expired/reused invite link must still show the error state, not crash.
- Password validation must reuse `passwordError`/`PASSWORD_HINT` (no duplicated rules).
- Redirect allowlist ops step must be documented, not assumed done.

---

### Task 1: AcceptInvite — modal + redirect to login

**Files:**
- Modify: `src/features/auth/AcceptInvite.jsx`
- Test: `src/features/auth/__tests__/AcceptInvite.test.jsx`

- [ ] **Step 1: Update test expectations** — assert the password form renders inside a modal/dialog (role="dialog"), and that on success `supabase.auth.signOut` is called and navigation targets `/login`. Keep the existing three provisioning tests passing (adjust mocks to include `signOut`).
- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/features/auth/__tests__/AcceptInvite.test.jsx` → expect FAIL.
- [ ] **Step 3: Implement** in `src/features/auth/AcceptInvite.jsx`:
  - Wrap the existing password form in a modal/dialog container (reuse the house dialog classes; title "Change your password", subtitle "Set a password to activate your account.").
  - On submit success: `await supabase.auth.signOut()`, then `navigate('/login', { replace: true, state: { invited: true } })`.
  - Keep provision lazy on load; keep `passwordError` validation.
- [ ] **Step 4: Run tests to verify they pass** — `npx vitest run src/features/auth/__tests__/AcceptInvite.test.jsx` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): accept-invite shows change-password modal and redirects to login"`.

### Task 2: Login page — acknowledge invited flag

**Files:**
- Modify: `src/features/auth/Login.jsx`
- Test: `src/features/auth/__tests__/Login.test.jsx` (if exists)

- [ ] **Step 1: Add a one-line notice** when `location.state?.invited` is true: "Your password is set. Sign in to continue." (no auto-login).
- [ ] **Step 2: Commit** — `git commit -m "feat(auth): acknowledge invited flag on login"`.

### Task 3: Ops — Supabase redirect allowlist

**Files:**
- Modify: `docs/ops/deploy-runbook.md` (or note in plan)

- [ ] **Step 1: Document** that `<appOrigin>/accept-invite` must be in the Supabase project's redirect-URL allowlist, and that `CORS_ORIGIN`'s first entry must be the public web origin. Add a verification curl/check.
- [ ] **Step 2: Commit** — `git commit -m "docs(ops): document accept-invite redirect allowlist"`.

---

## Self-Review

- Spec coverage: invite accept → password set → login redirect ✓; no default password ✓; redirect allowlist ✓.
- Type consistency: `navigate('/login', { replace: true, state: { invited: true } })`; Login reads `location.state?.invited`.
- Review Focus: session revocation (Task 1 signOut), expired link error state (existing), password rules reused (passwordError), redirect allowlist documented (Task 3).

## Execution Handoff

Plan saved to `docs/plan/2026-11-21-accept-invite-password-flow.md`. Please review. Which execution approach: Subagent-driven or Native?
