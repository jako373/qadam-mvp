-- The parent SELECT policy must not read children under its own RLS policy:
-- children staff access reads center_students, creating an infinite cycle.
create function private.center_parent_owns_child(p_child_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.children c
    where c.id = p_child_id and c.parent_id = (select auth.uid())
  );
$$;
revoke all on function private.center_parent_owns_child(uuid) from public, anon;
grant execute on function private.center_parent_owns_child(uuid) to authenticated;

drop policy if exists center_students_parent_read on public.center_students;
create policy center_students_parent_read on public.center_students for select to authenticated
  using ((select private.center_parent_owns_child(child_id)));
