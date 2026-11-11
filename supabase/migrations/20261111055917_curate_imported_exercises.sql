-- Provisional pedagogical filters for the original catalogue. Chronological age is
-- an inclusive search hint, not a diagnosis or a substitute for specialist assessment.
-- Preserve all custom content and any metadata already set by a human editor.
update public.exercise_catalog as e
set content = e.content || jsonb_build_object(
  'ageMin', e.level + 1,
  'ageMax', 18,
  'difficulty', (array['intro', 'standard', 'advanced'])[e.level],
  'specialties', case
    when e.category = 'imitation' and e.id in ('imitation-07', 'imitation-08', 'imitation-15') then '["development","speech"]'::jsonb
    when e.category in ('joint_attention', 'understanding', 'communication') then '["speech","development"]'::jsonb
    when e.category in ('imitation', 'play_thinking') then '["development"]'::jsonb
    else '["general"]'::jsonb
  end
), updated_at = now()
where e.source = 'import'
  and e.status = 'active'
  and e.level between 1 and 3
  and e.category in ('joint_attention', 'understanding', 'imitation', 'communication', 'play_thinking', 'fine_motor', 'regulation', 'daily_social')
  and not (e.content ?| array['ageMin', 'ageMax', 'specialties', 'difficulty']);
