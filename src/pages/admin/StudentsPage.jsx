import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { deleteStudent, listClassOptions, listPeriodOptions, listStudents, saveStudent } from '../../services/masterDataService';

const emptyForm = { name: '', nis: '', gender: 'L', current_class_id: '', is_active: true, note: '' };

export default function StudentsPage() {
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ search: '', periodId: '', grade: '', classId: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkClassId, setBulkClassId] = useState('');
  const [toast, setToast] = useState(null);

  async function load() {
    const [students, classRows, periodRows] = await Promise.all([listStudents(), listClassOptions(), listPeriodOptions()]);
    setRows(students);
    setClasses(classRows);
    setPeriods(periodRows);
    setFilters((current) => ({
      ...current,
      periodId: current.periodId || periodRows.find((item) => item.is_active)?.id || '',
    }));
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    await saveStudent(form);
    setForm(emptyForm);
    setShowForm(false);
    setToast('Siswa tersimpan');
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus siswa ini?')) return;
    await deleteStudent(id);
    setSelectedIds((current) => current.filter((item) => item !== id));
    load();
  }

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return rows.filter((student) => {
      const studentClass = student.current_class;
      const matchesSearch = !search
        || student.name?.toLowerCase().includes(search)
        || student.nis?.toLowerCase().includes(search);
      const matchesPeriod = !filters.periodId || studentClass?.period_id === filters.periodId;
      const matchesGrade = !filters.grade || Number(studentClass?.grade) === Number(filters.grade);
      const matchesClass = !filters.classId || student.current_class_id === filters.classId || studentClass?.id === filters.classId;
      return matchesSearch && matchesPeriod && matchesGrade && matchesClass;
    });
  }, [rows, filters]);

  const classOptions = useMemo(() => (
    classes.filter((item) => {
      const matchesPeriod = !filters.periodId || item.period_id === filters.periodId;
      const matchesGrade = !filters.grade || Number(item.grade) === Number(filters.grade);
      return matchesPeriod && matchesGrade;
    })
  ), [classes, filters.periodId, filters.grade]);

  const formClassOptions = useMemo(() => (
    classes.filter((item) => item.period?.is_active || item.period_id === form.current_class?.period_id)
  ), [classes, form.current_class?.period_id]);

  function openCreateForm() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(row) {
    setForm({ ...row, current_class_id: row.current_class_id || row.current_class?.id });
    setShowForm(true);
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllFiltered(checked) {
    setSelectedIds(checked ? filteredRows.map((item) => item.id) : []);
  }

  async function bulkSetActive(isActive) {
    const targets = rows.filter((row) => selectedIds.includes(row.id));
    await Promise.all(targets.map((student) => saveStudent({ id: student.id, is_active: isActive })));
    setToast(isActive ? 'Siswa terpilih diaktifkan' : 'Siswa terpilih dinonaktifkan');
    setSelectedIds([]);
    await load();
  }

  async function bulkMoveClass() {
    if (!bulkClassId) return;
    const targets = rows.filter((row) => selectedIds.includes(row.id));
    await Promise.all(targets.map((student) => saveStudent({ id: student.id, current_class_id: bulkClassId })));
    setToast(`${targets.length} siswa dipindahkan kelas`);
    setBulkClassId('');
    setSelectedIds([]);
    await load();
  }

  async function bulkDelete() {
    if (!confirm(`Hapus ${selectedIds.length} siswa terpilih?`)) return;
    await Promise.all(selectedIds.map((id) => deleteStudent(id)));
    setToast('Siswa terpilih dihapus');
    setSelectedIds([]);
    await load();
  }

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((item) => selectedIds.includes(item.id));

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="space-y-3">
        <div className="grid gap-3 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft md:grid-cols-[1fr_190px_160px_220px]">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Cari nama atau NIS"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={filters.periodId}
            onChange={(e) => setFilters({ ...filters, periodId: e.target.value, grade: '', classId: '' })}
          >
            <option value="">Semua tahun ajaran</option>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.is_active ? ' (aktif)' : ''}</option>)}
          </select>
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
          <div className="flex flex-col gap-2 md:col-span-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">Menampilkan {filteredRows.length} dari {rows.length} siswa.</p>
            <button onClick={openCreateForm} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white shadow-glow">
              Tambah Siswa
            </button>
          </div>
          {selectedIds.length ? (
            <div className="grid gap-2 rounded-2xl bg-brand-50 p-3 md:col-span-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
              <p className="text-sm font-semibold text-brand-700">{selectedIds.length} siswa dipilih</p>
              <select className="rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm" value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}>
                <option value="">Pindah ke kelas...</option>
                {classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!bulkClassId} onClick={bulkMoveClass}>Pindah</button>
                <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" onClick={() => bulkSetActive(true)}>Aktifkan</button>
                <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" onClick={() => bulkSetActive(false)}>Nonaktifkan</button>
                <button className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={bulkDelete}>Hapus</button>
              </div>
              <button className="text-sm font-semibold text-slate-500 md:text-right" onClick={() => setSelectedIds([])}>Batal pilih</button>
            </div>
          ) : null}
        </div>
        <DataTable
          rows={filteredRows}
          columns={[
            { key: 'select', label: <input type="checkbox" checked={allFilteredSelected} onChange={(e) => toggleAllFiltered(e.target.checked)} />, render: (row) => <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /> },
            { key: 'name', label: 'Nama' },
            { key: 'nis', label: 'NIS' },
            { key: 'gender', label: 'JK' },
            { key: 'period', label: 'Tahun Ajaran', render: (row) => row.current_class?.periods?.name || '-' },
            { key: 'grade', label: 'Tingkat', render: (row) => row.current_class?.grade ? `Tingkat ${row.current_class.grade}` : '-' },
            { key: 'class', label: 'Kelas', render: (row) => row.current_class?.name },
            { key: 'is_active', label: 'Status', render: (row) => (row.is_active ? 'Aktif' : 'Nonaktif') },
          ]}
          actions={(row) => <div className="space-x-2"><button className="text-brand-700" onClick={() => openEditForm(row)}>Edit</button><button className="text-red-600" onClick={() => remove(row.id)}>Hapus</button></div>}
        />
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => { setShowForm(false); setForm(emptyForm); }}>
          <div className="mx-auto max-w-lg rounded-[24px] bg-white p-4 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{form.id ? 'Edit Siswa' : 'Tambah Siswa'}</h2>
              <button type="button" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                Tutup
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
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
                  {formClassOptions.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.period?.name || 'Tahun ajaran'}</option>)}
                </select>
              </FormField>
              <FormField label="Keterangan"><textarea className="w-full rounded-md border px-3 py-2" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif</label>
              <button className="w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white">Simpan</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
