alter table public.savings_year_end_actions
  add column if not exists cut_savings_transaction_id uuid references public.savings_transactions(id) on delete set null;

create or replace function public.process_year_end_savings_action(action_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student uuid := (action_payload ->> 'student_id')::uuid;
  target_period uuid := (action_payload ->> 'period_id')::uuid;
  target_action text := action_payload ->> 'action';
  balance numeric;
  action_amount numeric := 0;
  calculated_cut numeric := 0;
  after_cut numeric := 0;
  cut_tx_id uuid;
  withdrawal_tx_id uuid;
  action_id uuid;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Hanya admin atau walas kelas terkait yang bisa memproses pengambilan tabungan';
  end if;

  if exists (
    select 1
    from public.savings_year_end_actions syea
    where syea.student_id = target_student
      and syea.period_id = target_period
  ) then
    raise exception 'Pengambilan tabungan siswa ini sudah diproses untuk tahun ajaran tersebut';
  end if;

  balance := public.get_student_savings_balance(target_student, target_period);
  calculated_cut := floor(balance * 0.05);
  after_cut := greatest(balance - calculated_cut, 0);

  if target_action not in ('saved', 'withdrawn') then
    raise exception 'Aksi tidak dikenal';
  end if;

  if calculated_cut > 0 then
    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (
      target_student,
      target_period,
      current_date,
      'tarik',
      calculated_cut,
      'manual',
      'year_end_cut',
      coalesce(action_payload ->> 'cut_note', 'Bagi hasil sekolah 5% akhir tahun ajaran'),
      auth.uid()
    )
    returning id into cut_tx_id;
  end if;

  if target_action = 'withdrawn' then
    action_amount := after_cut;

    if after_cut > 0 then
      insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
      values (
        target_student,
        target_period,
        current_date,
        'tarik',
        after_cut,
        'manual',
        'year_end_withdrawal',
        coalesce(action_payload ->> 'note', 'Pengambilan tabungan akhir tahun ajaran setelah bagi hasil 5%'),
        auth.uid()
      )
      returning id into withdrawal_tx_id;
    end if;
  end if;

  insert into public.savings_year_end_actions (
    student_id,
    period_id,
    action,
    balance_before,
    cut_amount,
    amount,
    savings_transaction_id,
    cut_savings_transaction_id,
    note,
    created_by
  )
  values (
    target_student,
    target_period,
    target_action,
    balance,
    calculated_cut,
    action_amount,
    coalesce(withdrawal_tx_id, cut_tx_id),
    cut_tx_id,
    action_payload ->> 'note',
    auth.uid()
  )
  returning id into action_id;

  return action_id;
end;
$$;

grant execute on function public.process_year_end_savings_action(jsonb) to authenticated;
