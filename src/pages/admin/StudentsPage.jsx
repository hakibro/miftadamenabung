import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { deleteStudent, listClassOptions, listStudents, saveStudent } from '../../services/masterDataService';

const emptyForm = { name: '', nis: '', gender: 'L', current_class_id: '', is_active: true, note: '' };

export default function StudentsPage() {
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ search: '', grade: '', classId: '' });
  const [toast, setToast] = useState(null);

  async function load() {
    const [students, classRows] = await Promise.all([listStudents(), listClassOptions()]);
    setRows(students);
    setClasses(classRows);
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    await saveStudent(form);
    setForm(emptyForm);
    setToast('Siswa tersimpan');
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus siswa ini?')) return;
    await deleteStudent(id);
    load();
  }

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return rows.filter((student) => {
      const studentClass = student.current_class;
      const matchesSearch = !search
        || student.name?.toLowerCase().includes(search)
        || student.nis?.toLowerCase().includes(search);
      const matchesGrade = !filters.grade || Number(studentClass?.grade) === Number(filters.grade);
      const matchesClass = !filters.classId || student.current_class_id === filters.classId || studentClass?.id === filters.classId;
      return matchesSearch && matchesGrade && matchesClass;
    });
  }, [rows, filters]);

  const classOptions = useMemo(() => (
    filters.grade ? classes.filter((item) => Number(item.grade) === Number(filters.grade)) : classes
  ), [classes, filters.grade]);

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Toast message={toast} onClose={() => setToast(null)} />
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{form.id ? 'Edit Siswa' : 'Tambah Siswa'}</h2>
        <FormField label="Nama siswa"><input className="w-full rounded-md border px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
        <FormField label="NIS"><input className="w-full rounded-md border px-3 py-2" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} required /></FormField>
        <FormField label="Jenis kelamin">
          <select className="w-full rounded-md border px-3 py-2" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </FormField>
        <FormField label="Kelas">
          <select className="w-full rounded-md border px-3 py-2" value={form.current_class_id} onChange={(e) => setForm({ ...form, current_class_id: e.target.value })} required>
            <option value="">Pilih kelas</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FormField>
        <FormField label="Keterangan"><textarea className="w-full rounded-md border px-3 py-2" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif</label>
        <button className="w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white">Simpan</button>
      </form>
      <div className="space-y-3">
        <div className="grid gap-3 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft md:grid-cols-[1fr_180px_220px]">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Cari nama atau NIS"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={filters.grade}
            onChange={(e) => setFilters({ ...filters, grade: e.target.value, classId: '' })}
          >
            <option value="">Semua tingkat</option>
            {[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>Tingkat {grade}</option>)}
          </select>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={filters.classId}
            onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
          >
            <option value="">Semua kelas</option>
            {classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <p className="text-sm text-slate-500 md:col-span-3">Menampilkan {filteredRows.length} dari {rows.length} siswa.</p>
        </div>
        <DataTable
          rows={filteredRows}
          columns={[
            { key: 'name', label: 'Nama' },
            { key: 'nis', label: 'NIS' },
            { key: 'gender', label: 'JK' },
            { key: 'grade', label: 'Tingkat', render: (row) => row.current_class?.grade ? `Tingkat ${row.current_class.grade}` : '-' },
            { key: 'class', label: 'Kelas', render: (row) => row.current_class?.name },
            { key: 'is_active', label: 'Status', render: (row) => (row.is_active ? 'Aktif' : 'Nonaktif') },
          ]}
          actions={(row) => <div className="space-x-2"><button className="text-brand-700" onClick={() => setForm({ ...row, current_class_id: row.current_class_id || row.current_class?.id })}>Edit</button><button className="text-red-600" onClick={() => remove(row.id)}>Hapus</button></div>}
        />
      </div>
    </div>
  );
}
