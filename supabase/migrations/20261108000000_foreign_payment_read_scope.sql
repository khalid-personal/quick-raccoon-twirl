-- Restrictive policy intersects existing read policies without widening any role.
create policy "Foreign agencies read only their outbound receipts"
on public.payments
as restrictive
for select
to authenticated
using (
  not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('agency', 'foreign-agency', 'foreign-agency-staff')
  )
  or exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_approved = true
      and role in ('agency', 'foreign-agency', 'foreign-agency-staff')
      and foreign_agency_id::text = payments.data->>'payer_foreign_agency_id'
      and (
        payments.data->>'payer_type' = 'foreign-agency'
        or (payments.data->>'payer_type' is null and coalesce(payments.data->>'payer_foreign_agency_id', '') <> '')
      )
  )
);
