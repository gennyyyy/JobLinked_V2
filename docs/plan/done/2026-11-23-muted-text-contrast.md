# Raise gray-text contrast across the site

Status: implemented 2026-11-23 (via `frontend`) — tests, lint, and contrast check verified.

## Confirmed brief

- **What:** muted/secondary gray text must meet WCAG 2.1 AA (4.5:1) on every surface it is
  actually rendered on, including the tinted cards and soft-colored sections.
- **Cause:** the site is already tokenized — 424 uses of `text-muted-foreground`, only two
  stray Tailwind grays (both already ≥6.5:1). The single token `--muted-foreground: #64748b`
  passes only on pure white (4.76:1) and fails on:
  `bg-secondary` 4.34, `bg-accent`/`bg-blue-soft` 4.30, `bg-teal-soft` 4.36,
  `bg-success-soft` 4.40, `bg-warning-soft` 4.47, `bg-danger-soft` 4.29.
- **How:** darken that one token to `#475569` (Tailwind slate-600), which measures 6.83–7.58:1
  across all of those surfaces. Two non-token gray-text spots ride along.
- **Done when:** the contrast table above clears 4.5:1 on every surface, `npm test` and
  `npm run lint` pass, and no other visual or structural change is present.
- **Out of scope:** the footer tagline in `text-primary/70` (blue, not gray), the two
  hardcoded `text-gray-600`/`text-gray-800` spots (already compliant), background tokens,
  dark mode (the app has none).

## Changes

1. `src/index.css:696` — `--muted-foreground: #64748b;` → `--muted-foreground: #475569;`
   Fixes primary, secondary, placeholder text, nav links, section/prose copy, table heads,
   `demo-label` and every other `text-muted-foreground` usage in one place.
2. `src/features/employer/EmployerAccreditation.jsx:218` — `text-muted-foreground/40` →
   `text-muted-foreground`. The "not uploaded" check icon is a status graphic at ~2.6:1;
   full muted clears the 3:1 non-text threshold. Keep `text-teal` for uploaded.
3. `src/components/ui/tabs.jsx:23` — inactive tab `text-foreground/60` →
   `text-foreground/70` (≈6.6:1 on white, ≈6.3:1 on `bg-muted`; was ≈4.5:1 borderline).

Nothing else. Do not touch `--muted`, the background tokens, or component structure.

## Verification

- Contrast check (expected 4.5+ on every surface):

  ```bash
  node -e "const h=s=>s.replace('#','').match(/../g).map(x=>parseInt(x,16)/255),l=s=>{const[r,g,b]=h(s).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b},c=(a,b)=>{const[x,y]=[l(a),l(b)].sort((m,n)=>n-m);return((x+.05)/(y+.05)).toFixed(2)};for(const s of ['#ffffff','#f8fafc','#f0f5fc','#edf4ff','#eaf8f4','#edf9f1','#fff7e7','#fef0ef'])console.log(s,c('#475569',s))"
  ```

  All values ≥ 4.5.
- `npm test` — all pass.
- `npm run lint` — clean.
- Grep confirms no remaining `text-muted-foreground/40` and no `text-foreground/60` on tabs.

No unit test is added: this is a token value, not logic; the contrast command above is the
runnable check.
