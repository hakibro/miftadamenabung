import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { listClassOptions } from '../../services/masterDataService';
import { createUserAccount, deleteUserAccount, listProfiles, setUserActive, updateUserAccount } from '../../services/userService';

const emptyForm = {
  id: '',
  full_name: '',
  email: '',
  password: '',
  role: 'walas',
  assigned_class_id: '',
  is_active: true,
};

export default function UsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [profileRows, classRows] = await Promise.all([listProfiles(), listClassOptions()]);
      setProfiles(profileRows);
      setClasses(classRows.filter((item) => item.period?.is_active));
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar akun');
    }
  }

  useEffect(() => { load(); }, []);

  function edit(row) {
    setForm({
      id: row.id,
      full_name: row.full_name || '',
      email: row.email || '',
      password: '',
      role: row.role || 'walas',
      assigned_class_id: row.assigned_class_id || '',
      is_active: row.is_active,
    });
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        ...form,
        assigned_class_id: form.role === 'walas' ? form.assigned_class_id || null : null,
      };

      if (form.id) {
        await updateUserAccount(payload);
        setToast('Akun berhasil diperbarui');
      } else {
        await createUserAccount(payload);
        setToast('Akun berhasil dibuat');
      }

      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan akun');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row) {
    try {
      await setUserActive(row.id, !row.is_active);
      setToast(row.is_active ? 'Akun dinonaktifkan' : 'Akun diaktifkan');
      load();
    } catch (err) {
      setError(err.message || 'Gagal mengubah status akun');
    }
  }

  async function remove(row) {
    if (!confirm(`Hapus akun ${row.full_name}? Akun Auth dan profile akan dihapus.`)) return;
    try {
      await deleteUserAccount(row.id);
      setToast('Akun berhasil dihapus');
      load();
    } catch (err) {
      setError(err.message || 'Gagal menghapus akun');
    }
  }

  const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Toast message={toast} onClose={() => setToast(null)} />

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Akun' : 'Tambah Akun'}</h2>
          <p className="text-sm text-slate-500">Admin bisa membuat akun bendahara dan wali kelas dari sini.</p>
        </div>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <FormField label="Nama">
          <input className={inputClass} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
        </FormField>

        <FormField label="Email">
          <input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </FormField>

        <FormField label={form.id ? 'Password baru (opsional)' : 'Password'}>
          <input
            type="password"
            minLength={6}
            className={inputClass}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required={!form.id}
          />
        </FormField>

        <FormField label="Role">
          <select className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, assigned_class_id: event.target.value === 'walas' ? form.assigned_class_id : '' })}>
            <option value="admin">Admin</option>
            <option value="bendahara">Bendahara</option>
            <option value="walas">Wali Kelas</option>
          </select>
        </FormField>

        {form.role === 'walas' ? (
          <FormField label="Kelas yang dipegang">
            <select className={inputClass} value={form.assigned_class_id} onChange={(event) => setForm({ ...form, assigned_class_id: event.target.value })}>
              <option value="">Pilih kelas</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.period?.name}</option>)}
            </select>
          </FormField>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Akun aktif
        </label>

        <div className="flex gap-2">
          <button disabled={submitting} className="flex-1 rounded-md bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
          {form.id ? (
            <button type="button" className="rounded-md border border-slate-200 px-4 py-2 font-semibold text-slate-700" onClick={() => setForm(emptyForm)}>
              Batal
            </button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Operasi akun Auth berjalan lewat Edge Function `manage-user`, sehingga `service_role` key tetap berada di server Supabase.
          Kelas walas hanya untuk tahun ajaran aktif dan otomatis tersambung dengan wali kelas di pengaturan kelas.
        </div>

        <DataTable
          rows={profiles}
          columns={[
            { key: 'full_name', label: 'Nama' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role', render: (row) => row.role === 'walas' ? 'Wali Kelas' : row.role },
            { key: 'class', label: 'Kelas walas', render: (row) => row.assigned_class?.name || '-' },
            { key: 'is_active', label: 'Status', render: (row) => (row.is_active ? 'Aktif' : 'Nonaktif') },
          ]}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="text-brand-700" onClick={() => edit(row)}>Edit</button>
              <button className={row.is_active ? 'text-amber-700' : 'text-emerald-700'} onClick={() => toggleActive(row)}>
                {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button className="text-red-600" onClick={() => remove(row)}>Hapus</button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
