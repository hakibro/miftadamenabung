## Untuk testing development, jalankan SQL ini di Supabase SQL Editor. Ini menghapus transaksi keuangan, tapi tidak menghapus master data siswa/kelas/user/settings.

truncate table
public.savings_year_end_actions,
public.charge_payments,
public.savings_transactions
restart identity cascade;

## Kalau ingin sekalian hapus kategori tagihan juga:

truncate table
public.savings_year_end_actions,
public.charge_payments,
public.charge_category_grades,
public.charge_categories,
public.savings_transactions
restart identity cascade;

Urutan itu aman untuk skema saat ini karena tabel yang punya relasi transaksi ikut dibersihkan.
