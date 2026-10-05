-- =============================================================================
-- JobLinked · Reference-data seeds (ADR-020)
-- Reference rows only. No demo users — accounts are created via
-- Supabase signup + POST /api/auth/provision.
-- Apply: psql -d joblinked -f db/seed.sql
-- =============================================================================

insert into public.reference_data (category, value, sort_order) values
  ('employment_type', 'Full-time',    1),
  ('employment_type', 'Part-time',    2),
  ('employment_type', 'Contractual',  3),
  ('employment_type', 'Seasonal',     4),
  ('employment_type', 'Casual',       5),
  ('employment_type', 'Job Order',    6),
  ('education_level', 'Elementary',   1),
  ('education_level', 'High School',  2),
  ('education_level', 'Senior High School', 3),
  ('education_level', 'Vocational',   4),
  ('education_level', 'College',      5),
  ('education_level', 'Post-Graduate', 6)
on conflict (category, value) do nothing;
