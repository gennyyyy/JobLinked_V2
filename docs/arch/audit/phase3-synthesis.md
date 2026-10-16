# Phase 3 Synthesis — UI/UX Perfection & Frontend Optimization

**Date:** 2026-10-15  
**Status:** Audits complete — fixes dispatched

---

## Audit Results

Three reports: `phase3-a11y-audit.md` (14 files, WCAG 2.1 AA), `phase3-ux-consistency.md` (29 findings + 3-portal matrix), `phase3-performance-audit.md` (bundle + CWV).

### Stale-premise corrections
- **H2 (audit Phase 1)**: `mammoth`/`pdfjs-dist` are **already dynamically imported** at both call sites — the heavy bundle is already lazy. Only DOCX-pulls-pdfjs residual (~600 kB) remains.
- **L5**: backend tests existed (154); 53 more added in Phase 2.
- **Server suites**: agent reported "failed suites" without env vars — root cause `auth.js` module-scope Supabase client (S7, fix in flight).

---

## Consolidated Phase 3 Fix Register

### Accessibility (Critical → fix first)

| ID | Finding | Locations |
|----|---------|-----------|
| A1 | Unlabelled form controls — sibling `<label>` without `htmlFor`/`id`; placeholder-only search/selects | JobPosts modal, Profile edit form, Jobs/Applicants/JobPosts/UserManagement filters |
| A2 | Contrast — `text-gray-400` on white = 2.5:1 (needs 4.5:1); `text-accent` on `bg-accent/20` = 1.3:1 (Profile avatar) | 10 files |
| A3 | Keyboard — JobPosts table row is `<tr onClick>` with no keyboard path, contains dead `<button>` | `JobPosts.jsx` |
| A4 | Announcements — errors render as plain text (no `aria-live`); `LoadingScreen` has no live region | 7 features |
| A5 | Modals — 5 dialogs lack Escape, focus trap, focus restore (TermsModal is the working template) | modals in audited pages |

### UX Consistency

| ID | Finding | Location |
|----|---------|----------|
| U1 | `homeTo` defaults to `/` → super-admin logo exits the portal to public site | `PortalLayout.jsx:11` — fix at the default |
| U2 | Jobs empty/filter state renders full-screen `LoadingScreen` inline (min-h-screen) on every filter change | `Jobs.jsx:206-207`, deps at :74 |
| U3 | Three divergent error presentations (bespoke rose card / retry card / bare one-liner); `rose-*` used where `danger` token exists | Jobs, JobPosts, 3 dashboards |
| U4 | Jobs + JobPosts predate `shared/components/dashboard.jsx` — hand-rolled PageHeader/StatCard/SectionCard; JobPosts has no dark-blue header | `Jobs.jsx`, `JobPosts.jsx` |
| U5 | JobPosts empty state gives dead-end advice when accreditation ≠ approved | `JobPosts.jsx:770-794`, guard :144/:202 |
| U6 | AFK modal primary button on left (convention: primary right) | `PortalLayout.jsx:141-154` |
| U7 | JobPosts mobile `flex-col-reverse` puts "Publish" at top | `JobPosts.jsx:1246` |

### Performance

| ID | Finding | Location |
|----|---------|----------|
| F1 | Jobs full-screen loading spinner mid-page (CLS + spinner-as-LCP) | `Jobs.jsx:206` |
| F2 | Logo 480×160 rendered at `h-10` with no width/height | 13 pages |
| F3 | Logo PNG → WebP conversion | `src/assets/` |
| F4 | DOCX path pulls pdfjs (~600 kB savable, ~15-line split in `extractPdf()`) | `resumeText.js` |

---

## Explicitly Out of Scope for Phase 3

- Files already fixed by Phase 2 fixers: `AuthCallback.jsx`, `AuthProvider.jsx`, `Accreditation.jsx`, `Applicants.jsx` — their a11y findings are noted but deferred to a final sweep (Phase 6).
- Backend caching headers — flagged for Phase 4 (devops).
- Verification gap: a11y audit is **static** (computed ratios, no screen reader/keyboard/axe run). Findings A1–A5 are code-evident and safe to act on; a verification sweep belongs in Phase 6.

---

## Status

- [x] Phase 3 audits (a11y, UX consistency, performance)
- [ ] Phase 3 fixes — dispatched (2 agents)
- [ ] Phase 4 — Concurrency & Backend Hardening
- [ ] Phase 5 — Security Audit
- [ ] Phase 6 — Code Review & Final Polish
