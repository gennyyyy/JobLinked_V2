# ADR-061: Registration "Create a Resume" builder replaces parse-based autofill

Date: 2026-11-27
Status: Accepted
Related: ADR-045 (resume autofill accuracy), ADR-049 (one resume per account), ADR-038 (request admission)

## Context

Registration step 1 offers "Autofill from resume": the user picks a PDF/DOCX, the browser parses it with regex heuristics (`mapResumeText`), and fills empty form fields. Accuracy work (ADR-045) reduced but never eliminated wrong values from arbitrary resume layouts, and the flow carries a mandatory "autofill can make mistakes" review checkbox as a symptom patch. Product decision: drop file parsing from registration entirely.

## Decision

- Registration's resume picker is replaced by a **"Create a Resume" button** that opens a structured builder modal (personal info, address, education, skills, optional work-experience entries). The modal edits the registration form state directly; no parsing, no review checkbox.
- Work-experience entries live only in the generated document — they are not part of the signup payload and no schema changes.
- **Registration still never uploads a resume** (ADR-049 holds). The builder's output is downloadable client-side: `POST /api/resumes/generate` renders the draft to PDF (`pdfkit`) or DOCX (`docx`) server-side and returns the bytes. The endpoint is unauthenticated (registration has no session), stateless, validated, and covered by the app-wide `apiLimiter`.
- The parse-based path (`mapResumeText`, `resumeAutofill.js`, eval harness) is **retained for the Profile page**, which keeps its upload-and-autofill panel. ADR-045 remains in force there.
- One fixed document layout, owned by the server renderer. Layout variety is explicitly out of scope — that variety is what made parsing unreliable.

## Consequences

- `useResumeAutofill`, the `resumeAttached` / `resumeReviewConfirmed` flags, and their validation die with the registration picker.
- Two new server dependencies (`pdfkit`, `docx`); an anonymous endpoint joins the API surface and is a permanent (small) abuse surface — payload caps are mandatory.
- A user who builds a resume at registration gets a downloaded file, not a stored one; attaching it to the account remains a manual Profile upload.
