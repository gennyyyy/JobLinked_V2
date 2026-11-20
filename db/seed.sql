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
  ('employment_type', 'Project-based', 7),
  ('employment_type', 'Internship',   8),
  ('education_level', 'Elementary',   1),
  ('education_level', 'High School',  2),
  ('education_level', 'Senior High School', 3),
  ('education_level', 'Vocational',   4),
  ('education_level', 'College',      5),
  ('education_level', 'Post-Graduate', 6)
on conflict (category, value) do nothing;

-- Controlled vocabularies shared by employers (a vacancy's field + required
-- skills) and seekers (their field + skills). Mirrored in
-- db/migrations/016_job_field_and_skills.sql — keep the two lists in sync
-- (that migration's contract test fails otherwise).
insert into public.reference_data (category, value, sort_order) values
  ('job_field', 'Administrative & Office',        1),
  ('job_field', 'Sales & Retail',                 2),
  ('job_field', 'Food & Beverage',                3),
  ('job_field', 'Production & Manufacturing',     4),
  ('job_field', 'Construction',                   5),
  ('job_field', 'Logistics & Delivery',           6),
  ('job_field', 'Customer Service',               7),
  ('job_field', 'Healthcare',                     8),
  ('job_field', 'Education',                      9),
  ('job_field', 'Information Technology',        10),
  ('job_field', 'Finance & Accounting',          11),
  ('job_field', 'Human Resources',               12),
  ('job_field', 'Engineering',                   13),
  ('job_field', 'Maintenance & Repair',          14),
  ('job_field', 'Security Services',             15)
on conflict (category, value) do nothing;

insert into public.reference_data (category, value, sort_order) values
  ('skill', 'Customer Service',       1),
  ('skill', 'Cashiering',             2),
  ('skill', 'Inventory',              3),
  ('skill', 'MS Excel',               4),
  ('skill', 'Data Entry',             5),
  ('skill', 'Welding',                6),
  ('skill', 'Electrical Wiring',      7),
  ('skill', 'Driving',                8),
  ('skill', 'Food Preparation',       9),
  ('skill', 'Housekeeping',          10),
  ('skill', 'Sales',                 11),
  ('skill', 'Communication',         12),
  ('skill', 'Teamwork',              13),
  ('skill', 'Attention to Detail',   14),
  ('skill', 'Time Management',       15),
  ('skill', 'Problem Solving',       16),
  ('skill', 'POS Operation',         17),
  ('skill', 'Merchandising',         18),
  ('skill', 'Stocking',              19),
  ('skill', 'Order Picking',         20),
  ('skill', 'Packing',               21),
  ('skill', 'Forklift Operation',    22),
  ('skill', 'Delivery',              23),
  ('skill', 'Route Planning',        24),
  ('skill', 'Plumbing',              25),
  ('skill', 'Carpentry',             26),
  ('skill', 'Masonry',               27),
  ('skill', 'Painting',              28),
  ('skill', 'Machine Operation',     29),
  ('skill', 'Quality Control',       30),
  ('skill', 'Assembly',              31),
  ('skill', 'Soldering',             32),
  ('skill', 'Sewing',                33),
  ('skill', 'Food Safety',           34),
  ('skill', 'Cooking',               35),
  ('skill', 'Baking',                36),
  ('skill', 'Barista Skills',        37),
  ('skill', 'Serving',               38),
  ('skill', 'Cleaning',              39),
  ('skill', 'Laundry',               40),
  ('skill', 'Front Desk',            41),
  ('skill', 'Phone Handling',        42),
  ('skill', 'Bookkeeping',           43),
  ('skill', 'Billing',               44),
  ('skill', 'MS Word',               45),
  ('skill', 'Typing',                46),
  ('skill', 'Filing',                47),
  ('skill', 'Scheduling',            48),
  ('skill', 'Report Writing',        49),
  ('skill', 'Leadership',            50),
  ('skill', 'Supervisory Skills',    51),
  ('skill', 'Recruitment',           52),
  ('skill', 'Patient Care',          53),
  ('skill', 'Caregiving',            54),
  ('skill', 'First Aid',             55),
  ('skill', 'Teaching',              56),
  ('skill', 'Computer Literacy',     57),
  ('skill', 'Troubleshooting',       58),
  ('skill', 'Air Conditioning Repair', 59),
  ('skill', 'Security Guarding',     60)
on conflict (category, value) do nothing;
