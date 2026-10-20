create type public.document_type as enum ('or_cr','driver_license','mtop_franchise','insurance');
create type public.document_lifecycle as enum ('current','superseded','void');
create table public.documents (
 id uuid primary key default gen_random_uuid(), document_type public.document_type not null, unit_id uuid references public.units(id), driver_id uuid references public.drivers(id), document_number text, issued_on date, expires_on date not null, lifecycle_status public.document_lifecycle not null default 'current', object_path text not null, mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')), size_bytes integer not null check (size_bytes between 1 and 5242880), sha256 text not null, superseded_by_id uuid references public.documents(id), created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), deleted_at timestamptz, deleted_by uuid references auth.users(id), constraint document_holder_check check ((unit_id is not null and driver_id is null) or (unit_id is null and driver_id is not null))
);
create unique index documents_current_unit_unique on public.documents (document_type,unit_id) where lifecycle_status='current' and unit_id is not null and deleted_at is null;
create unique index documents_current_driver_unique on public.documents (document_type,driver_id) where lifecycle_status='current' and driver_id is not null and deleted_at is null;
create index documents_expiry_idx on public.documents (expires_on) where lifecycle_status='current' and deleted_at is null;
create trigger documents_audit_fields before insert or update on public.documents for each row execute function public.set_audit_fields();
create trigger documents_no_hard_delete before delete on public.documents for each row execute function public.reject_hard_delete();
