-- The insert policy checks active catalogue IDs. Expose only those two columns,
-- never the exercise content or unpublished entries, to authenticated clients.
grant select(id, status) on public.exercise_catalog to authenticated;
create policy exercise_catalog_active_ids_read on public.exercise_catalog
for select to authenticated using (status = 'active');
