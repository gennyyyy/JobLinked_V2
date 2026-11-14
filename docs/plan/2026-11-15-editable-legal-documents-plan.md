# Editable Legal Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a super-admin view and edit the Privacy Notice and Terms of Use, with the public pages and the registration consent modal reading the published text.

**Architecture:** Move the two documents from a bundled constant (`src/shared/content/legal.js`) into a `legal_documents` table. A public read endpoint serves them; an admin `PATCH` (gated on `settings.manage`) updates them. The public `Legal` page and the registration consent modal fetch the published text with a bundled fallback, so the site never breaks if the API is down. Admin editing lives in a new "Legal documents" section on `/super-admin/settings`.

**Tech Stack:** Node 24, Express 4, pg 8, Supabase JS 2, React 19, Vite, Vitest 4, RTL/jsdom. No new dependencies.

**Spec:** User request (2026-11-15): "rework the privacy comes first card and let the super admin be able to view and change the terms of use and privacy notice." Constraints from ADR-045 (portals static) and ADR-051 (motion); this is a content feature, not a motion one.

## Global Constraints

- **Schema:** changes go through `db/schema.sql` only (applied with `psql`/node pg), additive and idempotent; the Lead Architect signs off on the DDL with this plan.
- **Auth rule:** Supabase is identity only; all data reads/writes go through Express. No browser-side database calls.
- **Server routes:** `auth` + `requireRole`/`requirePermission`; every mutation writes `audit(...)`.
- **Fallback:** public readers must never fail because the API is down — fall back to the bundled `PRIVACY_NOTICE`/`TERMS_OF_USE` constants.
- **No new dependencies.** No rich-text editor; a `<textarea>` is enough (the documents are plain text).
- **Tests:** server tests in `server/src/routes/*.test.js`; client tests in `src/**/__tests__/`; run `npm test`, `npm --prefix server test`, `npm run lint`, `npm run build`.
- **Do not** remove `src/shared/content/legal.js` — it remains the seed + fallback.

## Review Focus

1. **Seed idempotency.** The migration inserts the two documents only when absent (`on conflict (key) do nothing`), so an admin edit is never overwritten by a re-run.
2. **Public read must not 404.** `GET /legal/:key` returns the seeded body for `privacy`/`terms`; an unknown key returns 404 `NOT_FOUND` (so a typo surfaces, but the bundled fallback covers it client-side).
3. **Edit must not blank a document.** `PATCH` rejects an empty/whitespace body (`400 BAD_REQUEST`) and keeps the previous version.
4. **Permissions.** Only `settings.manage` holders can PATCH; the GET is public (no auth) so the landing/registration pages can read it without a token.
5. **Audit.** Every successful PATCH writes `settings.legal.update` with `{ key }` — never the body (too large, and it's already in the table).

---

### Task 1: `legal_documents` schema + seed

**Files:** Modify `db/schema.sql`; apply via node pg (no psql installed).
**Interfaces:** table `public.legal_documents (key text primary key, body text not null, updated_at timestamptz not null default now(), updated_by uuid)`.

- [ ] **Step 1: Append to `db/schema.sql`**

```sql
create table if not exists public.legal_documents (
  key         text        primary key,
  body        text        not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.legal_documents (key, body) values
  ('privacy', '<PRIVACY_NOTICE body>'),
  ('terms',   '<TERMS_OF_USE body>')
on conflict (key) do nothing;
```

The body values are the current contents of `src/shared/content/legal.js` (read them at implementation time). Keep the file as the fallback.

- [ ] **Step 2: Apply + verify** — run the DDL + seed through node/pg (idempotent); verify both rows exist and `count(*) = 2`.
- [ ] **Step 3: Commit** — `feat(legal): legal_documents table + seed`.

### Task 2: Public read + admin PATCH routes

**Files:** Create `server/src/routes/legal.js`; register in `server/src/app.js`; test `server/src/routes/legal.test.js`.
**Interfaces:**
- `GET /legal/:key` → `200 { key, body, updated_at }`; unknown key → `404 NOT_FOUND`.
- `PATCH /admin/legal/:key` → `auth, requireRole('super-admin'), requirePermission('settings.manage')`; body `{ body: string }`; trim + require non-empty (400 `BAD_REQUEST`); unknown key → 404; audit `settings.legal.update`; returns the updated row. Key must be `privacy` or `terms` (400 otherwise).

- [ ] **Step 1: Write failing tests** — GET returns seeded body; unknown key 404; PATCH updates + audits; empty body 400; non-admin → 403; invalid key → 400.
- [ ] **Step 2: RED** — run, expect failure (route absent).
- [ ] **Step 3: Implement** — follow `admin-reference.js` style; use `pool.query` with parameterized values.
- [ ] **Step 4: GREEN** — tests pass.
- [ ] **Step 5: Commit** — `feat(legal): public read and admin edit routes`.

### Task 3: Client service + cached reader

**Files:** `src/shared/services/legal.js` (new); test `src/shared/services/__tests__/legal.test.js`.
**Interfaces:**
- `getLegal(key)` → `Promise<string>` (returns `body`, falling back to `PRIVACY_NOTICE`/`TERMS_OF_USE` on any error or empty body).
- Module-level cache: one in-flight promise per key, reused across callers (Legal page + registration modal).

- [ ] **Step 1: Write failing tests** — API success returns body; API failure returns the bundled fallback; empty body returns fallback; cache reuses one request.
- [ ] **Step 2: RED**.
- [ ] **Step 3: Implement** — `api.get('legal/${key}')`, cache the promise, `.catch` → fallback.
- [ ] **Step 4: GREEN**.
- [ ] **Step 5: Commit** — `feat(legal): cached client reader with bundled fallback`.

### Task 4: Public `Legal` page reads from the API

**Files:** Modify `src/features/public-site/Legal.jsx`.
- Replace the static `DOCUMENTS` lookup with `getLegal(document)` in a `useEffect` + state, showing a skeleton while loading, the API body when ready, and the bundled constant on error.
- Keep the layout, heading, and `whitespace-pre-line` styling.
- Test: `src/features/public-site/__tests__/Legal.test.jsx` — renders the fallback when the API is mocked to reject; renders the API body when it resolves.

- [ ] **Step 1: Write failing test** (mock `getLegal`).
- [ ] **Step 2: RED**.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: GREEN**.
- [ ] **Step 5: Commit** — `feat(legal): public pages read published documents`.

### Task 5: Registration consent modal

**Files:** Modify the registration consent modal (find it — `TermsModal.jsx` or the inline modal in `Register.jsx`).
- Replace the bundled constant with `getLegal('privacy')`; show a loading skeleton; fall back on error.
- Test: the modal renders the API body when available.

- [ ] **Step 1: Locate the modal** (`grep -rn "PRIVACY_NOTICE" src`).
- [ ] **Step 2: Implement + test**.
- [ ] **Step 3: Commit** — `feat(legal): consent modal reads published privacy notice`.

### Task 6: Admin editor on the settings page

**Files:** `src/features/super-admin/Settings.jsx`, `src/shared/components/design.jsx` (textarea already exists), tests.
- Add a new "Legal documents" section (below Reference data) with two cards: "Privacy notice" and "Terms of use". Each card: a `<textarea>` bound to the loaded body, a Save button (disabled until dirty), `role="status"` success, `role="alert"` error, and a "View published" link to `/privacy`/`/terms`.
- Load via `getLegal(key)` on mount; save via a new `updateLegal(key, body)` service → `PATCH /admin/legal/${key}`.
- Permission: disable editing + show a notice when `!hasPermission(user, 'settings.manage')`.
- Tests: renders both documents; Save calls `updateLegal`; empty body is rejected by the server (assert the error shows); permission-gated (disabled).

- [ ] **Step 1: Write failing tests**.
- [ ] **Step 2: RED**.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: GREEN**.
- [ ] **Step 5: Commit** — `feat(legal): admin editor for privacy notice and terms`.

### Task 7: ADR + verification

**Files:** `docs/arch/adr-053-editable-legal-documents.md`.
- Record: storage in DB, public read + admin PATCH, bundled fallback, no rich text, audit without body, seed idempotency, permission gate.

- [ ] **Step 1:** Write ADR.
- [ ] **Step 2:** `npm test`, `npm --prefix server test`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual: edit privacy notice as admin → public `/privacy` reflects it; empty body rejected; non-admin gets 403 (UI disabled); API-down fallback renders bundled text.
- [ ] **Step 4:** Commit — `docs(arch): ADR-053 editable legal documents`.

## Verification notes

- The seed inserts `on conflict (key) do nothing`, so re-running `schema.sql` never overwrites an edit.
- Public readers never 404 in practice: unknown keys 404 server-side, but the client falls back to the bundle.
- The registration consent modal and the public page share one cached fetch per key.
- No migration script needed beyond `schema.sql` (idempotent).
