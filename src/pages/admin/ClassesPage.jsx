import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { deleteClass, listClasses, listPeriods, saveClass } from '../../services/masterDataService';
import { listProfiles } from '../../services/profileService';

const emptyForm = { name: '', grade: '', period_id: '', homeroom_teacher_id: '' };

export default function ClassesPage() {
  const [rows, setRows] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);

  async function load() {
    const [classes, periodRows, profiles] = await Promise.all([listClasses(), listPeriods(), listProfiles()]);
    setRows(classes);
    setPeriods(periodRows);
    setTeachers(profiles.filter((item) => item.role === 'walas'));
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    await saveClass({ ...form, grade: Number(form.grade), homeroom_teacher_id: form.homeroom_teacher_id || null });
    setForm(emptyForm);
    setToast('Kelas tersimpan');
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus kelas ini?')) return;
    await deleteClass(id);
    load();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Toast message={toast} onClose={() => setToast(null)} />
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{form.id ? 'Edit Rombel/Kelas' : 'Tambah Rombel/Kelas'}</h2>
        <FormField label="Nama kelas/rombel"><input className="w-full rounded-md border px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: 3A, 4B" required /></FormField>
        <FormField label="Tingkat">
          <select className="w-full rounded-md border px-3 py-2" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} required>
            <option value="">Pilih tingkat</option>
            {[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>Tingkat {grade}</option>)}
          </select>
        </FormField>
        <FormField label="Tahun ajaran">
          <select className="w-full rounded-md border px-3 py-2" value={form.period_id} onChange={(e) => setForm({ ...form, period_id: e.target.value })} required>
            <option value="">Pilih tahun ajaran</option>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
          </select>
        </FormField>
        <FormField label="Wali kelas">
          <select className="w-full rounded-md border px-3 py-2" value={form.homeroom_teacher_id || ''} onChange={(e) => setForm({ ...form, homeroom_teacher_id: e.target.value })}>
            <option value="">Belum ditentukan</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
          </select>
        </FormField>
        <button className="w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white">Simpan</button>
      </form>
      <DataTable
        rows={rows}
        columns={[
          { key: 'name', label: 'Kelas' },
          { key: 'grade', label: 'Tingkat' },
          { key: 'period', label: 'Tahun Ajaran', render: (row) => row.periods?.name },
          { key: 'homeroom', label: 'Wali kelas', render: (row) => row.homeroom?.full_name || '-' },
        ]}
        actions={(row) => <div className="space-x-2"><button className="text-brand-700" onClick={() => setForm(row)}>Edit</button><button className="text-red-600" onClick={() => remove(row.id)}>Hapus</button></div>}
      />
    </div>
  );
}
