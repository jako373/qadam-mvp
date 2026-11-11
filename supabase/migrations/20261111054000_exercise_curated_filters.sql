-- Editorial suitability fields are optional. Existing exercises remain available
-- but are not returned by an age or specialty filter until reviewed.
create function private.valid_exercise_curation(p_content jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_min text; v_max text; v_specialty text;
begin
  if (p_content ? 'ageMin') <> (p_content ? 'ageMax') then return false; end if;
  if p_content ? 'ageMin' then
    if pg_catalog.jsonb_typeof(p_content->'ageMin') <> 'number' or pg_catalog.jsonb_typeof(p_content->'ageMax') <> 'number' then return false; end if;
    v_min := p_content->>'ageMin'; v_max := p_content->>'ageMax';
    if v_min !~ '^(2|[3-9]|1[0-8])$' or v_max !~ '^(2|[3-9]|1[0-8])$' then return false; end if;
    if v_min::integer > v_max::integer then return false; end if;
  end if;
  if p_content ? 'difficulty' then
    if pg_catalog.jsonb_typeof(p_content->'difficulty') <> 'string'
      or p_content->>'difficulty' not in ('intro', 'standard', 'advanced') then return false; end if;
  end if;
  if p_content ? 'specialties' then
    if pg_catalog.jsonb_typeof(p_content->'specialties') <> 'array' then return false; end if;
    if pg_catalog.jsonb_array_length(p_content->'specialties') > 4 then return false; end if;
    for v_specialty in select pg_catalog.jsonb_array_elements_text(p_content->'specialties') loop
      if v_specialty is null or v_specialty not in ('speech', 'development', 'biofeedback', 'general') then return false; end if;
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_exercise_curation(jsonb) from public, anon, authenticated;
alter table public.exercise_catalog add constraint exercise_catalog_curated_metadata_check
  check (private.valid_exercise_curation(content));
