-- Run against a project containing at least one center student. Every assertion
-- returns 1; a permission error, recursion error, or zero-denominator fails.
begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from public.center_staff where role = 'admin' limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
select 1 / (case when count(*) > 0 then 1 else 0 end) as admin_reads_students
from public.center_students;
select 1 / (case when count(*) > 0 then 1 else 0 end) as admin_reads_children
from public.children where id in (select child_id from public.center_students);
rollback;

begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select c.parent_id from public.children c join public.center_students cs on cs.child_id = c.id limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
select 1 / (case when count(*) > 0 then 1 else 0 end) as parent_reads_own_center_student
from public.center_students;
rollback;

begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select u.id from auth.users u
    where not exists (select 1 from public.children c where c.parent_id = u.id)
      and not exists (select 1 from public.center_staff s where s.user_id = u.id)
    limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
select 1 / (case when (select auth.uid()) is not null and count(*) = 0 then 1 else 0 end)
  as unrelated_user_cannot_read_center_student from public.center_students;
rollback;
