create or replace function public.create_lks_payment(payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_payment_id uuid;
  new_savings_id uuid;
  target_student uuid := (payment ->> 'student_id')::uuid;
  target_bill uuid := (payment ->> 'lks_bill_id')::uuid;
  paid_amount numeric := (payment ->> 'amount_paid')::numeric;
  target_class uuid;
  bill_amount numeric;
  already_paid numeric;
  final_status public.payment_status;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  select current_class_id into target_class
  from public.students
  where id = target_student;

  select coalesce(lkca.amount, lb.total_amount)
  into bill_amount
  from public.lks_bills lb
  left join public.lks_bill_class_amounts lkca
    on lkca.lks_bill_id = lb.id
   and lkca.class_id = target_class
  where lb.id = target_bill;

  if bill_amount is null then
    raise exception 'Tagihan LKS tidak ditemukan';
  end if;

  select coalesce(sum(amount_paid), 0)
  into already_paid
  from public.lks_payments
  where student_id = target_student
    and lks_bill_id = target_bill;

  final_status := case
    when already_paid + paid_amount >= bill_amount then 'lunas'::public.payment_status
    when already_paid + paid_amount > 0 then 'sebagian'::public.payment_status
    else 'belum_bayar'::public.payment_status
  end;

  if (payment ->> 'payment_method') = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student) < paid_amount then
      raise exception 'Saldo tabungan siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, transaction_date, type, amount, input_method, note, created_by)
    values (target_student, coalesce((payment ->> 'payment_date')::date, current_date), 'tarik', paid_amount, 'manual', coalesce(payment ->> 'note', 'Pembayaran LKS dari tabungan'), auth.uid())
    returning id into new_savings_id;
  end if;

  insert into public.lks_payments (student_id, lks_bill_id, amount_paid, payment_date, payment_method, status, savings_transaction_id, note, created_by)
  values (
    target_student,
    target_bill,
    paid_amount,
    coalesce((payment ->> 'payment_date')::date, current_date),
    coalesce(payment ->> 'payment_method', 'tunai')::public.lks_payment_method,
    final_status,
    new_savings_id,
    payment ->> 'note',
    auth.uid()
  )
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

grant execute on function public.create_lks_payment(jsonb) to authenticated;
