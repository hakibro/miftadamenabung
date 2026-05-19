insert into public.periods (id, name, start_date, end_date, is_active)
values
  ('00000000-0000-4000-8000-000000000001', '2025/2026', '2025-07-01', '2026-06-30', true)
on conflict (id) do nothing;

insert into public.classes (id, name, grade, period_id)
values
  ('00000000-0000-4000-8000-000000000101', '1A', 1, '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000102', '1B', 1, '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.students (id, name, nis, gender, current_class_id, note)
values
  ('00000000-0000-4000-8000-000000001001', 'Ahmad Fauzan', '25001', 'L', '00000000-0000-4000-8000-000000000101', 'Contoh siswa aktif'),
  ('00000000-0000-4000-8000-000000001002', 'Siti Aminah', '25002', 'P', '00000000-0000-4000-8000-000000000101', null),
  ('00000000-0000-4000-8000-000000001003', 'Budi Santoso', '25003', 'L', '00000000-0000-4000-8000-000000000102', null)
on conflict (id) do nothing;

insert into public.student_class_histories (student_id, class_id, period_id, status, note)
select id, current_class_id, '00000000-0000-4000-8000-000000000001', 'aktif', 'Seed awal'
from public.students
on conflict do nothing;

insert into public.lks_bills (id, name, period_id, semester, class_id, total_amount, due_date, note)
values
  ('00000000-0000-4000-8000-000000002001', 'LKS Semester 1', '00000000-0000-4000-8000-000000000001', 1, null, 150000, '2025-09-30', 'Contoh tagihan semester 1'),
  ('00000000-0000-4000-8000-000000002002', 'LKS Semester 2', '00000000-0000-4000-8000-000000000001', 2, null, 175000, '2026-02-28', 'Contoh tagihan semester 2')
on conflict (id) do nothing;

insert into public.lks_bill_class_amounts (lks_bill_id, class_id, amount, note)
values
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000000101', 145000, 'Nominal khusus kelas 1A'),
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000000102', 155000, 'Nominal khusus kelas 1B'),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000000101', 170000, 'Nominal semester 2 kelas 1A'),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000000102', 180000, 'Nominal semester 2 kelas 1B')
on conflict (lks_bill_id, class_id) do update
set amount = excluded.amount,
    note = excluded.note;
