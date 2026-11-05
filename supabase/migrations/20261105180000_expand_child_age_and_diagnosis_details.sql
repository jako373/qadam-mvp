-- Keep existing child profiles; expand the valid age range and add optional free text.
alter table public.children drop constraint if exists children_age_check;
alter table public.children add constraint children_age_check check (age between 2 and 18);
alter table public.children add column if not exists diagnosis_details text;
alter table public.children drop constraint if exists children_diagnosis_details_check;
alter table public.children add constraint children_diagnosis_details_check
  check (diagnosis_details is null or char_length(btrim(diagnosis_details)) between 1 and 160);
