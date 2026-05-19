import { useState } from 'react';
import DataTable from '../../components/DataTable';
import Toast from '../../components/Toast';
import { downloadImportTemplate, exportExcel, importStudentsToActivePeriod, parseExcel, saveImportLog, validateImportRows } from '../../services/importService';

export default function ImportPage() {
  const [type, setType] = useState('students');
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = await parseExcel(file);
    setRows(parsed);
    setErrors(validateImportRows(type, parsed));
  }

  async function saveLog() {
    await saveImportLog({ import_type: type, file_name: 'preview.xlsx', total_rows: rows.length, success_rows: errors.length ? 0 : rows.length, failed_rows: errors.length, note: errors.join('\n') });
    setToast('Log import tersimpan. Penyimpanan massal bisa dilanjutkan dari service ini.');
  }

  async function saveStudents() {
    if (type !== 'students' || errors.length || !rows.length) return;
    setSaving(true);
    try {
      const result = await importStudentsToActivePeriod(rows);
      setToast(`Import selesai: ${result.importedStudents} siswa masuk tahun ajaran ${result.periodName}. Kelas baru dibuat: ${result.createdClasses}.`);
      setRows([]);
      setErrors([]);
    } catch (error) {
      setToast(error.message || 'Gagal import siswa');
    } finally {
      setSaving(false);
    }
  }

  const previewColumns = Object.keys(rows[0] || {}).slice(0, 8).map((key) => ({ key, label: key }));

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <select className="rounded-md border px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="users">Wali kelas/user</option>
            <option value="classes">Kelas</option>
            <option value="students">Siswa</option>
          </select>
          <input type="file" accept=".xlsx,.xls" className="rounded-md border px-3 py-2" onChange={handleFile} />
          <button disabled={!rows.length || saving || Boolean(errors.length)} className="rounded-md bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={type === 'students' ? saveStudents : saveLog}>
            {type === 'students' ? (saving ? 'Mengimport...' : 'Import Siswa') : 'Simpan Log Import'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={() => downloadImportTemplate(type)}>Download contoh Excel</button>
          <button disabled={!rows.length} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => exportExcel(rows, `preview-${type}.xlsx`)}>Export preview Excel</button>
        </div>
        <p className="mt-3 text-sm text-slate-500">Excel siswa: name, nis, gender, grade/tingkat, class_name, note. Kelas siswa otomatis dicari atau dibuat pada tahun ajaran aktif berdasarkan tingkat dan nama kelas yang sama.</p>
      </div>
      {errors.length ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      <DataTable rows={rows.map((row, index) => ({ id: index, ...row }))} columns={previewColumns} empty="Upload Excel untuk preview" />
    </div>
  );
}
