# "Log in to Apply" intent carry-through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a guest clicks "Log in to Apply" on a public job page, signing in (or completing registration) lands them on that job's full page inside the seeker portal.

**Architecture:** The public job page stashes a one-shot apply intent in `localStorage` at the click; a tiny shared helper validates, expires, and maps it to `/job-seeker/jobs/:id`; `Login.jsx` and `CompleteRegistration.jsx` consume it on their success paths. No API, schema, or route changes.

**Tech Stack:** React + react-router (existing `StaticUrlRouter` app), Vitest + Testing Library + jsdom.

**Spec:** `docs/arch/adr-063-apply-intent-post-login.md`

## Global Constraints

- JavaScript/JSX only; TypeScript is not used in this repo.
- No new dependencies.
- Frontend-only: do not touch `server/`, `db/schema.sql`, or files under `src/shared/services/`.
- Test seams are fixed: `useAuth` is mocked per test file; `authClientMock` comes from `src/test/authClientMock`; the API layer is mocked as `api: { get, post, patch, del, blob }`; turnstile is mocked with an empty site key.
- The real `applyIntent.js` module is used (not mocked) in component tests — jsdom provides `localStorage`.
- Run targeted tests with `npx vitest run <path>`; the final task runs `npm test` and `npm run lint` and both must pass.
- Commit subjects are short and imperative.

## Review Focus

1. **Unsafe stored id** (`//evil.com`, `https://…`, `../`) → `takeApplyIntent()` returns null, portal home. Pinned by Task 1's helper test.
2. **Corrupt/tampered localStorage** (`not-json`) → null, no crash. Pinned in Task 1.
3. **Stale intent** (>24 h) → null, portal home. Pinned in Task 1.
4. **Failed sign-in attempt must not consume the intent** — retry then success still lands on the job page. Pinned in Task 2.
5. **Non-seeker role with a live intent** → today's portal home, intent consumed and ignored. Pinned in Task 2.
6. **Job deleted between click and landing** → the seeker `JobDetail` already renders its own error message (`"Failed to load job"`, line 53); no code change, verify by reading that branch during review.

---

### Task 1: Apply-intent helper + stash on the public job page

**Files:**
- Create: `src/shared/lib/applyIntent.js`
- Modify: `src/features/public-site/PublicJobDetail.jsx` (the `LinkButton href="/login"` in the apply card, ~line 197)
- Test: `src/shared/lib/__tests__/applyIntent.test.js`
- Test: `src/features/public-site/__tests__/PublicJobDetail.applyIntent.test.jsx`

**Interfaces:**
- Produces (consumed by Tasks 2 and 3):
  - `stashApplyIntent(jobId: string): void` — writes `{ id: String(jobId), at: Date.now() }` to localStorage key `joblinked:applyIntent`.
  - `takeApplyIntent(): string | null` — reads and clears the entry; returns `/job-seeker/jobs/:id` only for a live (≤24 h) valid entry, else null.

- [ ] **Step 1: Write the failing helper test** at `src/shared/lib/__tests__/applyIntent.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { stashApplyIntent, takeApplyIntent } from '../applyIntent'

beforeEach(() => localStorage.clear())

describe('applyIntent', () => {
  it('maps the stash to the seeker job path', () => {
    stashApplyIntent('42')
    expect(takeApplyIntent()).toBe('/job-seeker/jobs/42')
  })

  it('is one-shot: take clears the entry', () => {
    stashApplyIntent('42')
    takeApplyIntent()
    expect(takeApplyIntent()).toBeNull()
  })

  it('rejects unsafe or malformed ids', () => {
    stashApplyIntent('//evil.com')
    expect(takeApplyIntent()).toBeNull()
    stashApplyIntent('https://evil.com')
    expect(takeApplyIntent()).toBeNull()
    stashApplyIntent('../etc')
    expect(takeApplyIntent()).toBeNull()
  })

  it('expires entries older than 24 hours', () => {
    localStorage.setItem('joblinked:applyIntent', JSON.stringify({ id: '42', at: Date.now() - 25 * 60 * 60 * 1000 }))
    expect(takeApplyIntent()).toBeNull()
  })

  it('returns null on corrupt JSON', () => {
    localStorage.setItem('joblinked:applyIntent', 'not-json')
    expect(takeApplyIntent()).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails** — `npx vitest run src/shared/lib/__tests__/applyIntent.test.js`; expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/shared/lib/applyIntent.js`**

```js
const KEY = 'joblinked:applyIntent'
const TTL_MS = 24 * 60 * 60 * 1000

// One-shot "log in to apply" intent: which public job the visitor was on when
// they chose to sign in (ADR-063). The entry survives the whole register →
// verify-email → sign-in round trip, so no link threading is needed.
export function stashApplyIntent(jobId) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: String(jobId), at: Date.now() }))
  } catch { /* storage unavailable (private mode): intent silently absent */ }
}

// Reads and clears. Returns the seeker-portal job page, or null when there is
// no live intent. Never navigates to the raw stored value.
export function takeApplyIntent() {
  let raw = null
  try { raw = localStorage.getItem(KEY) } catch { return null }
  if (!raw) return null
  try { localStorage.removeItem(KEY) } catch { /* removal is best-effort */ }
  try {
    const { id, at } = JSON.parse(raw)
    if (typeof id === 'string' && /^[A-Za-z0-9-]+$/.test(id) && Date.now() - at < TTL_MS) {
      return `/job-seeker/jobs/${id}`
    }
  } catch { /* corrupt entry: fall through to null */ }
  return null
}
```

- [ ] **Step 4: Run it to verify it passes** — same command; expected: PASS.

- [ ] **Step 5: Write the failing click test** at `src/features/public-site/__tests__/PublicJobDetail.applyIntent.test.jsx` — copy the mock set from `PublicJobDetail.sections.test.jsx` (same `getJob` mock; reuse its render pattern of `MemoryRouter initialEntries` + `Routes`), then add:

```jsx
it('stashes the job id when Log in to Apply is clicked', async () => {
  localStorage.clear()
  getJob.mockResolvedValue({ id: '42', title: 'Test Job' })
  renderJob() // same render setup the sections test uses: /jobs/:jobId route
  await userEvent.click(await screen.findByRole('link', { name: /log in to apply/i }))
  expect(JSON.parse(localStorage.getItem('joblinked:applyIntent'))).toEqual({ id: '42', at: expect.any(Number) })
})
```

- [ ] **Step 6: Run it to verify it fails** — `npx vitest run src/features/public-site/__tests__/PublicJobDetail.applyIntent.test.jsx`; expected: FAIL (no stash yet).

- [ ] **Step 7: Modify `PublicJobDetail.jsx`** — import `stashApplyIntent` from `@/shared/lib/applyIntent` and add the click handler:

```jsx
<LinkButton href="/login" className="mt-4 w-full" onClick={() => stashApplyIntent(job.id)}>Log in to Apply</LinkButton>
```

(`LinkButton` spreads extra props onto its `<Link>`, so `onClick` passes through and both the stash and the navigation fire.)

- [ ] **Step 8: Run both Task 1 test files** — expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/shared/lib/applyIntent.js src/shared/lib/__tests__/applyIntent.test.js src/features/public-site/PublicJobDetail.jsx src/features/public-site/__tests__/PublicJobDetail.applyIntent.test.jsx
git commit -m "feat: stash apply intent on public job page"
```

---

### Task 2: Login honors the apply intent

**Files:**
- Modify: `src/features/auth/Login.jsx`
- Test: `src/features/auth/__tests__/Login.test.jsx`
- Test: `src/features/auth/__tests__/Login.mfa.test.jsx`

**Interfaces:**
- Consumes: `takeApplyIntent()` from Task 1 (`/job-seeker/jobs/:id` | null).
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests** — in `Login.test.jsx` add a describe block. It needs the Routes-stub render pattern (see `Login.unprovisioned.test.jsx`); the real helper module is imported, not mocked:

```jsx
import { stashApplyIntent } from '../../../shared/lib/applyIntent'

describe('Login apply intent (ADR-063)', () => {
  beforeEach(() => localStorage.clear())

  function renderWithRoutes() {
    return render(
      <MemoryRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/job-seeker/jobs/42" element={<div>seeker job page</div>} />
          <Route path="/job-seeker" element={<div>seeker home</div>} />
          <Route path="/employer" element={<div>employer home</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  const signsInAs = (role) => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: '1' } }, error: null })
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: '1', email: 'good@test.com' } } })
    api.get.mockResolvedValue({ id: '1', role })
  }

  it('lands a job-seeker on the job page after sign-in', async () => {
    useAuth.mockReturnValue({ user: null, authenticate: vi.fn() })
    signsInAs('job-seeker')
    stashApplyIntent('42')
    renderWithRoutes()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('seeker job page')).toBeInTheDocument()
  })

  it('does not consume the intent on a failed attempt', async () => {
    useAuth.mockReturnValue({ user: null, authenticate: vi.fn() })
    authClientMock.signIn.email.mockResolvedValueOnce({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password', status: 401 },
    })
    signsInAs('job-seeker')
    stashApplyIntent('42')
    renderWithRoutes()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText(/password/i))
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('seeker job page')).toBeInTheDocument()
  })

  it('sends an employer to the portal home', async () => {
    useAuth.mockReturnValue({ user: null, authenticate: vi.fn() })
    signsInAs('employer')
    stashApplyIntent('42')
    renderWithRoutes()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('employer home')).toBeInTheDocument()
  })

  it('lands a seeker on portal home when no intent is stored', async () => {
    useAuth.mockReturnValue({ user: null, authenticate: vi.fn() })
    signsInAs('job-seeker')
    renderWithRoutes()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('seeker home')).toBeInTheDocument()
  })

  it('lands an already-signed-in seeker with an intent on the job page', () => {
    useAuth.mockReturnValue({ user: { id: '1', role: 'job-seeker' } })
    stashApplyIntent('42')
    renderWithRoutes()
    expect(screen.getByText('seeker job page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/features/auth/__tests__/Login.test.jsx`; expected: the new intent tests FAIL (no consumption yet).

- [ ] **Step 3: Modify `Login.jsx`** — three edits, one import:

```jsx
import { takeApplyIntent } from '@/shared/lib/applyIntent'
```

a) Already-signed-in early return (currently line 42):

```jsx
if (user && homePath) {
  const applyPath = takeApplyIntent()
  return <Navigate to={applyPath && signedInRole === 'job-seeker' ? applyPath : homePath} replace />
}
```

b) Password success path — replace `navigate(portalPath(loggedIn.role))` after `authenticate?.(loggedIn)`:

```jsx
authenticate?.(loggedIn)
const applyPath = takeApplyIntent()
navigate(applyPath && loggedIn.role === 'job-seeker' ? applyPath : portalPath(loggedIn.role))
```

c) MFA success path — replace `navigate(portalPath(loggedIn.role))` in `handleVerifyMfa` after `authenticate?.(loggedIn)`, same two lines as (b). Leave the `needsProvision` catch untouched — the intent stays unconsumed there so `CompleteRegistration` can honor it.

- [ ] **Step 4: Add the MFA test** — in `Login.mfa.test.jsx`, add a `/job-seeker/jobs/42` route (`<Route path="/job-seeker/jobs/42" element={<div>seeker job page</div>} />`) to the file's existing `renderLogin`, import `stashApplyIntent` (real module), and add:

```jsx
it('lands a job-seeker on the job page after MFA sign-in', async () => {
  authClientMock.signIn.email.mockResolvedValue({
    data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
    error: null,
  })
  authClientMock.twoFactor.verifyTotp.mockResolvedValue({ data: { token: 'session' }, error: null })
  api.get.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
  stashApplyIntent('42')
  renderLogin()
  await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
  const input = await screen.findByLabelText(/verification code/i)
  await userEvent.type(input, '123456')
  await userEvent.click(screen.getByRole('button', { name: /verify/i }))
  expect(await screen.findByText('seeker job page')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run both Login test files** — expected: PASS (including the pre-existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/Login.jsx src/features/auth/__tests__/Login.test.jsx src/features/auth/__tests__/Login.mfa.test.jsx
git commit -m "feat: land job seekers on the job page after apply-intent sign-in"
```

---

### Task 3: CompleteRegistration honors the apply intent

**Files:**
- Modify: `src/features/auth/CompleteRegistration.jsx`
- Test: `src/features/auth/__tests__/CompleteRegistration.test.jsx`

**Interfaces:**
- Consumes: `takeApplyIntent()` from Task 1.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests** — in `CompleteRegistration.test.jsx`, add the stub route `<Route path="/job-seeker/jobs/42" element={<div>seeker job page</div>} />` to `renderWithRouter`, import `stashApplyIntent` (real module), and add inside the existing describe:

```jsx
it('lands a provisioned job-seeker with an apply intent on the job page', async () => {
  localStorage.clear()
  unprovisioned();
  api.post.mockResolvedValue({ role: 'job-seeker' });
  stashApplyIntent('42');
  renderWithRouter(<CompleteRegistration />);
  expect(await screen.findByText('seeker job page')).toBeInTheDocument();
});

it('sends a provisioned employer to the employer portal', async () => {
  localStorage.clear()
  unprovisioned();
  api.post.mockResolvedValue({ role: 'employer' });
  stashApplyIntent('42');
  renderWithRouter(<CompleteRegistration />);
  expect(await screen.findByText('Employer Portal')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/features/auth/__tests__/CompleteRegistration.test.jsx`; expected: the two new tests FAIL.

- [ ] **Step 3: Modify `CompleteRegistration.jsx`** — import `takeApplyIntent` from `@/shared/lib/applyIntent`, then apply the same pattern at both success points (the auto-provision effect at ~lines 50–51 and the form-submit `handleSubmit` at ~lines 103–104):

```jsx
const homePath = PORTALS.find((p) => p.key === result.role)?.homePath || '/'
const applyPath = takeApplyIntent()
navigate(result.role === 'job-seeker' && applyPath ? applyPath : homePath, { replace: true })
```

Leave the already-provisioned early return (line 69–72) untouched.

- [ ] **Step 4: Run to verify it passes** — same command; expected: PASS including all pre-existing tests.

- [ ] **Step 5: Full verification + commit**

```bash
npm test
npm run lint
git add src/features/auth/CompleteRegistration.jsx src/features/auth/__tests__/CompleteRegistration.test.jsx
git commit -m "feat: honor apply intent after provisioning"
```

Both `npm test` and `npm run lint` must be green. If lint flags the empty catch blocks in `applyIntent.js`, the project's eslint config for optional catches governs; no suppressions without reviewer approval.
