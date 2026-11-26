-- =============================================================================
-- 022 · Job seeker nationality
-- Free-text citizenship, stored as typed (not lowercased like address fields).
-- Existing rows default to 'Filipino' so the required Profile field never
-- blocks a save for accounts created before this migration.
-- =============================================================================

alter table public.job_seekers
  add column if not exists nationality text not null default 'Filipino';
