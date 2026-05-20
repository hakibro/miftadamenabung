alter table public.savings_year_end_actions
  add column if not exists cut_amount numeric(14,2) not null default 0;

update public.savings_year_end_actions
set cut_amount = floor(balance_before * 0.05)
where cut_amount = 0
  and balance_before > 0;

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
  tx_id uuid;
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

  if target_action = 'cut_5_percent' then
    action_amount := calculated_cut;
  elsif target_action = 'withdrawn' then
    action_amount := balance;
  elsif target_action = 'saved' then
    action_amount := 0;
  else
    raise exception 'Aksi tidak dikenal';
  end if;

  if action_amount > 0 then
    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (
      target_student,
      target_period,
      current_date,
      'tarik',
      action_amount,
      'manual',
      case when target_action = 'cut_5_percent' then 'year_end_cut' else 'year_end_withdrawal' end,
      coalesce(action_payload ->> 'note', case when target_action = 'cut_5_percent' then 'Potongan akhir tahun ajaran 5%' else 'Pengambilan tabungan akhir tahun ajaran' end),
      auth.uid()
    )
    returning id into tx_id;
  end if;

  insert into public.savings_year_end_actions (
    student_id,
    period_id,
    action,
    balance_before,
    cut_amount,
    amount,
    savings_transaction_id,
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
    tx_id,
    action_payload ->> 'note',
    auth.uid()
  )
  returning id into action_id;

  return action_id;
end;
$$;

grant execute on function public.process_year_end_savings_action(jsonb) to authenticated;
