import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import Toast from '../../components/Toast';
import { createStudentHistory, listClassOptions, listPeriodOptions, listStudents, saveStudent } from '../../services/masterDataService';
import { createSavingsTransaction, getSavingsBalance } from '../../services/financeService';
import { formatRupiah, todayISO } from '../../utils/formatters';

export default function PromotionPage() {
  const [periods, setPeriods] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sourcePeriod, setSourcePeriod] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('');
  const [sourceGrade, setSourceGrade] = useState('');
  const [students, setStudents] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [applySavingsCut, setApplySavingsCut] = useState(true);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listPeriodOptions(), listClassOptions()]).then(([periodRows, classRows]) => {
      setPeriods(periodRows);
      setClasses(classRows);
    });
  }, []);

  const sourceGrades = useMemo(() => [1, 2, 3, 4, 5, 6], []);

  const nextGrade = sourceGrade && Number(sourceGrade) < 6 ? Number(sourceGrade) + 1 : '';
  const targetClasses = classes.filter((item) => item.period_id === targetPeriod && item.grade === Number(nextGrade));

  function classRombel(name = '', grade = '') {
    return String(name)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/^kelas/, '')
      .replace(new RegExp(`^${grade}`), '')
      .trim();
  }

  function findMatchingRombel(student, gradeFrom, gradeTo) {
    const candidates = classes.filter((item) => item.period_id === targetPeriod && item.grade === Number(gradeTo));
    if (candidates.length === 1) return candidates[0];

    const suffix = classRombel(student.current_class?.name, gradeFrom);
    if (!suffix) return null;

    return candidates.find((item) => classRombel(item.name, gradeTo) === suffix) || null;
  }

  useEffect(() => {
    async function loadStudentsByGrade() {
      if (!sourcePeriod || !sourceGrade) {
        setStudents([]);
        return;
      }

      const sourceClasses = classes.filter((item) => item.period_id === sourcePeriod && item.grade === Number(sourceGrade));
      const rows = await Promise.all(sourceClasses.map((item) => listStudents({ classId: item.id, activeOnly: true })));
      setStudents(rows.flat());
    }

    loadStudentsByGrade();
  }, [sourcePeriod, sourceGrade, classes]);

  async function applySavingsCarryOver(student) {
    const balance = await getSavingsBalance(student.id);
    const cutAmount = Math.floor(Number(balance || 0) * 0.05);
    if (cutAmount <= 0) return;

    await createSavingsTransaction({
      student_id: student.id,
      type: 'tarik',
      amount: cutAmount,
      transaction_date: todayISO(),
      input_method: 'manual',
      note: `Potongan akhir tahun ajaran 5%. Saldo dilanjutkan: ${formatRupiah(Number(balance) - cutAmount)}`,
    });
  }

  async function save() {
    setError('');
    try {
      for (const student of students) {
        const decision = Number(sourceGrade) === 6 ? 'lulus' : (decisions[student.id] || 'naik');
        let nextClassId = null;
        let historyNote = `Proses kenaikan tingkat dari tingkat ${sourceGrade}`;

        if (decision === 'naik') {
          const matchedClass = findMatchingRombel(student, sourceGrade, nextGrade);
          nextClassId = matchedClass?.id || null;
          if (!nextClassId) {
            throw new Error(`Rombel tujuan untuk ${student.name} belum tersedia. Buat kelas tingkat ${nextGrade} dengan rombel yang sama seperti ${student.current_class?.name || 'kelas asal'}.`);
          }
          historyNote = nextClassId
            ? `Naik otomatis ke tingkat ${nextGrade} dengan rombel tetap`
            : `Naik ke tingkat ${nextGrade}; rombel belum ditentukan`;
        }

        if (decision === 'tinggal') {
          const matchedClass = findMatchingRombel(student, sourceGrade, sourceGrade);
          nextClassId = matchedClass?.id || null;
          if (!nextClassId) {
            throw new Error(`Rombel tinggal kelas untuk ${student.name} belum tersedia. Buat kelas tingkat ${sourceGrade} dengan rombel yang sama seperti ${student.current_class?.name || 'kelas asal'}.`);
          }
          historyNote = nextClassId
            ? `Tinggal di tingkat ${sourceGrade} dengan rombel tetap`
            : `Tinggal di tingkat ${sourceGrade}; rombel belum ditentukan`;
        }

        if (applySavingsCut && ['naik', 'tinggal', 'lulus'].includes(decision)) {
          await applySavingsCarryOver(student);
        }

        await createStudentHistory({
          student_id: student.id,
          class_id: nextClassId,
          period_id: targetPeriod || null,
          status: decision,
          note: historyNote,
        });

        await saveStudent({
          id: student.id,
          current_class_id: nextClassId,
          is_active: !['lulus', 'keluar'].includes(decision),
        });
      }
      setToast(Number(sourceGrade) === 6 ? 'Siswa tingkat 6 ditandai lulus' : 'Proses tahun ajaran baru tersimpan');
    } catch (err) {
      setError(err.message || 'Gagal menyimpan kenaikan tingkat');
    }
  }

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-3 rounded-2xl border border-white/80 bg-white p-4 shadow-soft md:grid-cols-4">
        <select className="rounded-xl border px-3 py-2" value={sourcePeriod} onChange={(e) => setSourcePeriod(e.target.value)}>
          <option value="">Tahun ajaran asal</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="rounded-xl border px-3 py-2" value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)}>
          <option value="">Tahun ajaran tujuan</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="rounded-xl border px-3 py-2" value={sourceGrade} onChange={(e) => setSourceGrade(e.target.value)}>
          <option value="">Tingkat asal</option>{sourceGrades.map((grade) => <option key={grade} value={grade}>Tingkat {grade}</option>)}
        </select>
        <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Tujuan: {sourceGrade ? (Number(sourceGrade) === 6 ? 'Lulus' : `Tingkat ${nextGrade}`) : '-'}
          {nextGrade ? <p className="text-xs">Rombel dipertahankan, contoh 3A ke 4A.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-700">
        Tingkat SD/MI selalu 1 sampai 6. Tahun ajaran baru menaikkan tingkat otomatis; tingkat 6 menjadi lulus. Rombel dipertahankan jika kelas tujuan sudah dibuat, misalnya 3A ke 4A. Siswa baru tingkat 1 ditambahkan lewat menu Siswa atau Import Excel.
      </div>

      <label className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-soft">
        <input type="checkbox" checked={applySavingsCut} onChange={(e) => setApplySavingsCut(e.target.checked)} />
        Potong saldo tabungan 5% di akhir tahun ajaran, saldo sisa otomatis dilanjutkan.
      </label>

      <DataTable
        rows={students}
        columns={[
          { key: 'name', label: 'Siswa' },
          { key: 'nis', label: 'NIS' },
          { key: 'class', label: 'Kelas asal', render: (row) => row.current_class?.name || '-' },
          { key: 'decision', label: 'Keputusan', render: (row) => (
            <select className="rounded-md border px-2 py-1" value={decisions[row.id] || 'naik'} onChange={(e) => setDecisions({ ...decisions, [row.id]: e.target.value })}>
              {Number(sourceGrade) === 6 ? <option value="lulus">Lulus</option> : <option value="naik">Naik tingkat</option>}<option value="tinggal">Tinggal tingkat</option><option value="keluar">Keluar/pindah</option>
            </select>
          ) },
        ]}
      />
      <button disabled={!students.length || !targetPeriod || !sourceGrade} onClick={save} className="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-glow disabled:opacity-50">{Number(sourceGrade) === 6 ? 'Simpan Kelulusan' : 'Simpan Tahun Ajaran Baru'}</button>
    </div>
  );
}
