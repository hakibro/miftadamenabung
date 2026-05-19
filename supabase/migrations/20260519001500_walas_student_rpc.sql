create or replace function public.list_my_walas_students()
returns table (
  id uuid,
  name text,
  nis text,
  gender text,
  current_class_id uuid,
  is_active boolean,
  note text,
  current_class jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.nis,
    s.gender,
    s.current_class_id,
    s.is_active,
    s.note,
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'grade', c.grade,
      'period_id', c.period_id,
      'periods', jsonb_build_object(
        'name', pe.name,
        'start_date', pe.start_date,
        'end_date', pe.end_date
      )
    ) as current_class
  from public.students s
  join public.profiles p on p.id = auth.uid()
  left join public.classes c on c.id = s.current_class_id
  left join public.periods pe on pe.id = c.period_id
  where p.role = 'walas'
    and p.is_active = true
    and s.is_active = true
    and s.current_class_id = p.assigned_class_id
  order by s.name;
$$;

grant execute on function public.list_my_walas_students() to authenticated;
