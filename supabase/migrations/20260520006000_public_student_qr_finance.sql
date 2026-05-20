create or replace function public.get_public_student_qr_finance(target_student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with student_row as (
    select
      s.id,
      s.name,
      s.nis,
      s.gender,
      s.note,
      c.id as class_id,
      c.name as class_name,
      c.grade,
      c.period_id,
      p.name as period_name
    from public.students s
    left join public.classes c on c.id = s.current_class_id
    left join public.periods p on p.id = c.period_id
    where s.id = target_student_id
    limit 1
  ),
  balance as (
    select coalesce(sum(
      case when st.type = 'setor' then st.amount else -st.amount end
    ), 0) as amount
    from public.savings_transactions st
    join student_row sr on sr.id = st.student_id
    where sr.period_id is null or st.period_id = sr.period_id
  ),
  savings_history as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.transaction_date desc, row_data.created_at desc), '[]'::jsonb) as rows
    from (
      select st.id, st.transaction_date, st.type, st.amount, st.category, st.note, st.created_at
      from public.savings_transactions st
      join student_row sr on sr.id = st.student_id
      where sr.period_id is null or st.period_id = sr.period_id
      order by st.transaction_date desc, st.created_at desc
      limit 20
    ) row_data
  ),
  charge_history as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.payment_date desc, row_data.created_at desc), '[]'::jsonb) as rows
    from (
      select cp.id, cp.payment_date, cp.amount_paid, cp.payment_method, cp.note, cp.created_at, cc.name as category_name
      from public.charge_payments cp
      join public.charge_categories cc on cc.id = cp.charge_category_id
      join student_row sr on sr.id = cp.student_id
      where sr.period_id is null or cc.period_id = sr.period_id
      order by cp.payment_date desc, cp.created_at desc
      limit 20
    ) row_data
  ),
  applicable_charges as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.name), '[]'::jsonb) as rows
    from (
      select
        cc.id,
        cc.name,
        cc.amount,
        cc.gender_scope,
        cc.allow_installments,
        coalesce(sum(cp.amount_paid), 0) as paid,
        greatest(cc.amount - coalesce(sum(cp.amount_paid), 0), 0) as remaining
      from public.charge_categories cc
      join student_row sr on sr.period_id = cc.period_id
      left join public.charge_payments cp on cp.charge_category_id = cc.id and cp.student_id = sr.id
      where (cc.gender_scope = 'all'::public.charge_gender_scope or cc.gender_scope::text = sr.gender)
        and (
          not exists (
            select 1 from public.charge_category_grades ccg
            where ccg.charge_category_id = cc.id
          )
          or exists (
            select 1 from public.charge_category_grades ccg
            where ccg.charge_category_id = cc.id
              and ccg.grade = sr.grade
          )
        )
      group by cc.id, cc.name, cc.amount, cc.gender_scope, cc.allow_installments
    ) row_data
  )
  select jsonb_build_object(
    'student', (
      select jsonb_build_object(
        'id', id,
        'name', name,
        'nis', nis,
        'gender', gender,
        'note', note,
        'class_id', class_id,
        'class_name', class_name,
        'grade', grade,
        'period_id', period_id,
        'period_name', period_name
      )
      from student_row
    ),
    'savings_balance', (select amount from balance),
    'savings_history', (select rows from savings_history),
    'charge_history', (select rows from charge_history),
    'charges', (select rows from applicable_charges)
  );
$$;

grant execute on function public.get_public_student_qr_finance(uuid) to anon, authenticated;
