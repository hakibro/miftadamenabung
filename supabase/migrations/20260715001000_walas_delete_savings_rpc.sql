create or replace function public.walas_delete_savings_transaction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.walas_can_access_student(
    (select student_id from public.savings_transactions where id = p_id)
  )) then
    raise exception 'Tidak punya akses';
  end if;

  delete from public.savings_transactions where id = p_id;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;
end;
$$;
