create table if not exists public.lks_bill_class_amounts (
  id uuid primary key default gen_random_uuid(),
  lks_bill_id uuid not null references public.lks_bills(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lks_bill_id, class_id)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_lks_bill_class_amounts_updated_at'
  ) then
    create trigger set_lks_bill_class_amounts_updated_at
    before update on public.lks_bill_class_amounts
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.lks_bill_class_amounts enable row level security;

drop policy if exists "lks bill class amounts role read" on public.lks_bill_class_amounts;
create policy "lks bill class amounts role read" on public.lks_bill_class_amounts for select using (
  public.is_admin() or public.is_bendahara() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'walas'
      and p.assigned_class_id = lks_bill_class_amounts.class_id
  )
);

drop policy if exists "lks bill class amounts admin write" on public.lks_bill_class_amounts;
create policy "lks bill class amounts admin write" on public.lks_bill_class_amounts for all using (public.is_admin()) with check (public.is_admin());
