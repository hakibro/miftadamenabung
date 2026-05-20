alter table public.savings_transactions
  add column if not exists period_id uuid references public.periods(id) on delete restrict,
  add column if not exists category text not null default 'manual';

alter table public.savings_transactions
  drop constraint if exists savings_transactions_category_check;

alter table public.savings_transactions
  add constraint savings_transactions_category_check
  check (category in ('manual', 'lks', 'infaq', 'charge', 'year_end_cut', 'year_end_withdrawal'));

update public.savings_transactions st
set period_id = c.period_id
from public.students s
join public.classes c on c.id = s.current_class_id
where st.student_id = s.id
  and st.period_id is null;

create table if not exists public.savings_year_end_actions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete restrict,
  action text not null check (action in ('saved', 'withdrawn', 'cut_5_percent')),
  balance_before numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  savings_transaction_id uuid references public.savings_transactions(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (student_id, period_id)
);

alter table public.savings_year_end_actions
  drop constraint if exists savings_year_end_actions_student_id_period_id_action_key;

alter table public.savings_year_end_actions
  drop constraint if exists savings_year_end_actions_student_id_period_id_key;

alter table public.savings_year_end_actions
  add constraint savings_year_end_actions_student_id_period_id_key unique (student_id, period_id);

do $$
begin
  create type public.charge_gender_scope as enum ('all', 'L', 'P');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.charge_payment_method as enum ('tunai', 'dari_tabungan');
exception when duplicate_object then null;
end $$;

create table if not exists public.charge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_id uuid not null references public.periods(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  allow_installments boolean not null default true,
  gender_scope public.charge_gender_scope not null default 'all',
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.charge_category_grades (
  id uuid primary key default gen_random_uuid(),
  charge_category_id uuid not null references public.charge_categories(id) on delete cascade,
  grade int not null check (grade between 1 and 6),
  unique (charge_category_id, grade)
);

create table if not exists public.charge_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  charge_category_id uuid not null references public.charge_categories(id) on delete cascade,
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  payment_date date not null default current_date,
  payment_method public.charge_payment_method not null default 'tunai',
  savings_transaction_id uuid references public.savings_transactions(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    if not exists (select 1 from pg_trigger where tgname = 'set_charge_categories_updated_at') then
      create trigger set_charge_categories_updated_at
      before update on public.charge_categories
      for each row execute function public.set_updated_at();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'set_charge_payments_updated_at') then
      create trigger set_charge_payments_updated_at
      before update on public.charge_payments
      for each row execute function public.set_updated_at();
    end if;
  end if;
end;
$$;

create or replace function public.get_student_savings_balance(target_student_id uuid, target_period_id uuid default null)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case when type = 'setor' then amount else -amount end), 0)
  from public.savings_transactions
  where student_id = target_student_id
    and (target_period_id is null or period_id = target_period_id);
$$;

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
  bill_period uuid;
  already_paid numeric;
  final_status public.payment_status;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  select current_class_id into target_class from public.students where id = target_student;

  select coalesce(lkca.amount, lb.total_amount), lb.period_id
  into bill_amount, bill_period
  from public.lks_bills lb
  left join public.lks_bill_class_amounts lkca on lkca.lks_bill_id = lb.id and lkca.class_id = target_class
  where lb.id = target_bill;

  if bill_amount is null then raise exception 'Tagihan LKS tidak ditemukan'; end if;

  select coalesce(sum(amount_paid), 0) into already_paid
  from public.lks_payments
  where student_id = target_student and lks_bill_id = target_bill;

  final_status := case
    when already_paid + paid_amount >= bill_amount then 'lunas'::public.payment_status
    when already_paid + paid_amount > 0 then 'sebagian'::public.payment_status
    else 'belum_bayar'::public.payment_status
  end;

  if (payment ->> 'payment_method') = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student, bill_period) < paid_amount then
      raise exception 'Saldo tabungan tahun ajaran aktif siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (target_student, bill_period, coalesce((payment ->> 'payment_date')::date, current_date), 'tarik', paid_amount, 'manual', 'lks', coalesce(payment ->> 'note', 'Pembayaran LKS dari tabungan'), auth.uid())
    returning id into new_savings_id;
  end if;

  insert into public.lks_payments (student_id, lks_bill_id, amount_paid, payment_date, payment_method, status, savings_transaction_id, note, created_by)
  values (target_student, target_bill, paid_amount, coalesce((payment ->> 'payment_date')::date, current_date), coalesce(payment ->> 'payment_method', 'tunai')::public.lks_payment_method, final_status, new_savings_id, payment ->> 'note', auth.uid())
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

create or replace function public.create_infaq_payment(payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_payment_id uuid;
  new_savings_id uuid;
  target_student uuid := (payment ->> 'student_id')::uuid;
  target_period uuid := nullif(payment ->> 'period_id', '')::uuid;
  paid_amount numeric := (payment ->> 'amount')::numeric;
  method public.lks_payment_method := coalesce(payment ->> 'payment_method', 'tunai')::public.lks_payment_method;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  if target_period is null then
    select c.period_id into target_period
    from public.students s
    join public.classes c on c.id = s.current_class_id
    where s.id = target_student;
  end if;

  if method = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student, target_period) < paid_amount then
      raise exception 'Saldo tabungan tahun ajaran aktif siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (
      target_student,
      target_period,
      current_date,
      'tarik',
      paid_amount,
      'manual',
      'infaq',
      coalesce(payment ->> 'note', 'Pembayaran infaq dari tabungan'),
      auth.uid()
    )
    returning id into new_savings_id;
  end if;

  insert into public.infaq_payments (
    student_id,
    period_id,
    month,
    year,
    amount,
    status,
    note,
    payment_method,
    savings_transaction_id,
    created_by
  )
  values (
    target_student,
    target_period,
    (payment ->> 'month')::int,
    (payment ->> 'year')::int,
    paid_amount,
    coalesce(payment ->> 'status', 'lunas')::public.payment_status,
    payment ->> 'note',
    method,
    new_savings_id,
    auth.uid()
  )
  on conflict (student_id, period_id, month, year) do update
  set
    amount = excluded.amount,
    status = excluded.status,
    note = excluded.note,
    payment_method = excluded.payment_method,
    savings_transaction_id = excluded.savings_transaction_id,
    updated_at = now()
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

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

  if target_action = 'cut_5_percent' then
    action_amount := floor(balance * 0.05);
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

  insert into public.savings_year_end_actions (student_id, period_id, action, balance_before, amount, savings_transaction_id, note, created_by)
  values (target_student, target_period, target_action, balance, action_amount, tx_id, action_payload ->> 'note', auth.uid())
  returning id into action_id;

  return action_id;
end;
$$;

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
  student_period uuid;
  student_grade int;
  student_gender text;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  select period_id, gender_scope
  into charge_period, charge_gender
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

  if (payment ->> 'payment_method') = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student, charge_period) < paid_amount then
      raise exception 'Saldo tabungan tahun ajaran aktif siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, period_id, transaction_date, type, amount, input_method, category, note, created_by)
    values (target_student, charge_period, coalesce((payment ->> 'payment_date')::date, current_date), 'tarik', paid_amount, 'manual', 'charge', coalesce(payment ->> 'note', 'Pembayaran tagihan dari tabungan'), auth.uid())
    returning id into new_savings_id;
  end if;

  insert into public.charge_payments (student_id, charge_category_id, amount_paid, payment_date, payment_method, savings_transaction_id, note, created_by)
  values (target_student, target_charge, paid_amount, coalesce((payment ->> 'payment_date')::date, current_date), coalesce(payment ->> 'payment_method', 'tunai')::public.charge_payment_method, new_savings_id, payment ->> 'note', auth.uid())
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

create or replace function public.get_finance_summary(
  target_period_id uuid default null,
  target_class_id uuid default null,
  target_student_id uuid default null,
  start_date date default null,
  end_date date default null
)
returns table (
  savings_deposit numeric,
  savings_withdrawal numeric,
  savings_balance numeric,
  infaq_total numeric,
  lks_total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered_students as (
    select s.id
    from public.students s
    left join public.classes c on c.id = s.current_class_id
    where (target_student_id is null or s.id = target_student_id)
      and (target_class_id is null or s.current_class_id = target_class_id)
      and (target_period_id is null or c.period_id = target_period_id)
      and (public.is_admin() or public.is_bendahara() or public.walas_can_access_student(s.id))
  ),
  savings as (
    select
      coalesce(sum(amount) filter (where type = 'setor'), 0) deposit,
      coalesce(sum(amount) filter (where type = 'tarik'), 0) withdrawal
    from public.savings_transactions st
    where st.student_id in (select id from filtered_students)
      and (target_period_id is null or st.period_id = target_period_id)
      and (start_date is null or st.transaction_date >= start_date)
      and (end_date is null or st.transaction_date <= end_date)
  ),
  infaq as (
    select coalesce(sum(amount), 0) total
    from public.infaq_payments ip
    where ip.student_id in (select id from filtered_students)
      and (target_period_id is null or ip.period_id = target_period_id)
  ),
  lks as (
    select coalesce(sum(lp.amount_paid), 0) total
    from public.lks_payments lp
    join public.lks_bills lb on lb.id = lp.lks_bill_id
    where lp.student_id in (select id from filtered_students)
      and (target_period_id is null or lb.period_id = target_period_id)
      and (start_date is null or lp.payment_date >= start_date)
      and (end_date is null or lp.payment_date <= end_date)
  )
  select savings.deposit, savings.withdrawal, savings.deposit - savings.withdrawal, infaq.total, lks.total
  from savings, infaq, lks;
$$;

alter table public.savings_year_end_actions enable row level security;
alter table public.charge_categories enable row level security;
alter table public.charge_category_grades enable row level security;
alter table public.charge_payments enable row level security;

drop policy if exists "savings year end admin read write" on public.savings_year_end_actions;
create policy "savings year end admin read write" on public.savings_year_end_actions for all using (
  public.is_admin() or public.walas_can_access_student(student_id)
) with check (
  public.is_admin() or public.walas_can_access_student(student_id)
);

drop policy if exists "charge categories role read" on public.charge_categories;
create policy "charge categories role read" on public.charge_categories for select using (public.is_admin() or public.is_bendahara() or public.is_walas());
drop policy if exists "charge categories admin write" on public.charge_categories;
create policy "charge categories admin write" on public.charge_categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "charge category grades role read" on public.charge_category_grades;
create policy "charge category grades role read" on public.charge_category_grades for select using (public.is_admin() or public.is_bendahara() or public.is_walas());
drop policy if exists "charge category grades admin write" on public.charge_category_grades;
create policy "charge category grades admin write" on public.charge_category_grades for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "charge payments role read" on public.charge_payments;
create policy "charge payments role read" on public.charge_payments for select using (
  public.is_admin() or public.is_bendahara() or public.walas_can_access_student(student_id)
);
drop policy if exists "charge payments admin walas insert" on public.charge_payments;
create policy "charge payments admin walas insert" on public.charge_payments for insert with check (
  public.is_admin() or public.walas_can_access_student(student_id)
);
drop policy if exists "charge payments admin walas update" on public.charge_payments;
create policy "charge payments admin walas update" on public.charge_payments for update using (
  (public.is_admin() or public.walas_can_access_student(student_id))
  and savings_transaction_id is null
) with check (
  (public.is_admin() or public.walas_can_access_student(student_id))
  and savings_transaction_id is null
);

grant execute on function public.process_year_end_savings_action(jsonb) to authenticated;
grant execute on function public.create_charge_payment(jsonb) to authenticated;
grant execute on function public.create_infaq_payment(jsonb) to authenticated;
grant execute on function public.get_finance_summary(uuid, uuid, uuid, date, date) to authenticated;
