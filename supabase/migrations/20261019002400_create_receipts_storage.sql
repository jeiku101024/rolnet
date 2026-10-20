insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 512000, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = 512000, allowed_mime_types = excluded.allowed_mime_types;

create policy receipts_staff_read_policy on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_approved_user()
    and exists (select 1 from public.expenses e where e.id::text = split_part(name, '/', 2) and e.deleted_at is null)
  );

create policy receipts_staff_insert_policy on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_approved_user()
    and split_part(name, '/', 1) = 'receipts'
    and exists (select 1 from public.expenses e where e.id::text = split_part(name, '/', 2) and e.deleted_at is null)
  );

create policy receipts_owner_delete_policy on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_owner());
