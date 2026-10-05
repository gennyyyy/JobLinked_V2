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

```sh
pg_dump -Fc joblinked > joblinked.dump
pg_restore -d <newdb> joblinked.dump
```

The dump restores to any Postgres, including Supabase.

## Rules

- Schema changes NEVER via the pgAdmin GUI — edit `db/schema.sql`, apply with
  psql/Query Tool, commit. Nothing alters schema without architect approval.
- `supabase/migration.sql` is RETAINED untouched as the Supabase-target
  schema; moving back = restore dump, re-add auth FKs, RLS, storage.
