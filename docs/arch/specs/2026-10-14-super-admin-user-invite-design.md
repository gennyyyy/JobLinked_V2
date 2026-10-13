# Spec — Super-admin "Add user" via Supabase invite

- **Date:** 2026-10-14
- **Status:** Approved for implementation (design approved in chat; this written spec is the build contract)
- **Owner:** Lead Architect
- **ADR:** ADR-024 (text at the end of this document)
- **Path chosen:** Architectural (new endpoint + new auth landing page)

## 1. Context — how accounts work today

- Credentials live in **Supabase Auth**. The Express API owns all Postgres access; the
  browser never touches the DB directly.
- Self-signup: the client calls `supabase.auth.signUp()` and writes every profile field
  into Supabase `user_metadata` (`src/shared/services/auth.js:88`). The server then
  `POST /api/auth/provision` inserts the role row (`server/src/routes/auth.js:18`) into
  `job_seekers` / `employers` / `super_admins` using the JWT user id. Provisioning is
  idempotent, allow-lists fields, lowercases personal fields, and — for employers — opens
  a pending `employer_accreditations` row.
- When Supabase requires email confirmation, `signUp` returns no session; on first login
  `signIn` provisions from the stored metadata (`src/shared/services/auth.js:70`).
- The server already holds a **service-role** Supabase client (`server/src/auth.js:5`), so
  it can call `supabase.auth.admin.*`. The service-role key never leaves the server.
- All `/api/admin/*` routes require role `super-admin` (`server/src/auth.js:61`).
- Role tables carry `status account_status not null default 'active'`
  (`active` / `inactive` / `suspended` — `db/schema.sql:16,50,89,104`). There is **no
  "pending" account state**, and all three role tables already have a `custom_role_id`
  tag column for custom roles.
- `src/features/auth/AuthCallback.jsx` is **job-seeker only** (`:27` throws for any other
  role, and `:29` navigates to `/job-seeker`). It therefore cannot host employer/admin
  invites. `/reset-password` is wrapped in `PublicRoute`, which destroys the incoming
  session, so it can't host the invite either.

**Gap:** there is no way for a super admin to create an account. This spec adds one.

## 2. Goal / non-goals

**Goal.** A super admin can create a `job-seeker`, `employer`, or `super-admin` account —
or an account tagged with an existing **custom role** — from the Users page. The new user
receives Supabase's standard invite email, sets their own password, and lands in their
portal configured with the correct role.

**Non-goals.** No admin-set passwords. No silent pre-confirmed accounts. No bulk import.
No new "pending/invited" account state (no schema change). No change to self-signup.

## 3. Decisions

- **D1 — Verification = Supabase invite email.** The user sets their own password via the
  invite link; the admin never handles a password.
- **D2 — Provisioning = lazy (Approach A).** The server only sends the invite; the role row
  is created by the **existing** `POST /api/auth/provision` when the user accepts. No row
  exists until acceptance → no orphan rows, and the row is never wrongly `active`.
- **D3 — All three system roles are creatable**, plus selection of an existing custom role
  (the custom role's `base_role` decides which portal table holds the account).
- **D4 — No schema change.** Rows land in existing tables; custom-role tag uses the
  existing `custom_role_id` column.

## 4. Flow

```
Super admin (Users page)
  └─ opens "Add user" modal, submits { email, role | custom_role_id, names, phone?, company_name? }
      └─ POST /api/admin/users/invite
          ├─ validate + duplicate-email check (local role tables)
          ├─ supa.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo: <appOrigin>/accept-invite })
          └─ audit 'user.invite'
      ← 201 { invited: true, email, role }

User clicks the invite email link
  └─ /accept-invite  (bare route — NOT wrapped in PublicRoute)
      ├─ read Supabase session from the link; none/invalid → error card
      ├─ GET /auth/me → profile
      │    └─ none → provision(metadata)  →  POST /api/auth/provision
      ├─ show "set your password" form → supabase.auth.updateUser({ password })
      └─ refreshUser → navigate to /job-seeker | /employer | /super-admin
```

## 5. API contract

### 5.1 New — `POST /api/admin/users/invite`

Auth: `Authorization: Bearer <supabase access token>`, role `super-admin` (same as every
`/api/admin/*` route: `auth` + `requireRole('super-admin')`).

Request body:

```json
{
  "email": "juan@example.com",
  "role": "job-seeker" | "employer" | "super-admin",
  "custom_role_id": 12,
  "first_name": "Juan",
  "middle_name": "",
  "last_name": "Dela Cruz",
  "suffix": "",
  "phone": "+63917...",
  "company_name": "Acme Inc"
}
```

- `email`, `role`, `first_name`, `last_name` are required.
- `custom_role_id` (optional): if present it must reference an existing custom role; the
  invite's effective base role is that role's `base_role`, and the request `role` must
  equal it (else `400`).
- `company_name` is required when the effective role is `employer`.
- `middle_name`, `suffix`, `phone` are optional.

Server behaviour:

1. Validate the body (shape + the rules above). → `400 BAD_REQUEST`.
2. Reject if `email` already exists in any of `job_seekers` / `employers` / `super_admins`
   (case-insensitive). → `409 CONFLICT` `"Email is already registered"`.
3. Build invite metadata (see 5.2) and call
   `supa.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo: `${appOrigin}/accept-invite` })`.
   - `appOrigin` = first value of `CORS_ORIGIN` (already configured; no new env var).
   - Supabase error (e.g. the email already has an auth user) → `409 CONFLICT`.
4. `void audit(req.user.id, 'user.invite', null, null, { email, role, custom_role_id })`.
5. → `201 { invited: true, email, role }`.

Errors use the existing envelope `{ error: { code, message } }`
(`BAD_REQUEST` 400 · `FORBIDDEN` 403 · `CONFLICT` 409 · `INTERNAL` 500).

### 5.2 Invite metadata

`data` passed to `inviteUserByEmail`, mirroring the keys `signUp` already produces so the
existing provision handler consumes it unchanged:

```json
{
  "role": "job-seeker" | "employer" | "super-admin",
  "custom_role_id": 12,
  "first_name": "...", "middle_name": "...", "last_name": "...", "suffix": "...",
  "full_name": "...", "phone": "...", "company_name": "..."
}
```

### 5.3 Contract addendum — `POST /api/auth/provision`

Extend the request to accept an optional `custom_role_id`. When present, validate it
references an existing custom role and set it on the inserted role row (all three role
tables have the column). Invalid/unresolvable id → ignore it (fall back to no tag) rather
than failing provisioning, so a stale invite can still onboard. No other behaviour change;
the endpoint stays idempotent and token-authenticated.

## 6. Frontend

- `src/shared/services/admin.js`: add
  `inviteUser(payload)` → `api.post('admin/users/invite', payload)`.
- `src/features/super-admin/UserManagement.jsx`: add an **"Add user"** button opening a
  house-style modal form.
  - Fields: Email; Role (a `<select>` listing the three system roles **and** the existing
    custom roles fetched via the existing `listRoles()` — custom options labelled e.g.
    `HR Officer · Employer`); First name; Middle name; Last name; Suffix; Phone; and
    Company name shown **only** when the selected base role is `employer`.
  - Submit → `inviteUser(...)`. Success → close + `"Invite sent to <email>"`. Errors shown
    inline (reuse the page's existing `success` / `actionError` pattern).
- **New page** `src/features/auth/AcceptInvite.jsx`:
  - Reads the Supabase session from the invite URL. Missing/invalid → error card
    ("This invite link is invalid or expired.").
  - `getProfile(session.user.id)`; if none, `provision({ ...user_metadata, email })`
    (existing service).
  - Renders a "Set your password" form (reuse the `ResetPassword.jsx` markup pattern):
    `supabase.auth.updateUser({ password })` (min 8 chars, confirm match), then
    `refreshUser(session.user)` and navigate to the home of the role returned by
    `getProfile` (or by `provision` when it just created the row):
    `/job-seeker` | `/employer` | `/super-admin`.
- `src/App.jsx`: add a **bare** route (not inside `PublicRoute`):
  `<Route path="/accept-invite" element={<AcceptInvite />} />`.

## 7. State & data

- New page + modal use local component state only; `useAuth` provides session/`refreshUser`.
  No global state additions.
- **No database schema change.** Rows are created by the existing provision path in the
  existing tables; the custom-role tag uses the existing `custom_role_id` column.

## 8. Security

- Endpoint restricted to role `super-admin` (same guard as all admin routes).
- Every invite writes an audit row (`user.invite`) with actor id.
- No password ever transits our API: Supabase sends the email, the user chooses the
  password.
- Inviting a `super-admin` (or a custom role whose base role is `super-admin`) is a
  privilege-escalation surface. Accepted as a product decision (D3); mitigated by the
  admin-only endpoint, the audit trail, and the fact the actor already holds the highest
  role. Flagged explicitly for the record.
- Service-role Supabase client stays server-side; the key is never exposed to the client.

## 9. Config / ops

- The Supabase project's **redirect URL allowlist** must include `<appOrigin>/accept-invite`,
  or the invite link will not return to the app. (Dashboard configuration — document in the
  deploy notes; no code.)
- `appOrigin` is derived from `CORS_ORIGIN`; ensure it is set to the public web origin in
  the deployment env.

## 10. Testing

- **Server** `server/src/routes/admin.users.invite.test.js` (pattern:
  `admin.users.patch.test.js`): non-admin → 403; missing fields → 400; employer without
  `company_name` → 400; duplicate email in a role table → 409; happy path calls
  `inviteUserByEmail` with the expected metadata + `redirectTo` and returns 201 (mock the
  Supabase admin client); audit row written.
- **Server**: extend the provision test to cover `custom_role_id` (valid tag set; unknown
  id ignored).
- **Frontend**: Users modal renders, Company field appears only for employer, submit posts
  the correct payload (mock service); `AcceptInvite` provisions when the profile is
  missing and shows the set-password form.
- Run `npm test` and `npm run lint`.

## 11. ADR-024 (text for `docs/arch/adr-backlog.md`)

> **ADR-024 — Admin-initiated user invites follow the Supabase email flow, with lazy
> provisioning.**
> Super admins create users via `POST /api/admin/users/invite`, which calls Supabase
> `admin.inviteUserByEmail` (metadata + `redirectTo: /accept-invite`) and writes no DB row.
> The role row is created by the existing `POST /api/auth/provision` when the invitee
> accepts the link and sets a password on the new `/accept-invite` page. Rationale: keeps
> email verification authoritative (no pre-confirmed accounts), avoids orphan `active`
> rows, and reuses the proven provision path. `POST /api/auth/provision` gains an optional
> `custom_role_id`. No schema change. Inviting `super-admin` is an accepted
> privilege-escalation surface, guarded by the admin-only endpoint and audit logging.

## 12. Rollout

1. Backend: invite endpoint + provision `custom_role_id` addendum + tests.
2. Frontend: service fn, Users modal, `/accept-invite` page + route + tests.
3. Ops: add `<appOrigin>/accept-invite` to the Supabase redirect allowlist; confirm
   `CORS_ORIGIN`.
4. Record ADR-024 in `docs/arch/adr-backlog.md` (deferred here to avoid entangling the
   in-flight uncommitted edits in that file).

## 13. Open questions

- None blocking. (Deferred: a distinct "Invited / Pending" account state would give the
  admin immediate visible confirmation and let broadcasts skip unconfirmed accounts — that
  needs a schema change (Approach C) and can be a follow-up ADR if wanted.)
