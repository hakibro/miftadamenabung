import { useEffect, useMemo, useState } from 'react';
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
  const [periodFilter, setPeriodFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkTeacherId, setBulkTeacherId] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [toast, setToast] = useState(null);

  async function load() {
    const [classes, periodRows, profiles] = await Promise.all([listClasses(), listPeriods(), listProfiles()]);
    setRows(classes);
    setPeriods(periodRows);
    setTeachers(profiles.filter((item) => item.role === 'walas'));
    setPeriodFilter((current) => current || periodRows.find((item) => item.is_active)?.id || '');
    return { classes, periodRows, profiles };
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    await saveClass({
      id: form.id,
      name: form.name,
      grade: Number(form.grade),
      period_id: form.period_id,
      homeroom_teacher_id: form.homeroom_teacher_id || null,
    });
    setForm(emptyForm);
    setShowForm(false);
    setToast('Kelas tersimpan');
    await load();
  }

  async function remove(id) {
    if (!confirm('Hapus kelas ini?')) return;
    await deleteClass(id);
    setSelectedIds((current) => current.filter((item) => item !== id));
    await load();
  }

  function openCreateForm() {
    setForm({ ...emptyForm, period_id: periodFilter || periods.find((item) => item.is_active)?.id || '' });
    setShowForm(true);
  }

  function openEditForm(row) {
    setForm({
      id: row.id,
      name: row.name || '',
      grade: row.grade || '',
      period_id: row.period_id || '',
      homeroom_teacher_id: row.homeroom_teacher_id || '',
    });
    setShowForm(true);
  }

  async function assignTeacher(row, teacherId) {
    setBusyAction(`assign-${row.id}`);
    try {
      await saveClass({
        id: row.id,
        name: row.name,
        grade: Number(row.grade),
        period_id: row.period_id,
        homeroom_teacher_id: teacherId || null,
      });
      setToast('Wali kelas diperbarui');
      await load();
    } finally {
      setBusyAction('');
    }
  }

  function toggleSelected(id) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleAllVisible() {
    const visibleIds = filteredRows.map((row) => row.id);
    const allSelected = visibleIds.length && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function bulkAssignTeacher() {
    if (!selectedIds.length) return;
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    setBusyAction('bulk-assign');
    try {
      await Promise.all(selectedRows.map((row) => saveClass({
        id: row.id,
        name: row.name,
        grade: Number(row.grade),
        period_id: row.period_id,
        homeroom_teacher_id: bulkTeacherId || null,
      })));
      setToast(bulkTeacherId ? 'Wali kelas massal diperbarui' : 'Wali kelas massal dikosongkan');
      setSelectedIds([]);
      setBulkTeacherId('');
      await load();
    } finally {
      setBusyAction('');
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!confirm(`Hapus ${selectedIds.length} kelas terpilih?`)) return;
    setBusyAction('bulk-delete');
    try {
      await Promise.all(selectedIds.map((id) => deleteClass(id)));
      setToast('Kelas terpilih dihapus');
      setSelectedIds([]);
      await load();
    } finally {
      setBusyAction('');
    }
  }

  const filteredRows = useMemo(() => (
    periodFilter ? rows.filter((row) => row.period_id === periodFilter) : rows
  ), [rows, periodFilter]);
  const visibleIds = filteredRows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="space-y-4">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <select className="rounded-xl border border-slate-200 px-3 py-2" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
          <option value="">Semua tahun ajaran</option>
          {periods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.is_active ? ' (aktif)' : ''}</option>)}
        </select>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={load} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700">Refresh Data</button>
          <button type="button" onClick={openCreateForm} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white shadow-glow">Tambah Rombel/Kelas</button>
        </div>
      </div>
      {selectedIds.length ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm font-semibold text-slate-700">{selectedIds.length} kelas dipilih</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select className="rounded-xl border border-slate-200 px-3 py-2" value={bulkTeacherId} onChange={(e) => setBulkTeacherId(e.target.value)}>
              <option value="">Kosongkan wali kelas</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
            </select>
            <button type="button" disabled={Boolean(busyAction)} onClick={bulkAssignTeacher} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
              Terapkan Wali Kelas
            </button>
            <button type="button" disabled={Boolean(busyAction)} onClick={bulkDelete} className="rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-600 disabled:opacity-60">
              Hapus Terpilih
            </button>
          </div>
        </div>
      ) : null}
      <DataTable
        rows={filteredRows}
        columns={[
          { key: 'select', label: <input type="checkbox" checked={Boolean(allVisibleSelected)} onChange={toggleAllVisible} aria-label="Pilih semua kelas yang tampil" />, render: (row) => (
            <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Pilih kelas ${row.name}`} />
          ) },
          { key: 'name', label: 'Kelas' },
          { key: 'grade', label: 'Tingkat' },
          { key: 'period', label: 'Tahun Ajaran', render: (row) => row.periods?.name },
          { key: 'homeroom', label: 'Wali kelas', render: (row) => (
            <select className="min-w-44 rounded-lg border border-slate-200 px-2 py-1" disabled={busyAction === `assign-${row.id}`} value={row.homeroom_teacher_id || ''} onChange={(e) => assignTeacher(row, e.target.value)}>
              <option value="">Belum ditentukan</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
            </select>
          ) },
        ]}
        actions={(row) => <div className="space-x-2"><button className="text-brand-700" onClick={() => openEditForm(row)}>Edit</button><button className="text-red-600" onClick={() => remove(row.id)}>Hapus</button></div>}
      />
      {showForm ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => { setShowForm(false); setForm(emptyForm); }}>
          <div className="mx-auto max-w-lg rounded-[24px] bg-white p-4 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{form.id ? 'Edit Rombel/Kelas' : 'Tambah Rombel/Kelas'}</h2>
              <button type="button" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Tutup</button>
            </div>
            <form onSubmit={submit} className="space-y-4">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
