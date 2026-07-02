-- helper: is the current user an admin? (security definer bypasses RLS to read profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.tickets   enable row level security;

-- profiles: authenticated staff can read; users update their own row
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- locations: anyone can read (intake shows the location name); only admin writes
create policy "locations_select_all" on public.locations
  for select to anon, authenticated using (true);
create policy "locations_admin_write" on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tickets: anonymous intake can INSERT
create policy "tickets_insert_anyone" on public.tickets
  for insert to anon, authenticated with check (true);

-- tickets SELECT: admin sees all, tecnico sees only assigned
create policy "tickets_select_admin" on public.tickets
  for select to authenticated using (public.is_admin());
create policy "tickets_select_assigned" on public.tickets
  for select to authenticated using (assigned_to = auth.uid());

-- tickets UPDATE: admin updates anything; tecnico updates only own rows
create policy "tickets_update_admin" on public.tickets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tickets_update_assigned" on public.tickets
  for update to authenticated using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

-- tickets DELETE: admin only
create policy "tickets_delete_admin" on public.tickets
  for delete to authenticated using (public.is_admin());
