-- Cover the staff foreign key and center-scoped roster lookups.
create index center_specialist_students_center_owner_idx
  on public.center_specialist_students(center_id, specialist_id);
