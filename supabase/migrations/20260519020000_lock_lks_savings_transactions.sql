create or replace function public.prevent_lks_savings_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.lks_payments lp
    where lp.savings_transaction_id = old.id
  ) then
    raise exception 'Transaksi tarik tabungan dari pembayaran LKS tidak bisa diedit atau dihapus langsung. Koreksi pembayaran LKS atau hubungi admin.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists prevent_lks_savings_transaction_update on public.savings_transactions;
create trigger prevent_lks_savings_transaction_update
before update on public.savings_transactions
for each row execute function public.prevent_lks_savings_transaction_change();

drop trigger if exists prevent_lks_savings_transaction_delete on public.savings_transactions;
create trigger prevent_lks_savings_transaction_delete
before delete on public.savings_transactions
for each row execute function public.prevent_lks_savings_transaction_change();
