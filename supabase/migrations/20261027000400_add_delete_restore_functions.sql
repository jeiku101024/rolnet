create or replace function public.correct_remittance_payment(p_payment_id uuid, p_reason text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare changed_at timestamptz := now();
begin
  perform public.require_owner();
  if nullif(trim(p_reason),'') is null then raise exception using errcode='23514', message='A correction reason is required'; end if;
  update public.remittance_payments set deleted_at=changed_at,deleted_by=auth.uid() where id=p_payment_id and deleted_at is null;
  if not found then raise exception using errcode='P0002',message='Payment was not found'; end if;
  perform public.write_audit_event('remittance_payments',p_payment_id,'reverse',jsonb_build_object('reason',p_reason));
  return changed_at;
end; $$;
