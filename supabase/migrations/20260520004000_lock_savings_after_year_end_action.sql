create or replace function public.prevent_savings_change_after_year_end_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student uuid;
  target_period uuid;
begin
  target_student := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  target_period := case when tg_op = 'DELETE' then old.period_id else new.period_id end;

  if target_period is not null and exists (
    select 1
    from public.savings_year_end_actions syea
    where syea.student_id = target_student
      and syea.period_id = target_period
  ) then
    raise exception 'Tabungan siswa ini sudah diproses di Pengambilan Tabungan untuk tahun ajaran ini. Input atau koreksi tabungan dikunci karena akan masuk tahun ajaran berikutnya.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists prevent_savings_change_after_year_end_action_insert on public.savings_transactions;
create trigger prevent_savings_change_after_year_end_action_insert
before insert on public.savings_transactions
for each row execute function public.prevent_savings_change_after_year_end_action();

drop trigger if exists prevent_savings_change_after_year_end_action_update on public.savings_transactions;
create trigger prevent_savings_change_after_year_end_action_update
before update on public.savings_transactions
for each row execute function public.prevent_savings_change_after_year_end_action();

drop trigger if exists prevent_savings_change_after_year_end_action_delete on public.savings_transactions;
create trigger prevent_savings_change_after_year_end_action_delete
before delete on public.savings_transactions
for each row execute function public.prevent_savings_change_after_year_end_action();

comment on function public.prevent_savings_change_after_year_end_action() is
  'Mengunci transaksi tabungan siswa pada tahun ajaran yang sudah diproses di pengambilan tabungan akhir tahun.';
