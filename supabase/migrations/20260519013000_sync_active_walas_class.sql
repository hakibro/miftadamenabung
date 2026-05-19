create or replace function public.sync_active_class_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_period_id uuid;
  assigned_period_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select id into active_period_id
  from public.periods
  where is_active = true
  limit 1;

  if active_period_id is null then
    return new;
  end if;

  if TG_OP = 'UPDATE' and (new.role is distinct from 'walas' or new.assigned_class_id is null) then
    update public.classes
    set homeroom_teacher_id = null
    where period_id = active_period_id
      and homeroom_teacher_id = new.id;
  end if;

  if new.role = 'walas' and new.assigned_class_id is not null then
    select period_id into assigned_period_id
    from public.classes
    where id = new.assigned_class_id;

    if assigned_period_id = active_period_id then
      update public.classes
      set homeroom_teacher_id = null
      where period_id = active_period_id
        and homeroom_teacher_id = new.id
        and id <> new.assigned_class_id;

      update public.classes
      set homeroom_teacher_id = new.id
      where id = new.assigned_class_id
        and period_id = active_period_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_from_active_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_period_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select id into active_period_id
  from public.periods
  where is_active = true
  limit 1;

  if active_period_id is null or new.period_id <> active_period_id then
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.homeroom_teacher_id is not null and old.homeroom_teacher_id is distinct from new.homeroom_teacher_id then
    update public.profiles
    set assigned_class_id = null
    where id = old.homeroom_teacher_id
      and role = 'walas'
      and assigned_class_id = new.id;
  end if;

  if new.homeroom_teacher_id is not null then
    update public.profiles
    set assigned_class_id = null
    where role = 'walas'
      and assigned_class_id = new.id
      and id <> new.homeroom_teacher_id;

    update public.profiles
    set assigned_class_id = new.id
    where id = new.homeroom_teacher_id
      and role = 'walas';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_active_class_from_profile_trigger on public.profiles;
create trigger sync_active_class_from_profile_trigger
after insert or update of role, assigned_class_id on public.profiles
for each row execute function public.sync_active_class_from_profile();

drop trigger if exists sync_profile_from_active_class_trigger on public.classes;
create trigger sync_profile_from_active_class_trigger
after insert or update of homeroom_teacher_id, period_id on public.classes
for each row execute function public.sync_profile_from_active_class();
