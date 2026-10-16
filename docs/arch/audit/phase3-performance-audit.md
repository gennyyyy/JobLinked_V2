# Phase 3 — Bundle + Core Web Vitals Audit (JobLinked)

- **Date:** 2026-10-15
- **Scope:** read-only performance audit. No source files modified.
- **Stack:** React 19.2 + Vite 8.2 + Tailwind 4 + react-router-dom 7 (SPA, no SSR).
- **Method:** `package.json` + grep import analysis, code read of the largest pages and shared providers, full production build (`npx vite build`) with raw output captured, image header parsing for intrinsic dimensions.
- All file:line references are relative to the **working tree as of the audit timestamp** (other agents are concurrently editing this tree; re-verify line numbers when implementing the fixes).
- **Skipped (parallel edits by another agent):** `src/features/super-admin/Accreditation.jsx`, `src/features/employer/Applicants.jsx`, `src/features/auth/AuthCallback.jsx`, `src/shared/context/AuthProvider.jsx` (AuthProvider read as a **snapshot** only, because the task explicitly asked for the identity-stability cross-check — re-verify after that agent lands their changes).
- **CWV targets referenced:** LCP < 2.5 s, INP < 200 ms, CLS < 0.1.

---

## Executive summary

The app is in good shape. Route-level code splitting is complete (all 40 routes are `React.lazy`), and the two heavy document-parsing libraries (`pdfjs-dist` ~1 MB, `mammoth` ~2 MB source) are **already dynamically imported** at their call sites — they are not in any page's initial chunk. The build succeeds cleanly.

No blocking issues found. Three small, low-effort improvements remain, in priority order:

1. **`Jobs.jsx:206`** renders a full-screen `<LoadingScreen />` *inside* the page while refetching — a real CLS source and a spinner-as-LCP pattern. (~CLS improvement on the busiest public page.)
2. **Logo (`TextBased Logo.png`, 480×160, 40.5 kB)** is used as `<img className="h-10" />` with no `width`/`height` on 13 pages — header layout shift until the image decodes; PNG → SVG/WebP saves ~35 kB and gives crisp rendering at all DPRs.
3. **`resumeText.js`** is one monolithic lazy chunk (737.73 kB): DOCX-only autofill still downloads pdfjs. Moving the pdfjs import inside `extractPdf()` saves ~600 kB (~180 kB gzip) for DOCX users.

---

## 1. Bundle composition

### 1.1 Heavy dependencies (`mammoth`, `pdfjs-dist`) — already lazy ✅

`package.json` declares `mammoth@^1.13.0` and `pdfjs-dist@^6.4.299`. Static imports exist in exactly one file:

- `src/shared/lib/resumeText.js:1-3` — `import * as pdfjsLib from "pdfjs-dist"` and `import mammoth from "mammoth"` at module top.

**However, both consumers load that module dynamically:**

| Consumer | Line | Pattern |
|---|---|---|
| `src/features/job-seeker/Profile.jsx` | 269 | `const { extractResumeText } = await import("../../shared/lib/resumeText");` (inside `handleResumeUpload`, after a successful upload) |
| `src/features/auth/JobSeekerRegister.jsx` | 124 | same `await import(...)` inside `handleResumeChange` |

Both carry the comment *"pdfjs + mammoth are ~850 kB: load them only when a resume is picked."* The build output confirms the intent is realized: they emit as a standalone lazy chunk `resumeText-*.js` (737.73 kB / 224.05 kB gzip) plus the separate worker asset `pdf.worker.min-*.mjs` (1,264.34 kB, fetched by pdfjs only when it initializes its worker — i.e., only on the PDF branch).

**Conclusion: ~738 kB (224 kB gzip) is already kept off the initial load of every page.** No fix required here — do not "fix" this again.

**Residual improvement (small, optional):** the chunk is monolithic — a DOCX user downloads pdfjs (~600 kB of the 737.73 kB) that mammoth never uses. Fix inside `src/shared/lib/resumeText.js`: move the pdfjs imports into `extractPdf()` (line 53):

```js
async function extractPdf(buf) {
  const [{ default: pdfjsLib }, workerMod] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
  // ...rest unchanged
}
```

Expected gain: DOCX-only autofill drops ~600 kB raw (~180 kB gzip). PDF users see no change. Effort: ~15 lines.

### 1.2 Other dependencies

- `lucide-react` — tree-shakes per-icon (confirmed: the build emits ~40 individual icon chunks of 0.11–0.6 kB each). As noted in the task, fine. No action.
- `@supabase/supabase-js` — 214.33 kB / 55.09 kB gzip as its own chunk, always loaded with the entry (auth is app-wide). Expected for this stack. No action.
- No other third-party runtime deps exist in `package.json`.

### 1.3 Entry payload

Initial JS per page load = `index` entry (249.81 kB / 80.21 kB gzip) + `supabase` (214.33 kB / 55.09 kB gzip) ≈ **464 kB raw / ~135 kB gzip** — React 19 + react-router 7 + Supabase. Within normal budget for an SPA of this size. No action.

---

## 2. Build analysis

`npx vite build` from the project root: **succeeds cleanly.** 2,263 modules transformed, built in 1.08 s. The only warning is Rollup's generic >500 kB notice, triggered solely by the lazy `resumeText` chunk (benign — see §5 for the optional way to silence it).

Raw output (`dist/`; this audit's own build artifacts — not a source change):

```text
vite v8.2.2 building client environment for production...
✓ 2263 modules transformed.
dist/index.html                                    0.55 kB │ gzip:   0.33 kB
dist/assets/pic-BwDKZcv5.jpg                      35.62 kB
dist/assets/TextBased Logo-BBXy2pSR.png           40.51 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs        1,264.34 kB
dist/assets/index-DH-Bm4-3.css                    75.13 kB │ gzip:  13.20 kB
... (per-page chunks 0.06 kB – 43.17 kB; largest page chunks below)
dist/assets/JobSeekerRegister-DRgm5K_6.js         31.12 kB │ gzip:   8.77 kB
dist/assets/Profile-B4KXeuxM.js                   34.68 kB │ gzip:   7.38 kB
dist/assets/JobPosts-D31FP4RW.js                  43.17 kB │ gzip:   9.40 kB
dist/assets/supabase-CMkiygxK.js                 214.33 kB │ gzip:  55.09 kB
dist/assets/index-CoYEx8JA.js                    249.81 kB │ gzip:  80.21 kB
dist/assets/resumeText-CopWzzIB.js               737.73 kB │ gzip: 224.05 kB
✓ built in 1.08s
(!) Some chunks are larger than 500 kB after minification.
```

Notable observations:

- **`resumeText` 737.73 kB** — the only >500 kB chunk, and it is lazily fetched only when a resume file is picked (Profile / JobSeekerRegister). Correct behavior; see §1.1 for the optional DOCX/PDF split.
- **`pdf.worker.min.mjs` 1,264.34 kB** — emitted as a URL asset, requested by pdfjs at runtime only when a **PDF** is parsed. Not in any JS graph; no eager fetch. Correct.
- CSS is a single 75.13 kB (13.20 kB gzip) file — Tailwind 4's compiled output, fine.
- Largest page chunk is `JobPosts` at 43.17 kB (9.40 kB gzip) — no page chunk is suspiciously large.

---

## 3. Render performance review

### 3.1 List rendering / virtualization

| Page | Data source | Bound | Verdict |
|---|---|---|---|
| `job-seeker/Jobs.jsx:220` | `listJobs({ page, pageSize: 10 })` — backend paginated, page controls at :304-326 | 10 cards/page | Bounded. No virtualization needed. |
| `job-seeker/Dashboard.jsx:60,85-87` | `slice(0,3)` recommended, `slice(0,5)` recent | ≤8 rows | Bounded. |
| `employer/Dashboard.jsx:73` | `summary.recent` (server-scoped list) | Small | Bounded. |
| `super-admin/Dashboard.jsx:18` | `accs.slice(0,5)` | 5 rows | Bounded. |
| `job-seeker/Profile.jsx:507,541,576` | per-user education / experience / resumes | Small | Bounded. |

No client-side unbounded renders found. No `react-window`/virtualization dependency needed.

### 3.2 `useEffect` dependencies / refetch storms

Cross-checked against the AuthProvider identity-stable pattern (snapshot read of `src/shared/context/AuthProvider.jsx`):

- `user` object identity is **stable**: `setUser` returns the existing `current` object when the fetched profile deep-equals what is held (lines 30-35), and tab-focus `SIGNED_IN` re-emits are short-circuited via `signedInId.current === session.user.id` (line 61).
- Therefore every `useEffect(..., [user])` below runs **once per actual sign-in/profile change**, not per render:

| File:line | Deps | Verdict |
|---|---|---|
| `employer/Dashboard.jsx:20-35` | `[user]` | Safe (sequential 2-call waterfall `getEmployer().then(getEmployerDashboard())` — a network waterfall of 2 hops; could be `Promise.all` if both endpoints are user-independent, but the second is scoped server-side and doesn't need the first result in its arguments — verify before changing; low priority). |
| `job-seeker/Dashboard.jsx:46-65` | `[user]` | Safe; the two fetches are already `Promise.all`'d. |
| `job-seeker/Profile.jsx:132-170` | `[user]` | Safe; 4 fetches already `Promise.all`'d. |
| `super-admin/Dashboard.jsx:14-22` | `[]` | Mount-only. Safe. |
| `job-seeker/Jobs.jsx:58-74` | all filter primitives + `page` | Complete deps, `cancelled` flag for races, 350 ms debounce at :77-80. Correct. |
| `job-seeker/Jobs.jsx:48-56` | `[user]` + ref guard | One-time profile-skill seed. Safe. |
| `App.jsx:148-152` (PublicRoute) | `[loading, user, done, logout]` | `logout` is `useCallback([])`-stable. Safe. |

**No refetch storms found.**

### 3.3 Keys and re-render props

- All list keys checked are stable IDs (`job.id`, `exp.id`, `edu.id`, `resume.id`, `item.id`, `acc.id`) or stable strings (`stat.label`, tag text). **No index-as-key found** in the files read.
- Inline object/array props exist (`Profile.jsx:482-486` TagInput `onChange` arrows, dashboard stat `icon={<Icon/>}` JSX) but all receiving components are small/unmemoized and render alongside their parents anyway — impact is negligible at this page size. No action.
- Minor: `employer/Dashboard.jsx:43-48` builds the `stats` array (with inline JSX icons) each render — trivial cost, no action.
- `AuthProvider.jsx:76` (snapshot): the context `value` object is **not** memoized, so all ~16 `useAuth()` consumers re-render whenever any auth state changes (e.g., `loading` flip on sign-out). The identity-stable `user` already prevents effect refetches, so this is re-render-only, not a fetch storm. Optional hardening: wrap in `useMemo(() => ({...}), [user, loading])`. Low priority — and the file is under concurrent edit, so re-check after that lands.

### 3.4 Images

| Asset | Intrinsic | Size | Usage | Assessment |
|---|---|---|---|---|
| `src/assets/pic.jpg` | 547×365 JPEG | 35.62 kB | `Landing.jsx:122` hero: `className="relative w-full aspect-[4/3] object-cover rounded-3xl shadow-2xl"`, eager (no `loading="lazy"`) | **OK.** Aspect ratio reserved via CSS → no CLS; eager is correct for the LCP hero. Optional: WebP would be ~10–15 kB. No action required. |
| `src/assets/TextBased Logo.png` | 480×160 PNG | 40.51 kB | **13 files**, all headers: e.g. `Landing.jsx:69`, `JobSeekerRegister.jsx:268`, `PortalLayout.jsx`, all auth pages, PublicJobs/PublicJobDetail — rendered `<img src={Logo} alt="JobLinked" className="h-10" />` | **Two issues** — see findings F2/F3 below: no `width`/`height` attributes (only CSS `h-10`, width `auto`) → the browser cannot reserve the element's box before the PNG bytes arrive, so every header nudges when the logo decodes; and PNG at 40.5 kB for a text logo is heavy. |

---

## 4. CLS risks

Ranked by actual exposure:

1. **`Jobs.jsx:206-217` — full-screen loader inside the page (real shift).** While `loading` is true, the render tree contains the header, metric cards, and search bar, and then `<LoadingScreen />` (`min-h-screen`, spills outside its `section`) exactly where the job grid will appear. When loading flips, the grid replaces the loader and everything mounted after the section (pagination, empty-state block) jumps. On first paint this also makes the spinner ("Loading database…") a candidate LCP element. Fix: render an in-place skeleton sized like ~2–3 job cards (or give the container a stable `min-h`), never `LoadingScreen`, below the fold of interactive content.
2. **Logo without intrinsic sizing (13 pages).** See §3.4. Fix: add `width={480} height={160}` to every `<img>` (or a fixed CSS width); browsers then reserve the 3:1 ratio even with `h-10`. Because the logo sits in the sticky header of the public Landing page, this also touches LCP layout stability on first visit.
3. **Suspense fallback / page-level `if (loading) return <LoadingScreen />`** (`App.jsx:55`, `job-seeker/Dashboard.jsx:67`, `employer/Dashboard.jsx:37`, `super-admin/Dashboard.jsx:24`, `Profile.jsx:172`): these are full-page *replacements* (loader mounted before content exists), so they do not shift existing elements — but they delay first contentful paint and can make the spinner the LCP candidate on slow networks. Only `Jobs.jsx` renders the loader *mid-page* (finding 1). No mass refactor needed.
4. **Fonts:** `src/index.css` contains **no `@font-face` / no web fonts** — Tailwind's `font-sans`/`font-mono` resolve to the system stack. **Zero font-driven CLS/FOUT risk.** No action.
5. **`AuthProvider.jsx:76`** context value not memoized — re-render churn, not layout shift. See §3.3.

---

## 5. Caching headers (note for Phase 4 / devops — not fixed here)

Vite fingerprints everything under `/assets/*` (e.g. `index-CoYEx8JA.js`, `TextBased Logo-BBXy2pSR.png`), so these are immutable once deployed. The correct production headers are a **deployment concern**, not a code change:

```text
/assets/*  →  Cache-Control: public, max-age=31536000, immutable
/index.html (and any non-fingerprinted entry)  →  Cache-Control: no-cache (revalidate)
```

Flagging for the devops agent in Phase 4. No repo change required or made.

Also cosmetic, not a code defect: `vite build` warns about the single >500 kB chunk. If a clean build log is desired, add `build: { chunkSizeWarningLimit: 800 }` to `vite.config.js` — optional, and better done after (or alongside with) the §1.1 pdfjs split, which may bring the chunk under the line anyway.

---

## Severity-ranked findings

| # | Sev | File:line | Issue | Expected gain | Fix |
|---|---|---|---|---|---|
| F1 | **Medium** | `src/features/job-seeker/Jobs.jsx:206-207` | In-page `<LoadingScreen />` (`min-h-screen`) swapped in/out below live UI → CLS + spinner-as-LCP | Removes the only genuine layout shift found; better LCP on the public job-board route | Replace with an in-place skeleton (or fixed `min-h` container); never a full-screen loader mid-page |
| F2 | **Medium** | Logo `<img>` in 13 files, e.g. `Landing.jsx:69`, `JobSeekerRegister.jsx:268` | `<img className="h-10">` with no `width`/`height` → header shifts on decode on every page | Kills header CLS on all public + auth + portal pages | Add `width={480} height={160}` (ratio then reserved even with CSS `h-10`) |
| F3 | Low | `src/assets/TextBased Logo.png` | 480×160 PNG at 40.5 kB loaded site-wide | ~35 kB off every page + crisp at all DPRs | Re-export as SVG (text logo) or optimized WebP; swap the 13 imports |
| F4 | Low | `src/shared/lib/resumeText.js:1-3, 53-54` | Monolithic lazy chunk: DOCX autofill pulls pdfjs (~600 kB of 737.73 kB) | ~600 kB raw / ~180 kB gzip saved on DOCX-only autofill | `await import("pdfjs-dist")` + `?url` worker inside `extractPdf()` (snippet in §1.1) |
| F5 | Low | `src/shared/context/AuthProvider.jsx:76` *(snapshot — under parallel edit)* | Context `value` recreated each render → all consumers re-render on any auth state change | Re-render-only churn; effects already gated by identity-stable `user` | Optional `useMemo` around the value object |
| F6 | Info | `vite.config.js`, deployment | >500 kB build warning (lazy chunk) + immutable assets need long-cache headers | Clean build log; CDN cache hits | Set `chunkSizeWarningLimit: 800` (optional); Phase 4 devops sets `max-age=31536000, immutable` on `/assets/*` |

### Already correct — do not re-work

- All 40 routes are `React.lazy` code-split (`App.jsx:10-49`); no page chunk > 43.17 kB raw.
- `mammoth` + `pdfjs-dist` already dynamic at both call sites (§1.1).
- No refetch storms; `[user]` effects are safe given the identity-stable `user`.
- No index-as-key; all lists bounded (backend pagination or server-side slicing).
- No web fonts → no font CLS.
- Hero `pic.jpg` has reserved aspect ratio and correct eager loading for LCP.
- `pdf.worker.min.mjs` is a runtime-fetched asset, not bundled JS.

## Verification evidence

- `npx vite build` (project root): exit 0, `✓ 2263 modules transformed`, `✓ built in 1.08s`; only warning is the generic >500 kB chunk notice for the lazy `resumeText` chunk. Raw table in §2 (source log: `docs/arch/audit/` build run 2026-10-15).
- Import graph confirmed by ripgrep: `pdfjs-dist`/`mammoth` imported statically only in `src/shared/lib/resumeText.js:1-3`; referenced dynamically at `Profile.jsx:269` and `JobSeekerRegister.jsx:124`.
- Image dimensions read from file headers: PNG 480×160 / 40,515 B; JPEG 547×365 / 35,621 B.
- No source files were modified for this audit. Skipped files per instructions: `Accreditation.jsx`, `Applicants.jsx`, `AuthCallback.jsx`; `AuthProvider.jsx` read-only snapshot.
