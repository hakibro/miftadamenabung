# Sistem Keuangan Kelas

Aplikasi frontend React + Vite + JavaScript untuk administrasi keuangan kelas: tabungan siswa, infaq, pembayaran LKS, QR input cepat, laporan, import/export Excel, pengaturan tahun ajaran, dan settings aplikasi.

## Stack

- React + Vite
- Tailwind CSS
- Supabase Auth, Database, RLS, dan RPC
- Cloudflare Pages ready (`public/_redirects` sudah disiapkan untuk SPA routing)

## Struktur Folder

```text
src/
  components/      Komponen UI reusable
  contexts/        AuthContext Supabase
  layouts/         Sidebar, topbar, shell aplikasi
  lib/             Supabase client
  pages/           Halaman admin, bendahara, walas, scan
  routes/          Route guard dan konfigurasi route
  services/        Query Supabase terpusat
  utils/           Helper format rupiah, tanggal, role
supabase/
  migrations/      SQL schema + RLS + RPC
  seed/            Contoh data awal
```

## Menjalankan Local

1. Install dependency:

```bash
npm install
```

2. Buat `.env.local` dari `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Jalankan migration di Supabase SQL Editor:

```text
supabase/migrations/20260518163000_initial_school_finance.sql
```

4. Opsional, jalankan seed:

```text
supabase/seed/seed.sql
```

5. Opsional, seed akun admin:

```text
supabase/seed/admin_user.sql
```

Akun contoh:

```text
Email: admin@sekolah.test
Password: Admin12345!
```

Jika akun admin contoh tidak bisa login, jalankan ulang `supabase/seed/admin_user.sql`. Seed ini akan memperbarui password dan metadata bila user sudah ada.

Cek cepat di Supabase SQL Editor:

```sql
select id, email, email_confirmed_at from auth.users where email = 'admin@sekolah.test';
select id, email, role, is_active from public.profiles where email = 'admin@sekolah.test';
```

Hasil yang benar:

```text
auth.users.email_confirmed_at tidak null
profiles.role = admin
profiles.is_active = true
```

6. Jalankan app:

```bash
npm run dev
```

## Deploy Cloudflare Pages

Gunakan konfigurasi Pages biasa:

```text
Build command: npm run build
Build output directory: dist
Deploy command: kosongkan
```

Jangan isi deploy command dengan `npx wrangler deploy` untuk Cloudflare Pages. Wrangler akan mencoba deploy sebagai Worker dan bisa menolak konfigurasi SPA redirect. File `public/_redirects` sudah dibuat eksplisit untuk route aplikasi agar deep link seperti `/admin/settings` tetap masuk ke React Router.

## Akun dan Role

Frontend tidak menyimpan service role key. CRUD akun admin/bendahara/walas dilakukan dari halaman `/admin/users` melalui Supabase Edge Function `manage-user`.

Role yang didukung:

- `admin`: semua fitur.
- `bendahara`: dashboard dan laporan global.
- `walas`: kelas yang dipegang, input transaksi, scan QR, laporan kelas.

Untuk akun admin pertama, setelah membuat user Auth, ubah profilnya di SQL Editor:

```sql
update public.profiles
set role = 'admin', full_name = 'Admin'
where email = 'admin@example.com';
```

## Deploy Edge Function CRUD User

Halaman `/admin/users` membutuhkan function:

```text
supabase/functions/manage-user/index.ts
```

Deploy dengan Supabase CLI:

```bash
npm run supabase:login
npm run supabase:link
npm run functions:deploy
```

Pastikan project memiliki secrets/env berikut. Di hosted Supabase, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` umumnya tersedia untuk Edge Functions. Jika perlu set manual:

```bash
npx supabase secrets set SUPABASE_URL=https://your-project.supabase.co
npx supabase secrets set SUPABASE_ANON_KEY=your-anon-key
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Untuk project Supabase yang memakai key format baru, function juga mendukung:

```bash
npx supabase secrets set SUPABASE_PUBLISHABLE_KEY=your-publishable-key
npx supabase secrets set SUPABASE_SECRET_KEY=your-secret-key
```

Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` frontend.

Jika muncul pesan `Failed to send a request to the Edge Function`, biasanya penyebabnya:

- Function `manage-user` belum dideploy.
- Project Supabase CLI belum di-link ke project yang benar.
- Secrets function belum diset.
- Nama function yang dideploy bukan `manage-user`.
- Browser masih memakai dev server lama, restart `npm run dev`.

## Catatan Implementasi

- Route guard frontend hanya untuk UX. Proteksi utama ada di RLS Supabase.
- Pembayaran LKS dari tabungan memakai RPC `create_lks_payment`, sehingga pengecekan saldo dan transaksi tarik tabungan dilakukan di database.
- QR siswa mengarah ke `/scan/siswa/:id`. Jika belum login, user diarahkan ke login lalu kembali ke halaman scan.
- Import memakai file Excel (`.xlsx`/`.xls`) dengan tombol contoh file pada halaman Import. Export laporan juga memakai Excel.
- Menu Tahun Ajaran dan Kelas dipindahkan ke Settings > Data Awal.
- Proses Tahun Ajaran Baru dilakukan dari Settings. Rombel dipertahankan otomatis, misalnya 3A naik ke 4A, dan tingkat 6 ditandai lulus.
