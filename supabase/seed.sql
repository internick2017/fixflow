-- Locations are safe to seed here (they don't depend on auth users).
insert into public.locations (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Sucursal Centro'),
  ('22222222-2222-2222-2222-222222222222', 'Sucursal Norte'),
  ('33333333-3333-3333-3333-333333333333', 'Sucursal Sur')
on conflict (id) do nothing;

-- NOTE: staff users, profiles and the demo tickets assigned to them are seeded by
-- scripts/seed-users.mjs (run after `supabase start`). Auth users can't be created
-- via SQL, and tickets reference those profiles, so they live in the script — see README.
