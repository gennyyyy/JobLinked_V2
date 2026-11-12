# ADR-045: Resume auto-fill accuracy (LLM-assisted extraction + review gate)

- Status: Accepted (2026-11-11) — heuristic-mode corpus accuracy 100% (18 fields × 7 fixtures); LLM mode is the safety net for layouts outside the corpus. **Amended 2026-11-13: the server endpoint was never shipped; autofill is client-side only — see Amendment.**
- Date: 2026-11-11
- Related: ADR-023 (AI provider / OpenRouter), ADR-038 (rate limiting), ADR-041 (Turnstile), plan `docs/plan/2026-11-11-resume-autofill-accuracy.md`

## Context

Registration auto-fill (job-seeker) currently runs entirely client-side: `pdfjs`/`mammoth` extract raw text from the picked file, and `src/shared/utils/resumeAutofill.js` maps it to form fields with regex heuristics. The module header says it: "High-confidence only … per-field confidence scores or NLP if autofill hit-rate ever matters." It now matters — name splitting, school text, and the 7-field Filipino address come out wrong sometimes, and wrong values land silently in editable inputs.

Owner requirement: ≥90% confidence on long-string fields.

## Decision

1. **Hybrid pipeline, review-first.**
   - Client text extraction (pdfjs/mammoth) stays — no file upload needed for auto-fill, no auth required.
   - A new server endpoint `POST /api/ai/resume-extract` (OpenRouter via the existing `aiProvider.js` pattern, ADR-023) does NER for the hard fields: name parts, school, education level/field/year, address parts, skills. Contact fields (email, phone, birthdate) stay deterministic regex — they are already unambiguous.
   - Every auto-fill shows the touched fields to the user **explicitly** ("checked ✓ from your resume") — silent wrong values become visible ones. This, not model confidence, is what enforces the 90% at the boundary between machine and form.
2. **Privacy gate.** Resume text is PII. The LLM path only runs when the user explicitly opts in (checkbox beside the auto-fill input: "Use AI to read my resume — sends the file's text to an AI service"). Off = regex-only path (today's behavior). Nothing about a resume is persisted: the endpoint processes and discards; logs record duration and field counts only, never text.
3. **Registration-time abuse control.** The endpoint runs pre-auth, so: a dedicated per-IP rate limiter (10/hour) plus a hard input cap (20,000 characters) and server-side schema validation (unknown keys dropped, enums constrained to the existing education levels, strings length-capped). Turnstile is deliberately **not** used here: its tokens are single-use and the register form's submit already consumes one — a second consumer would break registration.
4. **Availability discipline.** `OPENROUTER_API_KEY` unset or upstream failure → 503 (same `AI_NOT_CONFIGURED` pattern as `/api/ai/help`); client falls back to the heuristic path with a notice. The feature degrades, never blocks registration.
5. **Measurement before tuning.** A golden corpus (annotated Filipino resumes) + `npm run eval:autofill` per-field accuracy script. The ≥90% claim is enforced over that corpus for the LLM path; the same corpus gates regex regressions.
6. **No new dependencies.** OpenRouter via `fetch` inside the existing provider module; eval script uses the already-installed pdfjs/mammoth.

## Rejected alternatives

- **Regex-only hardening** (no NER): can't disambiguate name suffixes, particles, wrapped addresses; effort goes line-by-line and regresses. Kept as fallback only.
- **Fully client-side LLM** (browser → OpenRouter direct): leaks the API key or requires a proxy anyway; loses server-side validation and rate limiting. Rejected.
- **Storing parsed profiles for reuse later:** YAGNI — registration only; nothing persists.

## Consequences

- New public surface: one unauthenticated-but-gated endpoint (contract in the plan).
- Registration UX gains a consent checkbox and a "checked ✓" hint; API consumers unaffected.
- Upstream AI cost: ≤ one small call per consenting registration (≤20k chars, default cheap model).
- The ≥90% metric is defined against the golden corpus, not vibes; regression testing enters `npm test`.

## Amendment (2026-11-13)

The `POST /api/ai/resume-extract` endpoint and its module were never shipped: the 2026-11-11 bug-hunt
cleanup removed them, and registration auto-fill runs entirely client-side (pdfjs/mammoth +
`src/shared/utils/resumeAutofill.js` regex heuristics). No resume text leaves the browser and nothing
is sent to OpenRouter. Decisions 2-4 above (privacy gate, abuse control, availability) apply only if
the server path is ever reintroduced; the shipped state is the client-side path.
