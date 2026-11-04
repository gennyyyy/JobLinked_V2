# Supabase auth configuration for launch (registration spikes)

**Status:** Required before launch · Owner: whoever holds the Supabase project dashboard
**Measured evidence (2026-11-04, live spikes):**

| Probe | Observed |
|---|---|
| Anonymous `POST /auth/v1/signup` with the built-in email service | **429 by the 3rd attempt** (`email rate limit exceeded`) — 150 simultaneous registrations are impossible |
| Concurrent `signInWithPassword` (`/token`) from one IP | ~30–60 succeed per window, then `Request rate limit reached`; the remaining requests only completed after 45 s pauses across ~4 windows |
| `POST /api/auth/provision` (our API) | 100 passed per 15 min before the old IP-keyed limiter; fixed in `23c2c18` (now per-user) |

The service-role key **cannot** change any of the settings below. Use the Supabase Dashboard or the Management API with a personal access token.

## 1. Custom SMTP (blocker for the built-in email limiter)

Dashboard → **Authentication → SMTP Settings** → enable custom SMTP.

| Setting | Value |
|---|---|
| Host | Provider SMTP host (e.g. `smtp.resend.com`, `email-smtp.<region>.amazonaws.com`) |
| Port | `587` (STARTTLS) |
| Username / Password | Provider credentials (store in the provider + Supabase, never in this repo) |
| Sender email | A domain you control, e.g. `no-reply@joblinked.ph` (SPF/DKIM/DMARC configured) |
| Sender name | `JobLinked PESO Santa Maria` |

Verify a real confirmation + password-reset email end-to-end in staging after enabling.

## 2. Auth rate limits (Dashboard → Authentication → Rate Limits)

Set for a launch-day spike of ~150 registrations from one office/NAT, then re-run the spike harness.

| Limit | Suggested launch value | Why |
|---|---|---|
| Emails sent per hour | **300** | confirmation + reset emails for a 150-registration burst |
| Sign-ups / sign-ins per hour (per IP) | **600** | 150 registrations + retries behind one NAT |
| Token verifications / refreshes per hour (per IP) | **1800** | every signed-in request refreshes/verifies; 150 users × several requests |
| OTP / magic-link verifications per hour | **300** | invite + reset flows |
| Email sign-ups requiring confirmation | keep **on**, now that SMTP exists | prevents typo accounts |

If the dashboard offers per-IP and per-user buckets, raise the per-IP one; keep the per-user one conservative (brute-force protection).

## 3. URLs (Dashboard → Authentication → URL Configuration)

- **Site URL:** production origin (e.g. `https://joblinked.ph`)
- **Redirect allow list:** production origin + `http://localhost:5173` + `http://localhost:4173` for preview, plus the exact `/auth/callback` and `/reset-password` paths.

## 4. Verification procedure

```bash
# after SMTP + limits are set, from a staging machine on one public IP:
# 1) 20 real anon signups — all should succeed (no 429)
# 2) re-run the registration spike against staging (admin path):
node server/scripts/seed-registration-spike.mjs --seekers 100 --employers 50
# expected: all 150 provisioned; no 429 from Supabase /token or our API
```

Watch Dashboard → **Logs → Auth** for `429` / `email rate limit` entries during the run.

## 5. What is already fixed in this repo (no action needed)

- Our API's auth limiter now keys authenticated requests by **user id** (`23c2c18`), so 150 simultaneous provisions no longer collapse into one IP bucket. Anonymous login/signup keep the IP-keyed 100/15 min brute-force guard.
- `TRUST_PROXY` stays `0` by default (fail-safe). **If the API runs behind nginx/Caddy/Vercel, set `TRUST_PROXY` to the hop count (usually `1`)** in `server/.env` — otherwise every request appears to come from the proxy IP and IP-keyed limits apply site-wide. `server/src/app.js` now logs a boot warning when production runs with `TRUST_PROXY=0`.
- Matching-seeker notifications gained a duplicate guard (`4051a13`) — a re-published job no longer notifies the same seeker twice. Fan-out *volume* (1,811 rows per 100 posts) remains per-match; a digest/queue needs a product decision.
