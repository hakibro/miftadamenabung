alter table public.lks_bills
  add column if not exists semester int not null default 1 check (semester in (1, 2));

create unique index if not exists lks_bills_period_semester_name_idx
  on public.lks_bills (period_id, semester, lower(name));

comment on column public.lks_bills.semester is
  'Semester LKS dalam satu periode/tahun ajaran. Nominal bisa berbeda per semester dan per kelas melalui lks_bill_class_amounts.';
