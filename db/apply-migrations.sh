#!/usr/bin/env bash
# Apply db/migrations/*.sql once each, in filename order, recording each file in
# public.schema_migrations. See docs/ops/deploy-runbook.md#migration-ledger.
#
#   DATABASE_URL=postgres://user:pass@host:5432/joblinked ./db/apply-migrations.sh
#   DATABASE_URL=... ./db/apply-migrations.sh --status   # print state only
#
# Connection may also come from libpq PG* variables (PGHOST, PGUSER,
# PGPASSWORD/PGPASSFILE, PGDATABASE). A password embedded in DATABASE_URL must
# be percent-encoded (spaces, @, :, /).
#
# On an empty ledger the script first reconciles effects already applied by hand
# (004 enum, 007–009 indexes/constraints) and records those files, then applies
# the rest. Every file except 004 is idempotent; the ledger is what keeps 004
# from being run twice.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/db/migrations"
LEDGER_FILE="$DIR/011_schema_migrations.sql"
STATUS_ONLY=0

case "${1:-}" in
  "") ;;
  --status) STATUS_ONLY=1 ;;
  -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "usage: $0 [--status]" >&2; exit 2 ;;
esac

command -v psql >/dev/null 2>&1 || { echo "[migrations] psql not found on PATH" >&2; exit 1; }

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
if [[ -n "${DATABASE_URL:-}" ]]; then PSQL+=("$DATABASE_URL"); fi

if ! "${PSQL[@]}" -tAc 'select 1' >/dev/null; then
  echo "[migrations] cannot connect — set DATABASE_URL or libpq PG* variables" >&2
  exit 1
fi

list_migrations() {
  local f
  for f in "$DIR"/*.sql; do basename "$f"; done | LC_ALL=C sort
}

ledger_exists() {
  [[ -n "$("${PSQL[@]}" -tAc "select to_regclass('public.schema_migrations')")" ]]
}

# psql substitutes :variables only in script/stdin input, never in -c (a -c
# string goes to the server raw). Hence run_sql pipes the SQL in. `tr -d '\r'`:
# Windows psql emits CRLF, which would be read into filenames/ledger rows.
run_sql() {
  local q="$1"; shift
  printf '%s\n' "$q" | "${PSQL[@]}" -tA "$@" | tr -d '\r'
}

is_applied() {
  local found
  found="$(run_sql "select 1 from public.schema_migrations where name = :'name'" -v name="$1")"
  [[ "$found" == "1" ]]
}

record() {
  run_sql "insert into public.schema_migrations (name) values (:'name') on conflict do nothing" \
    -v name="$1" >/dev/null
}

# Files not yet in the ledger (011 is handled before this and never re-applied).
list_pending() {
  local name
  while IFS= read -r name; do
    [[ "$name" == "011_schema_migrations.sql" ]] && continue
    if ! is_applied "$name"; then printf '%s\n' "$name"; fi
  done < <(list_migrations)
}

print_state() {
  echo "[migrations] ledger (public.schema_migrations):"
  "${PSQL[@]}" -c "select name, applied_at from public.schema_migrations order by name"
  local pending
  pending="$(list_pending)"
  if [[ -z "$pending" ]]; then
    echo "[migrations] pending: none"
  else
    echo "[migrations] pending:"
    while IFS= read -r name; do printf '  - %s\n' "$name"; done <<< "$pending"
  fi
}

if [[ "$STATUS_ONLY" == "1" ]]; then
  if ! ledger_exists; then
    echo "[migrations] ledger absent — every migration is pending; run without --status to create it"
    exit 0
  fi
  print_state
  exit 0
fi

# 011 is the ledger itself and must exist before anything is recorded.
"${PSQL[@]}" -f "$LEDGER_FILE" >/dev/null

# Validate the database name up front to avoid SQL injection via the URL path.
DB_NAME="${PGDATABASE:-}"
if [[ -z "$DB_NAME" && -n "${DATABASE_URL:-}" ]]; then
  DB_NAME="${DATABASE_URL##*/}"
  DB_NAME="${DB_NAME%%\?*}"
fi
if [[ -n "$DB_NAME" && ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "[migrations] invalid database name: $DB_NAME" >&2
  exit 1
fi

if [[ "$(run_sql 'select count(*) from public.schema_migrations')" == "0" ]]; then
  echo "[migrations] empty ledger — reconciling effects already present"
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    record "$name"
    echo "[migrations] reconciled $name (already applied by hand)"
  done < <("${PSQL[@]}" -tAc "
    select name from (
      select '002_acid_gaps.sql' as name,
             to_regclass('public.job_seekers_email_uidx') is not null
             and to_regclass('public.employers_email_uidx') is not null as done
      union all
      select '004_remove_shortlisted.sql' as name,
             to_regtype('public.application_status') is not null
             and not exists (
               select 1 from pg_enum e
               join pg_type t on t.oid = e.enumtypid
               where t.typname = 'application_status' and e.enumlabel = 'Shortlisted'
             ) as done
      union all
      select '005_custom_roles.sql' as name,
             exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='reference_data' and column_name='details')
             and exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='job_seekers' and column_name='custom_role_id') as done
      union all
      select '006_job_arrangement.sql' as name,
             exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='job_vacancies' and column_name='work_arrangement') as done
      union all
      select '007_query_indexes.sql',
             to_regclass('public.job_seekers_skills_gin') is not null
      union all
      select '008_constraint_gaps.sql',
             exists (
               select 1 from pg_constraint
               where conname = 'employment_history_application_id_fkey'
                 and conrelid = to_regclass('public.employment_history')
                 and confdeltype = 'n'
             )
             and to_regclass('public.employer_accreditations_one_pending_uidx') is not null
             and to_regclass('public.super_admins_email_uidx') is not null
             and (select count(*) from pg_constraint
                  where conname in ('education_years_order_chk', 'work_experience_dates_order_chk')) = 2
      union all
      select '009_ordering_indexes.sql',
             to_regclass('public.job_applications_applied_idx') is not null
             and to_regclass('public.job_vacancies_deadline_idx') is not null
    ) probes where done" | tr -d '\r')
fi

record "011_schema_migrations.sql"

pending="$(list_pending)"
if [[ -z "$pending" ]]; then
  echo "[migrations] nothing to apply"
else
  while IFS= read -r name; do
    echo "[migrations] apply $name"
    "${PSQL[@]}" -f "$DIR/$name"
    record "$name"
  done <<< "$pending"
fi

print_state
