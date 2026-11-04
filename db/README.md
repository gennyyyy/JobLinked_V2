# Local Postgres (`db/` is the source of truth — ADR-020)

## 1. Register the server in pgAdmin4

- Servers → Register → Server…
  - General → Name: `JobLinked local`
  - Connection → Host: `localhost`, Port: `5432`, Username: `postgres`,
    Password: (your postgres password), check Save password.

## 2. Create the database

In pgAdmin4: Databases → Create → Database… → name `joblinked`.
Or with psql:

```sh
psql -U postgres -h localhost -c "CREATE DATABASE joblinked;"
```

## 3. Apply schema + seeds (in this order)

Via psql:

```sh
psql -U postgres -h localhost -d joblinked -f db/schema.sql
psql -U postgres -h localhost -d joblinked -f db/seed.sql
```

Or in pgAdmin4: open the Query Tool on `joblinked`, paste each file, Execute (F5).

## 4. Point the API at it

```sh
cp server/.env.example server/.env
# edit DATABASE_URL=postgres://postgres:<password>@localhost:5432/joblinked
```

## 5. Deploy dump / restore (the "not difficult to deploy later" path)

**A database dump alone is not a complete backup.** Resume and accreditation
PDFs live on disk; Postgres stores only their paths (`resumes.file_path`,
`employer_documents.file_path`). Profile pictures and company logos are the
exception: they are stored as bytes in `profile_images` and do come with the
dump (ADR-040).

```sh
# 1. database
pg_dump -Fc joblinked > joblinked.dump
# 2. the files those rows point at (run from the repo root)
npm run backup:uploads          # -> backups/uploads-<timestamp>.tgz

# restore on the new machine, same two halves
pg_restore -d <newdb> joblinked.dump
tar -xzf backups/uploads-<timestamp>.tgz -C server
```

Restore the archive into the **same** `UPLOAD_DIR` the API uses. A relative
`UPLOAD_DIR` resolves against `server/` regardless of the working directory;
the API logs the resolved path at boot (`uploads directory`). If the files are
missing, every file request answers `404 File not found` even though the row
exists — the dump restored, the backup did not.

## Rules

- Schema changes NEVER via the pgAdmin GUI — edit `db/schema.sql`, apply with
  psql/Query Tool, commit. Nothing alters schema without architect approval.
- `supabase/migration.sql` is RETAINED untouched as the Supabase-target
  schema; moving back = restore dump, re-add auth FKs, RLS, storage.
