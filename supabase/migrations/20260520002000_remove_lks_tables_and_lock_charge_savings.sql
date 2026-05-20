alter table public.savings_transactions
  drop constraint if exists savings_transactions_category_check;

update public.savings_transactions
set category = 'charge'
where category = 'lks';

alter table public.savings_transactions
  add constraint savings_transactions_category_check
  check (category in ('manual', 'infaq', 'charge', 'year_end_cut', 'year_end_withdrawal'));

create or replace function public.prevent_linked_savings_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.infaq_payments ip
    where ip.savings_transaction_id = old.id
  ) then
    raise exception 'Transaksi tarik tabungan dari pembayaran infaq tidak bisa diedit atau dihapus langsung. Koreksi pembayaran infaq atau hubungi admin.';
  end if;

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

drop trigger if exists prevent_lks_savings_transaction_update on public.savings_transactions;
drop trigger if exists prevent_lks_savings_transaction_delete on public.savings_transactions;
drop trigger if exists prevent_linked_savings_transaction_update on public.savings_transactions;
create trigger prevent_linked_savings_transaction_update
before update on public.savings_transactions
for each row execute function public.prevent_linked_savings_transaction_change();

drop trigger if exists prevent_linked_savings_transaction_delete on public.savings_transactions;
create trigger prevent_linked_savings_transaction_delete
before delete on public.savings_transactions
for each row execute function public.prevent_linked_savings_transaction_change();

alter table public.infaq_payments
  alter column payment_method drop default;

alter table public.infaq_payments
  alter column payment_method type public.charge_payment_method
  using payment_method::text::public.charge_payment_method;

alter table public.infaq_payments
  alter column payment_method set default 'tunai'::public.charge_payment_method;

create or replace function public.create_infaq_payment(payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_payment_id uuid;
  new_savings_id uuid;
  target_student uuid := (payment ->> 'student_id')::uuid;
  target_period uuid := nullif(payment ->> 'period_id', '')::uuid;
  paid_amount numeric := (payment ->> 'amount')::numeric;
  method public.charge_payment_method := coalesce(payment ->> 'payment_method', 'tunai')::public.charge_payment_method;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  if target_period is null then
    select c.period_id into target_period
    from public.students s
    join public.classes c on c.id = s.current_class_id
    where s.id = target_student;
  end if;

  if method = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student, target_period) < paid_amount then
      raise exception 'Saldo tabungan tahun ajaran aktif siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (
      target_student,
      target_period,
      current_date,
      'tarik',
      paid_amount,
      'manual',
      'infaq',
      coalesce(payment ->> 'note', 'Pembayaran infaq dari tabungan'),
      auth.uid()
    )
    returning id into new_savings_id;
  end if;

  insert into public.infaq_payments (
    student_id,
    period_id,
    month,
    year,
    amount,
    status,
    note,
    payment_method,
    savings_transaction_id,
    created_by
  )
  values (
    target_student,
    target_period,
    (payment ->> 'month')::int,
    (payment ->> 'year')::int,
    paid_amount,
    coalesce(payment ->> 'status', 'lunas')::public.payment_status,
    payment ->> 'note',
    method,
    new_savings_id,
    auth.uid()
  )
  on conflict (student_id, period_id, month, year) do update
  set
    amount = excluded.amount,
    status = excluded.status,
    note = excluded.note,
    payment_method = excluded.payment_method,
    savings_transaction_id = excluded.savings_transaction_id,
    updated_at = now()
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

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
  infaq_total numeric,
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
  infaq as (
    select coalesce(sum(amount), 0) total
    from public.infaq_payments ip
    where ip.student_id in (select id from filtered_students)
      and (target_period_id is null or ip.period_id = target_period_id)
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
  select savings.deposit, savings.withdrawal, savings.deposit - savings.withdrawal, infaq.total, charges.total
  from savings, infaq, charges;
$$;

drop function if exists public.create_lks_payment(jsonb);
drop function if exists public.prevent_lks_savings_transaction_change();

drop table if exists public.lks_payments cascade;
drop table if exists public.lks_bill_class_amounts cascade;
drop table if exists public.lks_bills cascade;

drop type if exists public.lks_payment_method;

grant execute on function public.create_infaq_payment(jsonb) to authenticated;
grant execute on function public.get_finance_summary(uuid, uuid, uuid, date, date) to authenticated;
