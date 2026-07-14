create or replace function public.delete_charge_payment(payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing record;
  year_end record;
begin
  select *
  into existing
  from public.charge_payments
  where id = payment_id;

  if existing.id is null then
    raise exception 'Pembayaran tagihan tidak ditemukan';
  end if;

  -- auth check: admin bebas, walas hanya transaksi hari ini
  if not public.is_admin() then
    if not public.walas_can_access_student(existing.student_id) then
      raise exception 'Tidak punya akses ke pembayaran tagihan ini';
    end if;
    if existing.payment_date <> current_date then
      raise exception 'Pembayaran tagihan pada tanggal ini tidak bisa dihapus oleh walas. Silakan hubungi admin untuk koreksi.';
    end if;
  end if;

  -- jika dari tabungan, cek dulu apakah tabungan sudah diproses year-end
  if existing.savings_transaction_id is not null then
    select syea.id into year_end
    from public.savings_year_end_actions syea
    join public.savings_transactions st on st.id = existing.savings_transaction_id
    where syea.student_id = existing.student_id
      and syea.period_id = st.period_id;

    if year_end.id is not null then
      raise exception 'Tabungan siswa ini sudah diproses di Pengambilan Tabungan untuk tahun ajaran ini. Pembayaran tagihan dari tabungan tidak bisa dihapus langsung. Hubungi admin untuk koreksi.';
    end if;

    delete from public.savings_transactions
    where id = existing.savings_transaction_id;
  end if;

  delete from public.charge_payments
  where id = payment_id;

  return true;
end;
$$;

grant execute on function public.delete_charge_payment(uuid) to authenticated;
