import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { createStudentHistory, listClassOptions, listPeriodOptions, listStudents, saveClass, savePeriod, saveStudent } from '../../services/masterDataService';
import ClassesPage from './ClassesPage';
import ImportPage from './ImportPage';

const emptyPeriod = { name: '', start_date: '', end_date: '', is_active: true };

export default function PromotionPage() {
  const [periods, setPeriods] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sourcePeriod, setSourcePeriod] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('');
  const [students, setStudents] = useState([]);
  const [newPeriod, setNewPeriod] = useState(emptyPeriod);
  const [createdClasses, setCreatedClasses] = useState([]);
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pageSize = 10;

  async function loadOptions() {
    const [periodRows, classRows] = await Promise.all([listPeriodOptions(), listClassOptions()]);
    setPeriods(periodRows);
    setClasses(classRows);
    if (!sourcePeriod) setSourcePeriod(periodRows.find((item) => item.is_active)?.id || '');
    return { periodRows, classRows };
  }

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    async function loadStudents() {
      if (!sourcePeriod) {
        setStudents([]);
        return;
      }

      const sourceClasses = classes.filter((item) => item.period_id === sourcePeriod);
      const rows = await Promise.all(sourceClasses.map((item) => listStudents({ classId: item.id, activeOnly: true })));
      setStudents(rows.flat());
    }

    loadStudents();
  }, [sourcePeriod, classes]);

  function classRombel(name = '', grade = '') {
    return String(name)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/^kelas/, '')
      .replace(new RegExp(`^${grade}`), '')
      .trim();
  }

  function nextClassName(sourceClass) {
    const grade = Number(sourceClass.grade);
    const nextGrade = grade + 1;
    const suffix = classRombel(sourceClass.name, grade);
    if (!suffix) return String(nextGrade);
    return `${nextGrade}${suffix.toUpperCase()}`;
  }

  function findMatchingRombel(student, targetClassRows, gradeFrom, gradeTo) {
    const candidates = targetClassRows.filter((item) => item.grade === Number(gradeTo));
    if (candidates.length === 1) return candidates[0];
    const suffix = classRombel(student.current_class?.name, gradeFrom);
    if (!suffix) return null;
    return candidates.find((item) => classRombel(item.name, gradeTo) === suffix) || null;
  }

  async function createYearAndClasses(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (!sourcePeriod) throw new Error('Pilih tahun ajaran asal terlebih dahulu.');
      if (!newPeriod.name || !newPeriod.start_date || !newPeriod.end_date) throw new Error('Lengkapi data tahun ajaran baru.');

      await Promise.all(
        periods.filter((item) => item.is_active).map((item) => savePeriod({ ...item, is_active: false }))
      );

      const period = await savePeriod({ ...newPeriod, is_active: true });
      const sourceClasses = classes.filter((item) => item.period_id === sourcePeriod);
      const rowsToCreate = [];

      sourceClasses
        .filter((item) => Number(item.grade) < 6)
        .forEach((item) => {
          rowsToCreate.push({
            name: nextClassName(item),
            grade: Number(item.grade) + 1,
            period_id: period.id,
            homeroom_teacher_id: null,
          });
        });

      const created = [];
      for (const row of rowsToCreate) {
        const existing = created.find((item) => item.grade === row.grade && item.name.toLowerCase() === row.name.toLowerCase());
        if (!existing) created.push(await saveClass(row));
      }

      setTargetPeriod(period.id);
      setCreatedClasses(created);
      setNewPeriod(emptyPeriod);
      await loadOptions();
      setStep(2);
      setPage(1);
      setToast(`Tahun ajaran baru dibuat. Rombel otomatis dibuat: ${created.length}.`);
    } catch (err) {
      setError(err.message || 'Gagal membuat tahun ajaran baru');
    } finally {
      setSaving(false);
    }
  }

  async function promoteAllStudents() {
    setError('');
    setSaving(true);
    try {
      if (!targetPeriod) throw new Error('Buat atau pilih tahun ajaran tujuan dahulu.');
      const freshClasses = await listClassOptions();
      setClasses(freshClasses);
      const targetClassRows = freshClasses.filter((item) => item.period_id === targetPeriod);
      if (!targetClassRows.length) {
        throw new Error('Belum ada rombel di tahun ajaran tujuan. Klik "Buat Tahun Ajaran dan Rombel" dahulu.');
      }

      for (const student of students) {
        const currentGrade = Number(student.current_class?.grade || 0);
        const decision = currentGrade >= 6 ? 'lulus' : 'naik';
        const nextGrade = currentGrade + 1;
        let nextClassId = null;

        if (decision === 'naik') {
          const matchedClass = findMatchingRombel(student, targetClassRows, currentGrade, nextGrade);
          if (!matchedClass) {
            throw new Error(`Rombel tujuan untuk ${student.name} belum ada. Buat rombel tingkat ${nextGrade} yang sama dengan ${student.current_class?.name}.`);
          }
          nextClassId = matchedClass.id;
        }

        await createStudentHistory({
          student_id: student.id,
          class_id: nextClassId,
          period_id: targetPeriod,
          status: decision,
          note: decision === 'lulus' ? 'Lulus pada proses tahun ajaran baru' : `Naik otomatis ke tingkat ${nextGrade} dengan rombel tetap`,
        });

        await saveStudent({
          id: student.id,
          current_class_id: nextClassId,
          is_active: decision !== 'lulus',
        });
      }

      setToast(`Siswa diproses: ${students.length}. Tingkat 6 diluluskan, tingkat lain masuk rombel tahun ajaran baru.`);
      await loadOptions();
      setStudents([]);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Gagal memproses siswa');
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(Math.ceil(students.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const pagedStudents = students.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const stepItems = [
    'Buat Tahun Ajaran',
    'Naikkan Siswa',
    'Import Kelas 1',
    'Assign Wali Kelas',
  ];

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-700">
        Alur ini bertahap: buat tahun ajaran baru, sistem membuat rombel tingkat 2-6 dari rombel lama, siswa naik tingkat dengan rombel tetap, lalu import siswa baru kelas 1 dari Excel. Wali kelas diassign manual di langkah terakhir.
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {stepItems.map((item, index) => {
          const itemStep = index + 1;
          return (
            <button
              key={item}
              type="button"
              disabled={itemStep > step}
              onClick={() => setStep(itemStep)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ${step === itemStep ? 'bg-brand-600 text-white shadow-glow' : itemStep < step ? 'bg-white text-brand-700 shadow-soft' : 'bg-white/70 text-slate-400'}`}>
              {itemStep}. {item}
            </button>
          );
        })}
      </div>

      {step === 1 ? <form onSubmit={createYearAndClasses} className="grid gap-3 rounded-2xl border border-white/80 bg-white p-4 shadow-soft md:grid-cols-2">
        <FormField label="Tahun ajaran asal">
          <select className="w-full rounded-xl border px-3 py-2" value={sourcePeriod} onChange={(e) => setSourcePeriod(e.target.value)} required>
            <option value="">Pilih tahun ajaran asal</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? ' (aktif)' : ''}</option>)}
          </select>
        </FormField>
        <FormField label="Nama tahun ajaran baru">
          <input className="w-full rounded-xl border px-3 py-2" value={newPeriod.name} onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })} placeholder="2026/2027" required />
        </FormField>
        <FormField label="Tanggal mulai">
          <input type="date" className="w-full rounded-xl border px-3 py-2" value={newPeriod.start_date} onChange={(e) => setNewPeriod({ ...newPeriod, start_date: e.target.value })} required />
        </FormField>
        <FormField label="Tanggal selesai">
          <input type="date" className="w-full rounded-xl border px-3 py-2" value={newPeriod.end_date} onChange={(e) => setNewPeriod({ ...newPeriod, end_date: e.target.value })} required />
        </FormField>
        <button disabled={saving} className="rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-glow disabled:opacity-50 md:col-span-2">
          {saving ? 'Memproses...' : 'Buat Tahun Ajaran Baru'}
        </button>
      </form> : null}

      {createdClasses.length && step >= 2 ? (
        <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-soft">
          <p className="font-semibold text-slate-900">Rombel baru dibuat</p>
          <p className="mt-1">{createdClasses.map((item) => item.name).join(', ')}</p>
        </div>
      ) : null}

      {step === 2 ? <div className="space-y-4">
        <DataTable
          rows={pagedStudents}
          columns={[
            { key: 'name', label: 'Siswa' },
            { key: 'nis', label: 'NIS' },
            { key: 'class', label: 'Kelas asal', render: (row) => row.current_class?.name || '-' },
            { key: 'decision', label: 'Keputusan', render: (row) => Number(row.current_class?.grade) >= 6 ? 'Lulus' : `Naik ke tingkat ${Number(row.current_class?.grade || 0) + 1}` },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Halaman {currentPage}/{totalPages} dari {students.length} siswa</p>
          <div className="flex gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40">Sebelumnya</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
        <button disabled={saving || !students.length || !targetPeriod} onClick={promoteAllStudents} className="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-glow disabled:opacity-50">
          Masukkan Siswa ke Tahun Ajaran Baru
        </button>
      </div> : null}

      {step === 3 ? <div className="rounded-2xl bg-white p-4 shadow-soft">
        <h3 className="mb-3 font-bold text-slate-950">Import Siswa Baru Kelas 1</h3>
        <p className="mb-4 text-sm text-slate-500">Tahun ajaran baru sudah aktif. Import siswa baru memakai format saat ini. Isi tingkat 1 dan rombel seperti 1A atau 1B, kelas akan dibuat otomatis dari data import.</p>
        <ImportPage />
        <button type="button" onClick={() => setStep(4)} className="mt-4 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-glow">Lanjut Assign Wali Kelas</button>
      </div> : null}

      {step === 4 ? <div className="rounded-2xl bg-white p-4 shadow-soft">
        <h3 className="mb-3 font-bold text-slate-950">Assign Wali Kelas Manual</h3>
        <ClassesPage />
      </div> : null}
    </div>
  );
}
