alter table public.infaq_payments
  add column if not exists payment_method public.lks_payment_method not null default 'tunai',
  add column if not exists savings_transaction_id uuid references public.savings_transactions(id) on delete set null;

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
  paid_amount numeric := (payment ->> 'amount')::numeric;
  method public.lks_payment_method := coalesce(payment ->> 'payment_method', 'tunai')::public.lks_payment_method;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  if method = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student) < paid_amount then
      raise exception 'Saldo tabungan siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, transaction_date, type, amount, input_method, note, created_by)
    values (
      target_student,
      current_date,
      'tarik',
      paid_amount,
      'manual',
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
    nullif(payment ->> 'period_id', '')::uuid,
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

grant execute on function public.create_infaq_payment(jsonb) to authenticated;
