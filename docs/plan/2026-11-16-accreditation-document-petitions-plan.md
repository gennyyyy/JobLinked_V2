# Accreditation Document Petitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-document petitions to the accreditation flow: employers file a reason when a required document is missing; super-admins review and approve/reject each petition; accreditation decision stays separate.

**Architecture:** New `employer_document_petitions` table. Three endpoints added to `server/src/routes/profiles.js` (POST /petitions, GET /petitions/company/:companyId, PATCH /petitions/:id). Frontend service helpers in `src/shared/services/documents.js`. Employer UI gains a "File petition" dialog per missing doc; super-admin review modal gains a "Document petitions" section.

**Tech Stack:** Express, Postgres, React (JSX), Vitest, Testing Library. No new dependencies.

**Spec:** docs/arch/specs/2026-11-16-accreditation-document-petitions-design.md

## Global Constraints

- No TypeScript; JavaScript/JSX only.
- DB changes via `db/schema.sql` and a migration file under `db/migrations/`; no browser DB calls.
- Keep API errors in `{ error: { code, message } }` shape.
- Auth via existing `auth`/`requireRole` middleware.
- Validate `doc_type` against the existing `DOC_TYPES` set (server).
- reason trimmed length >= 10.
- Plan files live under `docs/plan/`.

## Review Focus

- Duplicate pending petition must return 409, not 500 (partial unique index).
- Employer must not petition for another company's accreditation (ownership check).
- Super-admin PATCH must 404 on bad uuid, not 500.
- Petition status changes must notify the employer.
- Petition creation must notify admins.
- Employer UI must disable "File petition" when a document of that type already exists.

---

### Task 1: Database migration + portable schema

**Files:**
- Create: `db/migrations/015_document_petitions.sql`
- Modify: `db/schema.sql` (append table + indexes after employer_documents block)

**Interfaces:**
- Produces: `employer_document_petitions` table with columns id, company_id, accreditation_id, doc_type, reason, status, remarks, decided_by, created_at, decided_at; partial unique index on (company_id, doc_type) where status='pending'.

- [ ] **Step 1: Write migration file** with the CREATE TABLE + indexes from the spec.
- [ ] **Step 2: Mirror in db/schema.sql** after the employer_documents table definition.
- [ ] **Step 3: Verify** migration runs against a local DB (if available) — `psql $DATABASE_URL -f db/migrations/015_document_petitions.sql`; expect no errors. If no DB, skip and note.

---

### Task 2: Backend endpoints in profiles.js

**Files:**
- Modify: `server/src/routes/profiles.js` (add three routes before `export default router`)

**Interfaces:**
- Consumes: `pool`, `auth`, `requireRole`, `ah`, `err`, `isUuid`, `audit`, `notifyAdmins`, `notifyUser`, `DOC_TYPES` (already exported from this file).
- Produces:
  - `POST /petitions` (employer) → 201 petition row or 400/409.
  - `GET /petitions/company/:companyId` (employer own or super-admin) → array.
  - `PATCH /petitions/:id` (super-admin) → updated petition or 404.

- [ ] **Step 1: Add POST /petitions** route:
  ```
  router.post('/petitions', auth, requireRole('employer'), ah(async (req, res) => {
    const { doc_type, reason, accreditation_id = null } = req.body || {};
    if (!doc_type || !DOC_TYPES.has(doc_type)) return err(res, 400, 'BAD_REQUEST', 'doc_type must be one of: ...');
    const trimmed = String(reason || '').trim();
    if (trimmed.length < 10) return err(res, 400, 'BAD_REQUEST', 'reason must be at least 10 characters');
    let accreditation = accreditation_id && isUuid(accreditation_id) ? accreditation_id : null;
    if (accreditation) {
      const { rows: owned } = await pool.query('select 1 from employer_accreditations where id=$1 and company_id=$2', [accreditation, req.user.id]);
      if (!owned[0]) return err(res, 403, 'FORBIDDEN', 'Not your accreditation');
    }
    try {
      const { rows } = await pool.query(
        `insert into employer_document_petitions (company_id, accreditation_id, doc_type, reason)
         values ($1,$2,$3,$4) returning *`, [req.user.id, accreditation, doc_type, trimmed]);
      void audit(req.user.id, 'petition.create', 'employer_document_petitions', rows[0].id, { doc_type });
      void notifyAdmins({ type:'petition', title:'Document petition awaiting review',
        message: `An employer filed a petition for a missing ${doc_type}.`, link:'/super-admin/accreditation' });
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') return err(res, 409, 'CONFLICT', 'A pending petition for this document already exists');
      throw e;
    }
  }));
  ```
- [ ] **Step 2: Add GET /petitions/company/:companyId** route:
  ```
  router.get('/petitions/company/:companyId', auth, ah(async (req, res) => {
    if (!isUuid(req.params.companyId)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
    if (req.user.role !== 'super-admin' && req.params.companyId !== req.user.id) {
      return err(res, 403, 'FORBIDDEN', 'Not your company');
    }
    const { rows } = await pool.query(
      `select * from employer_document_petitions where company_id=$1 order by created_at desc`,
      [req.params.companyId]);
    res.json(rows);
  }));
  ```
- [ ] **Step 3: Add PATCH /petitions/:id** route:
  ```
  router.patch('/petitions/:id', auth, requireRole('super-admin'), ah(async (req, res) => {
    if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Petition not found');
    const { status, remarks = null } = req.body || {};
    if (!['approved','rejected'].includes(status)) return err(res, 400, 'BAD_REQUEST', 'status must be approved or rejected');
    const terminal = true;
    const { rows } = await pool.query(
      `update employer_document_petitions set status=$2, remarks=$3, decided_by=$4, decided_at=now()
       where id=$1 returning *`, [req.params.id, status, remarks, req.user.id]);
    if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Petition not found');
    void audit(req.user.id, `petition.${status}`, 'employer_document_petitions', rows[0].id);
    const { rows: crows } = await pool.query('select id, company_name from employers where id=$1', [rows[0].company_id]);
    if (crows[0]) {
      void notifyUser(crows[0].id, { type:'petition', title:`Petition ${status}`,
        message: `Your petition for ${rows[0].doc_type} was ${status}.${remarks ? ` PESO remarks: ${remarks}` : ''}`,
        link:'/employer/accreditation' });
    }
    res.json(rows[0]);
  }));
  ```
- [ ] **Step 4: Run** `npm run lint` (server lint if available) and existing profile tests.

---

### Task 3: Frontend service helpers

**Files:**
- Modify: `src/shared/services/documents.js` (append three functions)

**Interfaces:**
- Produces:
  - `createPetition({ docType, reason, accreditationId })` → POST petitions
  - `listCompanyPetitions(companyId)` → GET petitions/company/:companyId
  - `updatePetition(id, status, remarks)` → PATCH petitions/:id

- [ ] **Step 1: Append** functions mirroring existing patterns (api.post/get/patch).
- [ ] **Step 2: Lint.**

---

### Task 4: Employer UI — file petition dialog

**Files:**
- Modify: `src/features/employer/EmployerAccreditation.jsx`

**Interfaces:**
- Consumes: `createPetition`, `listCompanyPetitions` from documents service; `DOC_TYPES` already imported.
- Adds: per-missing-doc "File petition" button + dialog; petition status badges.

- [ ] **Step 1: Import** createPetition, listCompanyPetitions.
- [ ] **Step 2: Add state** `petitions`, `petitioningDoc`, `petitionReason`, `petitionBusy`, `petitionError`.
- [ ] **Step 3: Load petitions** alongside documents in the useEffect.
- [ ] **Step 4: Render** "File petition" button for DOC_TYPES without an uploaded doc and without a pending petition.
- [ ] **Step 5: Dialog** with textarea + submit calling createPetition; on success refresh petitions.
- [ ] **Step 6: Show petition status badge** next to doc type when a petition exists.
- [ ] **Step 7: Lint + manual smoke.**

---

### Task 5: Super-admin UI — petitions section in review modal

**Files:**
- Modify: `src/features/super-admin/Accreditation.jsx`

**Interfaces:**
- Consumes: `listCompanyPetitions`, `updatePetition` (import from documents service).
- ReviewModal loads petitions on open; renders section with approve/reject.

- [ ] **Step 1: Import** listCompanyPetitions, updatePetition.
- [ ] **Step 2: Add state** `petitions`, `petitionsLoading`, `petitionReason` (reuse remarks), `petitionBusy`.
- [ ] **Step 3: Load petitions** in useEffect alongside docs.
- [ ] **Step 4: Render section** "Document petitions" listing each with doc_type, reason, status badge, and Approve/Reject for pending.
- [ ] **Step 5: Wire** updatePetition calls; refresh petitions on success.
- [ ] **Step 6: Lint.**

---

### Task 6: Tests

**Files:**
- Create: `server/src/routes/profiles.petitions.test.js`
- Modify: `src/features/employer/__tests__/EmployerAccreditation.test.jsx`
- Modify: `src/features/super-admin/__tests__/Accreditation.test.jsx`

- [ ] **Step 1: Server tests** covering: create success, reason <10 → 400, invalid doc_type → 400, duplicate pending → 409, ownership 403, list by company (employer own / admin), admin approve/reject, 404 on bad uuid.
- [ ] **Step 2: Frontend tests** covering: file petition dialog submit, status badge render, superadmin approve/reject petition.
- [ ] **Step 3: Run** `npm test` and `npm run lint`.

---

### Task 7: Commit + handoff

- [ ] **Step 1: Commit** all changes with message "feat: accreditation document petitions".
- [ ] **Step 2: Hand off** to backend/frontend agents per roster (no code written here).

## Verification

- `npm test` passes.
- `npm run lint` passes.
- Manual: employer files petition for missing doc; super-admin sees it and approves; accreditation decision remains separate.
