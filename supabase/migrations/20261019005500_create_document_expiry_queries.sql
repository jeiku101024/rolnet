create or replace function public.expiring_documents(as_of date default current_date)
returns table(id uuid, document_type public.document_type, unit_id uuid, driver_id uuid, expires_on date, bucket text)
language sql stable security definer set search_path=public as $$ select id,document_type,unit_id,driver_id,expires_on,case when expires_on<as_of then 'expired' when expires_on<=as_of+7 then 'due_7' when expires_on<=as_of+30 then 'due_30' else 'valid' end from public.documents where lifecycle_status='current' and deleted_at is null and expires_on<=as_of+30 order by expires_on $$;
