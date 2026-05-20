create or replace function public.create_charge_payment(payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_payment_id uuid;
  new_savings_id uuid;
  target_student uuid := (payment ->> 'student_id')::uuid;
  target_charge uuid := (payment ->> 'charge_category_id')::uuid;
  paid_amount numeric := (payment ->> 'amount_paid')::numeric;
  charge_period uuid;
  charge_gender public.charge_gender_scope;
  charge_name text;
  charge_amount numeric;
  allow_partial boolean;
  already_paid numeric;
  remaining_amount numeric;
  student_period uuid;
  student_grade int;
  student_gender text;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  select period_id, gender_scope, name, amount, allow_installments
  into charge_period, charge_gender, charge_name, charge_amount, allow_partial
  from public.charge_categories
  where id = target_charge;
  if charge_period is null then raise exception 'Tagihan tidak ditemukan'; end if;

  select c.period_id, c.grade, s.gender
  into student_period, student_grade, student_gender
  from public.students s
  join public.classes c on c.id = s.current_class_id
  where s.id = target_student;

  if student_period is distinct from charge_period then
    raise exception 'Tagihan tidak berlaku untuk tahun ajaran siswa ini';
  end if;

  if charge_gender <> 'all' and student_gender <> charge_gender::text then
    raise exception 'Tagihan tidak berlaku untuk jenis kelamin siswa ini';
  end if;

  if exists (select 1 from public.charge_category_grades where charge_category_id = target_charge)
    and not exists (
      select 1
      from public.charge_category_grades
      where charge_category_id = target_charge
        and grade = student_grade
    ) then
    raise exception 'Tagihan tidak berlaku untuk tingkat kelas siswa ini';
  end if;

  select coalesce(sum(amount_paid), 0)
  into already_paid
  from public.charge_payments
  where student_id = target_student
    and charge_category_id = target_charge;

  remaining_amount := charge_amount - already_paid;

  if remaining_amount <= 0 then
    raise exception 'Tagihan ini sudah lunas';
  end if;

  if paid_amount <= 0 then
    raise exception 'Nominal bayar harus lebih dari 0';
  end if;

  if paid_amount > remaining_amount then
    raise exception 'Nominal bayar melebihi sisa tagihan';
  end if;

  if allow_partial = false and paid_amount <> remaining_amount then
    raise exception 'Tagihan ini harus dibayar lunas sesuai sisa tagihan';
  end if;

  if (payment ->> 'payment_method') = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student, charge_period) < paid_amount then
      raise exception 'Saldo tabungan tahun ajaran aktif siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (
      target_student,
      charge_period,
      coalesce((payment ->> 'payment_date')::date, current_date),
      'tarik',
      paid_amount,
      'manual',
      'charge',
      coalesce(payment ->> 'note', 'Pembayaran tagihan ' || charge_name || ' dari tabungan'),
      auth.uid()
    )
    returning id into new_savings_id;
  end if;

  insert into public.charge_payments (student_id, charge_category_id, amount_paid, payment_date, payment_method, savings_transaction_id, note, created_by)
  values (
    target_student,
    target_charge,
    paid_amount,
    coalesce((payment ->> 'payment_date')::date, current_date),
    coalesce(payment ->> 'payment_method', 'tunai')::public.charge_payment_method,
    new_savings_id,
    payment ->> 'note',
    auth.uid()
  )
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

grant execute on function public.create_charge_payment(jsonb) to authenticated;
