import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { listClassOptions, listPeriodOptions, saveClass } from '../../services/masterDataService';
import { createUserAccount, deleteUserAccount, listProfiles, setUserActive, updateUserAccount } from '../../services/userService';

const emptyForm = {
  id: '',
  full_name: '',
  email: '',
  password: '',
  role: 'walas',
  is_active: true,
};

export default function UsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [classes, setClasses] = useState([]);
  const [periodFilter, setPeriodFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assigningId, setAssigningId] = useState('');

  async function load() {
    try {
      const [profileRows, classRows, periodRows] = await Promise.all([listProfiles(), listClassOptions(), listPeriodOptions()]);
      setProfiles(profileRows);
      setClasses(classRows);
      setPeriods(periodRows);
      setPeriodFilter((current) => current || periodRows.find((item) => item.is_active)?.id || periodRows[0]?.id || '');
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
      is_active: row.is_active,
    });
    setShowForm(true);
    setError('');
  }

  function openCreateForm() {
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (form.id) {
        await updateUserAccount(form);
        setToast('Akun berhasil diperbarui');
      } else {
        await createUserAccount(form);
        setToast('Akun berhasil dibuat');
      }

      setForm(emptyForm);
      setShowForm(false);
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

  function getAssignedClassId(userId) {
    return filteredClasses.find((item) => item.homeroom_teacher_id === userId)?.id || '';
  }

  async function assignWalasClass(user, classId) {
    setAssigningId(user.id);
    setError('');
    try {
      const currentAssignments = filteredClasses.filter((item) => item.homeroom_teacher_id === user.id);
      await Promise.all(currentAssignments
        .filter((item) => item.id !== classId)
        .map((item) => saveClass({
          id: item.id,
          name: item.name,
          grade: Number(item.grade),
          period_id: item.period_id,
          homeroom_teacher_id: null,
        })));

      if (classId) {
        const targetClass = filteredClasses.find((item) => item.id === classId);
        if (targetClass) {
          await saveClass({
            id: targetClass.id,
            name: targetClass.name,
            grade: Number(targetClass.grade),
            period_id: targetClass.period_id,
            homeroom_teacher_id: user.id,
          });
        }
      }

      setToast('Kelas wali kelas diperbarui');
      await load();
    } catch (err) {
      setError(err.message || 'Gagal mengubah kelas wali kelas');
    } finally {
      setAssigningId('');
    }
  }

  const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
  const filteredClasses = classes.filter((item) => !periodFilter || item.period_id === periodFilter);

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Operasi akun Auth berjalan lewat Edge Function `manage-user`, sehingga `service_role` key tetap berada di server Supabase.
          Filter tahun ajaran digunakan untuk melihat dan mengatur wali kelas pada periode tertentu.
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Filter tahun ajaran</p>
            <p className="text-sm text-slate-500">Kolom kelas walas mengikuti tahun ajaran yang dipilih.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="rounded-xl border border-slate-200 px-3 py-2" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
              <option value="">Semua tahun ajaran</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}{period.is_active ? ' (aktif)' : ''}
                </option>
              ))}
            </select>
            <button type="button" onClick={openCreateForm} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white shadow-glow">Tambah Akun</button>
          </div>
        </div>

        <DataTable
          rows={profiles}
          columns={[
            { key: 'full_name', label: 'Nama' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role', render: (row) => row.role === 'walas' ? 'Wali Kelas' : row.role },
            { key: 'class', label: 'Kelas walas', render: (row) => row.role === 'walas' ? (
              <select
                className="min-w-44 rounded-lg border border-slate-200 px-2 py-1"
                disabled={!periodFilter || assigningId === row.id}
                value={getAssignedClassId(row.id)}
                onChange={(event) => assignWalasClass(row, event.target.value)}>
                <option value="">Belum ditentukan</option>
                {filteredClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : '-' },
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
      {showForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => { setShowForm(false); setForm(emptyForm); }}>
          <div className="mx-auto max-w-lg rounded-[24px] bg-white p-4 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Akun' : 'Tambah Akun'}</h2>
                <p className="text-sm text-slate-500">Admin bisa membuat akun bendahara dan wali kelas dari sini.</p>
              </div>
              <button type="button" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Tutup</button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
              <FormField label="Nama">
                <input className={inputClass} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
              </FormField>
              <FormField label="Email">
                <input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </FormField>
              <FormField label={form.id ? 'Password baru (opsional)' : 'Password'}>
                <input type="password" minLength={6} className={inputClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!form.id} />
              </FormField>
              <FormField label="Role">
                <select className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="bendahara">Bendahara</option>
                  <option value="walas">Wali Kelas</option>
                </select>
              </FormField>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                Akun aktif
              </label>
              <button disabled={submitting} className="w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
