alter table public.savings_transactions
  drop constraint if exists savings_transactions_category_check;

update public.savings_transactions
set
  category = 'charge',
  note = coalesce(note, 'Migrasi pembayaran infaq ke tagihan')
where category = 'infaq';

alter table public.savings_transactions
  add constraint savings_transactions_category_check
  check (category in ('manual', 'charge', 'year_end_cut', 'year_end_withdrawal'));

create or replace function public.prevent_linked_savings_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.charge_payments cp
    where cp.savings_transaction_id = old.id
  ) then
    raise exception 'Transaksi tarik tabungan dari pembayaran tagihan tidak bisa diedit atau dihapus langsung. Koreksi pembayaran tagihan atau hubungi admin.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop function if exists public.create_infaq_payment(jsonb);
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
  with filtered_students as (
    select s.id
    from public.students s
    left join public.classes c on c.id = s.current_class_id
    where (target_student_id is null or s.id = target_student_id)
      and (target_class_id is null or s.current_class_id = target_class_id)
      and (target_period_id is null or c.period_id = target_period_id)
      and (public.is_admin() or public.is_bendahara() or public.walas_can_access_student(s.id))
  ),
  savings as (
    select
      coalesce(sum(amount) filter (where type = 'setor'), 0) deposit,
      coalesce(sum(amount) filter (where type = 'tarik'), 0) withdrawal
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

drop table if exists public.infaq_payments cascade;

alter table public.app_settings
  drop column if exists default_monthly_infaq,
  drop column if exists infaq_months_per_period;

grant execute on function public.get_finance_summary(uuid, uuid, uuid, date, date) to authenticated;
