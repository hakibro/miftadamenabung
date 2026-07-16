-- Migration: Allow walas to edit charge payments on any date
-- Removes same-day restriction & allows editing savings-linked charge payments
-- (with safety: linked savings transaction amount stays in sync)
create or replace function public.update_charge_payment(payment_id uuid, payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing record;
  target_charge uuid;
  paid_amount numeric;
  target_date date;
  target_note text;
  charge_amount numeric;
  allow_partial boolean;
  already_paid numeric;
  available_amount numeric;
  old_amount numeric;
  old_savings_id uuid;
  old_period_id uuid;
begin
  select *
  into existing
  from public.charge_payments
  where id = payment_id;

  if existing.id is null then
    raise exception 'Pembayaran tagihan tidak ditemukan';
  end if;

  if not public.is_admin() then
    if not public.walas_can_access_student(existing.student_id) then
      raise exception 'Tidak punya akses ke pembayaran tagihan ini';
    end if;
  end if;

  target_charge := coalesce(nullif(payment ->> 'charge_category_id', '')::uuid, existing.charge_category_id);
  paid_amount := coalesce(nullif(payment ->> 'amount_paid', '')::numeric, existing.amount_paid);
  target_date := coalesce(nullif(payment ->> 'payment_date', '')::date, existing.payment_date);
  target_note := payment ->> 'note';

  select amount, allow_installments
  into charge_amount, allow_partial
  from public.charge_categories
  where id = target_charge;

  if charge_amount is null then
    raise exception 'Tagihan tidak ditemukan';
  end if;

  select coalesce(sum(amount_paid), 0)
  into already_paid
  from public.charge_payments
  where student_id = existing.student_id
    and charge_category_id = target_charge
    and id <> existing.id;

  available_amount := charge_amount - already_paid;

  if paid_amount <= 0 then
    raise exception 'Nominal bayar harus lebih dari 0';
  end if;

  if paid_amount > available_amount then
    raise exception 'Nominal bayar melebihi sisa tagihan';
  end if;

  if allow_partial = false and paid_amount <> available_amount then
    raise exception 'Tagihan ini harus dibayar lunas sesuai sisa tagihan';
  end if;

  -- jika dari tabungan, update linked savings transaction amount
  if existing.savings_transaction_id is not null then
    old_amount := existing.amount_paid;
    old_savings_id := existing.savings_transaction_id;

    select st.period_id into old_period_id
    from public.savings_transactions st
    where st.id = old_savings_id;

    -- cek year-end lock
    if exists (
      select 1 from public.savings_year_end_actions syea
      where syea.student_id = existing.student_id
        and syea.period_id = old_period_id
    ) then
      raise exception 'Tabungan siswa ini sudah diproses di Pengambilan Tabungan untuk tahun ajaran ini. Pembayaran tagihan dari tabungan tidak bisa diedit. Hubungi admin untuk koreksi.';
    end if;

    -- update savings amount to match new charge amount
    update public.savings_transactions
    set amount = paid_amount,
        note = coalesce(target_note, 'Pembayaran tagihan dari tabungan'),
        updated_at = now()
    where id = old_savings_id;
  end if;

  update public.charge_payments
  set
    charge_category_id = target_charge,
    amount_paid = paid_amount,
    payment_date = target_date,
    note = target_note,
    updated_at = now()
  where id = existing.id;

  return existing.id;
end;
$$;

grant execute on function public.update_charge_payment(uuid, jsonb) to authenticated;
