insert into storage.buckets (id, name, public) values ('ticket-photos', 'ticket-photos', false)
on conflict (id) do nothing;

create policy "ticket_photos_anon_upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'ticket-photos');
create policy "ticket_photos_staff_read" on storage.objects
  for select to authenticated using (bucket_id = 'ticket-photos');
