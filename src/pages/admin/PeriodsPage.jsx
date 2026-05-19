import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { deletePeriod, listPeriods, savePeriod } from '../../services/masterDataService';
import { formatDateId } from '../../utils/formatters';

const emptyForm = { name: '', start_date: '', end_date: '', is_active: false };

export default function PeriodsPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);

  async function load() {
    setRows(await listPeriods());
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    await savePeriod(form);
    setForm(emptyForm);
    setToast('Tahun ajaran tersimpan');
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus tahun ajaran ini?')) return;
    await deletePeriod(id);
    load();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Toast message={toast} onClose={() => setToast(null)} />
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{form.id ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}</h2>
        <FormField label="Nama tahun ajaran">
          <input className="w-full rounded-md border px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2025/2026" required />
        </FormField>
        <FormField label="Tanggal mulai">
          <input type="date" className="w-full rounded-md border px-3 py-2" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
        </FormField>
        <FormField label="Tanggal selesai">
          <input type="date" className="w-full rounded-md border px-3 py-2" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
        </FormField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Tahun ajaran aktif</label>
        <button className="w-full rounded-md bg-brand-600 px-4 py-2 font-semibold text-white">Simpan</button>
      </form>
      <DataTable
        rows={rows}
        columns={[
          { key: 'name', label: 'Tahun Ajaran' },
          { key: 'start_date', label: 'Mulai', render: (row) => formatDateId(row.start_date) },
          { key: 'end_date', label: 'Selesai', render: (row) => formatDateId(row.end_date) },
          { key: 'is_active', label: 'Status', render: (row) => (row.is_active ? 'Aktif' : '-') },
        ]}
        actions={(row) => (
          <div className="space-x-2">
            <button className="text-brand-700" onClick={() => setForm(row)}>Edit</button>
            <button className="text-red-600" onClick={() => remove(row.id)}>Hapus</button>
          </div>
        )}
      />
    </div>
  );
}
