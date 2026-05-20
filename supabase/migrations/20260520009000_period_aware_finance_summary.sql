drop function if exists public.get_finance_summary(uuid, uuid, uuid, date, date);

create function public.get_finance_summary(
  target_period_id uuid default null,
  target_class_id uuid default null,
  target_student_id uuid default null,
  start_date date default null,
  end_date date default null
)
returns table (
  savings_deposit numeric,
  savings_withdrawal numeric,
  savings_balance numeric,
  charge_total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with accessible_students as (
    select s.id
    from public.students s
    where (target_student_id is null or s.id = target_student_id)
      and (public.is_admin() or public.is_bendahara() or public.walas_can_access_student(s.id))
  ),
  class_memberships as (
    select s.id as student_id, s.current_class_id as class_id, c.period_id
    from public.students s
    left join public.classes c on c.id = s.current_class_id
    where s.current_class_id is not null
    union
    select sch.student_id, sch.class_id, sch.period_id
    from public.student_class_histories sch
    where sch.class_id is not null
  ),
  filtered_students as (
    select ast.id
    from accessible_students ast
    where (
        target_class_id is null
        or exists (
          select 1
          from class_memberships cm
          where cm.student_id = ast.id
            and cm.class_id = target_class_id
            and (target_period_id is null or cm.period_id = target_period_id)
        )
      )
  ),
  savings as (
    select
      coalesce(sum(st.amount) filter (where st.type = 'setor'), 0) deposit,
      coalesce(sum(st.amount) filter (where st.type = 'tarik'), 0) withdrawal
    from public.savings_transactions st
    where st.student_id in (select id from filtered_students)
      and (target_period_id is null or st.period_id = target_period_id)
      and (start_date is null or st.transaction_date >= start_date)
      and (end_date is null or st.transaction_date <= end_date)
  ),
  charges as (
    select coalesce(sum(cp.amount_paid), 0) total
    from public.charge_payments cp
    join public.charge_categories cc on cc.id = cp.charge_category_id
    where cp.student_id in (select id from filtered_students)
      and (target_period_id is null or cc.period_id = target_period_id)
      and (start_date is null or cp.payment_date >= start_date)
      and (end_date is null or cp.payment_date <= end_date)
  )
  select savings.deposit, savings.withdrawal, savings.deposit - savings.withdrawal, charges.total
  from savings, charges;
$$;

grant execute on function public.get_finance_summary(uuid, uuid, uuid, date, date) to authenticated;
