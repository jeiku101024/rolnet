insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('documents','documents',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']::text[]) on conflict(id) do update set public=false,file_size_limit=5242880;
create policy documents_storage_owner_read on storage.objects for select to authenticated using (bucket_id='documents' and public.is_owner());
create policy documents_storage_owner_insert on storage.objects for insert to authenticated with check (bucket_id='documents' and public.is_owner());
create policy documents_storage_owner_delete on storage.objects for delete to authenticated using (bucket_id='documents' and public.is_owner());
