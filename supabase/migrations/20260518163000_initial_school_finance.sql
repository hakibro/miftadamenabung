create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'bendahara', 'walas');
create type public.savings_transaction_type as enum ('setor', 'tarik');
create type public.input_method as enum ('manual', 'scan_qr');
create type public.payment_status as enum ('belum_bayar', 'sebagian', 'lunas');
create type public.lks_payment_method as enum ('tunai', 'dari_tabungan');
create type public.student_history_status as enum ('aktif', 'naik', 'tinggal', 'lulus', 'keluar');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'walas',
  assigned_class_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index periods_one_active_idx on public.periods (is_active) where is_active = true;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade int not null,
  period_id uuid not null references public.periods(id) on delete restrict,
  homeroom_teacher_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, period_id)
);

alter table public.profiles
  add constraint profiles_assigned_class_id_fkey foreign key (assigned_class_id) references public.classes(id) on delete set null;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nis text not null unique,
  gender text not null check (gender in ('L', 'P')),
  current_class_id uuid references public.classes(id) on delete set null,
  is_active boolean not null default true,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_class_histories (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  period_id uuid references public.periods(id) on delete restrict,
  status public.student_history_status not null default 'aktif',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  transaction_date date not null default current_date,
  type public.savings_transaction_type not null default 'setor',
  amount numeric(14,2) not null check (amount > 0),
  input_method public.input_method not null default 'manual',
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.infaq_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  period_id uuid references public.periods(id) on delete restrict,
  month int not null check (month between 1 and 12),
  year int not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  status public.payment_status not null default 'belum_bayar',
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, period_id, month, year)
);

create table public.lks_bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_id uuid not null references public.periods(id) on delete restrict,
  semester int not null default 1 check (semester in (1, 2)),
  class_id uuid references public.classes(id) on delete cascade,
  total_amount numeric(14,2) not null check (total_amount > 0),
  due_date date,
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index lks_bills_period_semester_name_idx on public.lks_bills (period_id, semester, lower(name));

create table public.lks_bill_class_amounts (
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

create table public.lks_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lks_bill_id uuid not null references public.lks_bills(id) on delete cascade,
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  payment_date date not null default current_date,
  payment_method public.lks_payment_method not null default 'tunai',
  status public.payment_status not null default 'lunas',
  savings_transaction_id uuid references public.savings_transactions(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  app_name text not null default 'Sistem Keuangan Kelas',
  school_name text,
  logo_url text,
  default_monthly_infaq numeric(14,2) not null default 0,
  infaq_months_per_period int not null default 12,
  active_period_format text not null default 'YYYY/YYYY',
  transaction_edit_rule text not null default 'same_day_for_walas',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  file_name text,
  total_rows int not null default 0,
  success_rows int not null default 0,
  failed_rows int not null default 0,
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_periods_updated_at before update on public.periods for each row execute function public.set_updated_at();
create trigger set_classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
create trigger set_students_updated_at before update on public.students for each row execute function public.set_updated_at();
create trigger set_savings_updated_at before update on public.savings_transactions for each row execute function public.set_updated_at();
create trigger set_infaq_updated_at before update on public.infaq_payments for each row execute function public.set_updated_at();
create trigger set_lks_bills_updated_at before update on public.lks_bills for each row execute function public.set_updated_at();
create trigger set_lks_bill_class_amounts_updated_at before update on public.lks_bill_class_amounts for each row execute function public.set_updated_at();
create trigger set_lks_payments_updated_at before update on public.lks_payments for each row execute function public.set_updated_at();
create trigger set_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'walas')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.get_current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_current_user_role() = 'admin';
$$;

create or replace function public.is_bendahara()
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_current_user_role() = 'bendahara';
$$;

create or replace function public.is_walas()
returns boolean language sql stable security definer set search_path = public as $$
  select public.get_current_user_role() = 'walas';
$$;

create or replace function public.walas_can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    join public.profiles p on p.id = auth.uid()
    left join public.classes c on c.id = s.current_class_id
    where s.id = target_student_id
      and p.role = 'walas'
      and p.is_active = true
      and (p.assigned_class_id = s.current_class_id or c.homeroom_teacher_id = p.id)
  );
$$;

create or replace function public.get_student_savings_balance(target_student_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case when type = 'setor' then amount else -amount end), 0)
  from public.savings_transactions
  where student_id = target_student_id;
$$;

create or replace function public.list_my_walas_students()
returns table (
  id uuid,
  name text,
  nis text,
  gender text,
  current_class_id uuid,
  is_active boolean,
  note text,
  current_class jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.nis,
    s.gender,
    s.current_class_id,
    s.is_active,
    s.note,
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'grade', c.grade,
      'period_id', c.period_id,
      'periods', jsonb_build_object(
        'name', pe.name,
        'start_date', pe.start_date,
        'end_date', pe.end_date
      )
    ) as current_class
  from public.students s
  join public.profiles p on p.id = auth.uid()
  left join public.classes c on c.id = s.current_class_id
  left join public.periods pe on pe.id = c.period_id
  where p.role = 'walas'
    and p.is_active = true
    and s.is_active = true
    and s.current_class_id = p.assigned_class_id
  order by s.name;
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
  paid_amount numeric := (payment ->> 'amount_paid')::numeric;
begin
  if not (public.is_admin() or public.walas_can_access_student(target_student)) then
    raise exception 'Tidak punya akses ke siswa ini';
  end if;

  if (payment ->> 'payment_method') = 'dari_tabungan' then
    if public.get_student_savings_balance(target_student) < paid_amount then
      raise exception 'Saldo tabungan siswa tidak cukup';
    end if;

    insert into public.savings_transactions (student_id, transaction_date, type, amount, input_method, note, created_by)
    values (target_student, coalesce((payment ->> 'payment_date')::date, current_date), 'tarik', paid_amount, 'manual', coalesce(payment ->> 'note', 'Pembayaran LKS dari tabungan'), auth.uid())
    returning id into new_savings_id;
  end if;

  insert into public.lks_payments (student_id, lks_bill_id, amount_paid, payment_date, payment_method, status, savings_transaction_id, note, created_by)
  values (
    target_student,
    (payment ->> 'lks_bill_id')::uuid,
    paid_amount,
    coalesce((payment ->> 'payment_date')::date, current_date),
    coalesce(payment ->> 'payment_method', 'tunai')::public.lks_payment_method,
    coalesce(payment ->> 'status', 'lunas')::public.payment_status,
    new_savings_id,
    payment ->> 'note',
    auth.uid()
  )
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
      and (start_date is null or st.transaction_date >= start_date)
      and (end_date is null or st.transaction_date <= end_date)
  ),
  infaq as (
    select coalesce(sum(amount), 0) total
    from public.infaq_payments ip
    where ip.student_id in (select id from filtered_students)
  ),
  lks as (
    select coalesce(sum(amount_paid), 0) total
    from public.lks_payments lp
    where lp.student_id in (select id from filtered_students)
      and (start_date is null or lp.payment_date >= start_date)
      and (end_date is null or lp.payment_date <= end_date)
  )
  select savings.deposit, savings.withdrawal, savings.deposit - savings.withdrawal, infaq.total, lks.total
  from savings, infaq, lks;
$$;

alter table public.profiles enable row level security;
alter table public.periods enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_class_histories enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.infaq_payments enable row level security;
alter table public.lks_bills enable row level security;
alter table public.lks_bill_class_amounts enable row level security;
alter table public.lks_payments enable row level security;
alter table public.app_settings enable row level security;
alter table public.import_logs enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "periods readable by authenticated" on public.periods for select using (auth.uid() is not null);
create policy "periods admin write" on public.periods for all using (public.is_admin()) with check (public.is_admin());

create policy "classes role read" on public.classes for select using (
  public.is_admin() or public.is_bendahara() or homeroom_teacher_id = auth.uid() or id = (select assigned_class_id from public.profiles where profiles.id = auth.uid())
);
create policy "classes admin write" on public.classes for all using (public.is_admin()) with check (public.is_admin());

create policy "students role read" on public.students for select using (
  public.is_admin() or public.is_bendahara() or public.walas_can_access_student(id)
);
create policy "students admin write" on public.students for all using (public.is_admin()) with check (public.is_admin());

create policy "history role read" on public.student_class_histories for select using (
  public.is_admin() or public.is_bendahara() or public.walas_can_access_student(student_id)
);
create policy "history admin write" on public.student_class_histories for all using (public.is_admin()) with check (public.is_admin());

create policy "savings role read" on public.savings_transactions for select using (
  public.is_admin() or public.is_bendahara() or public.walas_can_access_student(student_id)
);
create policy "savings admin walas insert" on public.savings_transactions for insert with check (
  public.is_admin() or public.walas_can_access_student(student_id)
);
create policy "savings admin update delete" on public.savings_transactions for update using (public.is_admin()) with check (public.is_admin());
create policy "savings admin delete" on public.savings_transactions for delete using (public.is_admin());
create policy "savings walas same day update" on public.savings_transactions for update using (
  public.walas_can_access_student(student_id) and transaction_date = current_date
) with check (
  public.walas_can_access_student(student_id) and transaction_date = current_date
);
create policy "savings walas same day delete" on public.savings_transactions for delete using (
  public.walas_can_access_student(student_id) and transaction_date = current_date
);

create policy "infaq role read" on public.infaq_payments for select using (
  public.is_admin() or public.is_bendahara() or public.walas_can_access_student(student_id)
);
create policy "infaq admin walas write" on public.infaq_payments for all using (
  public.is_admin() or public.walas_can_access_student(student_id)
) with check (
  public.is_admin() or public.walas_can_access_student(student_id)
);

create policy "lks bills role read" on public.lks_bills for select using (
  auth.uid() is not null and (public.is_admin() or public.is_bendahara() or class_id is null or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'walas' and p.assigned_class_id = lks_bills.class_id
  ))
);
create policy "lks bills admin write" on public.lks_bills for all using (public.is_admin()) with check (public.is_admin());

create policy "lks bill class amounts role read" on public.lks_bill_class_amounts for select using (
  public.is_admin() or public.is_bendahara() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'walas'
      and p.assigned_class_id = lks_bill_class_amounts.class_id
  )
);
create policy "lks bill class amounts admin write" on public.lks_bill_class_amounts for all using (public.is_admin()) with check (public.is_admin());

create policy "lks payments role read" on public.lks_payments for select using (
  public.is_admin() or public.is_bendahara() or public.walas_can_access_student(student_id)
);
create policy "lks payments admin walas write" on public.lks_payments for all using (
  public.is_admin() or public.walas_can_access_student(student_id)
) with check (
  public.is_admin() or public.walas_can_access_student(student_id)
);

create policy "settings read authenticated" on public.app_settings for select using (auth.uid() is not null);
create policy "settings admin write" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "import logs admin read write" on public.import_logs for all using (public.is_admin()) with check (public.is_admin());
create policy "audit logs admin read" on public.audit_logs for select using (public.is_admin());

grant execute on function public.get_student_savings_balance(uuid) to authenticated;
grant execute on function public.list_my_walas_students() to authenticated;
grant execute on function public.create_lks_payment(jsonb) to authenticated;
grant execute on function public.get_finance_summary(uuid, uuid, uuid, date, date) to authenticated;

insert into public.app_settings (app_name, school_name, default_monthly_infaq, infaq_months_per_period)
values ('Sistem Keuangan Kelas', 'Nama Sekolah', 10000, 12);
