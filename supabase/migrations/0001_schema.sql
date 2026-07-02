-- enums
create type public.user_role as enum ('admin', 'tecnico');
create type public.ticket_status as enum ('received', 'in_progress', 'resolved');

-- profiles: one row per staff user, linked to auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'tecnico',
  created_at timestamptz not null default now()
);

-- locations: each site has its own QR
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- tickets: service requests
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  description text not null,
  photo_path text,
  customer_contact text,
  status public.ticket_status not null default 'received',
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tickets_assigned_to_idx on public.tickets (assigned_to);
create index tickets_location_id_idx on public.tickets (location_id);
create index tickets_status_idx on public.tickets (status);

-- Table privileges for the API roles. These are table-level GRANTs; RLS (0002) is what
-- actually restricts which ROWS each role can touch. Without these grants PostgREST
-- returns "permission denied" before RLS is ever evaluated.
grant usage on schema public to anon, authenticated, service_role;

-- service_role bypasses RLS and is used server-side (seeding, admin tasks): full access.
grant all on public.profiles  to service_role;
grant all on public.locations to service_role;
grant all on public.tickets   to service_role;

-- authenticated staff: DML on all three; RLS narrows rows by role.
grant select, insert, update, delete on public.profiles  to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.tickets   to authenticated;

-- anonymous customers: read location names, create tickets, and (SELECT grant so the
-- RLS deny returns an empty set instead of a hard error) never actually read tickets.
grant select on public.locations to anon;
grant select, insert on public.tickets to anon;
