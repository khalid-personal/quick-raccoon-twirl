-- Ministry ingestion uses service_role. Portal users retain task assignments,
-- payment/evidence work and read access, but cannot change source progression.
create or replace function public.guard_ministry_progression()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  protected_fields text[];
  field text;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'medical_results' then
    raise exception 'Medical results are ministry-owned and read-only.';
  end if;

  if tg_table_name = 'candidate_stages' then
    if tg_op <> 'UPDATE' then
      raise exception 'Stage records must come from the ministry.';
    end if;
    protected_fields := array['candidate_id', 'stage_id', 'status', 'date', 'reference_id', 'location', 'history'];
  else
    if tg_op = 'DELETE' then
      raise exception 'Ministry candidate records cannot be deleted from the portal.';
    end if;
    if tg_op = 'INSERT' then
      raise exception 'Candidate intake must come from the ministry.';
    end if;
    protected_fields := array['visa', 'clearance', 'flight', 'arrival', 'employment_history',
      'contract_start_date', 'contract_end_date', 'expected_return_date', 'actual_return_date', 'return_status'];
  end if;

  foreach field in array protected_fields loop
    if old.data->field is distinct from new.data->field then
      raise exception 'Ministry-owned field % is read-only.', field;
    end if;
  end loop;
  return new;
end;
$$;

create trigger ministry_stage_guard
before insert or update or delete on public.candidate_stages
for each row execute function public.guard_ministry_progression();

create trigger ministry_medical_guard
before insert or update or delete on public.medical_results
for each row execute function public.guard_ministry_progression();

create trigger ministry_candidate_journey_guard
before insert or update or delete on public.candidates
for each row execute function public.guard_ministry_progression();
