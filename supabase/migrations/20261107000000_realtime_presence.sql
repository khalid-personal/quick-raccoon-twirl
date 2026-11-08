create policy "Approved users can read DAWM presence"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'dawm-presence'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_approved = true
  )
);

create policy "Approved users can report DAWM presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() = 'dawm-presence'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_approved = true
  )
);
