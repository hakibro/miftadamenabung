import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HandCoins, PiggyBank, Wallet } from 'lucide-react';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { listClassOptions, listPeriodOptions, listStudents } from '../../services/masterDataService';
import { getSavingsBalance, listSavingsYearEndActions, processYearEndSavingsAction } from '../../services/financeService';
import { formatRupiah } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const actionLabels = {
  saved: 'Simpan saldo setelah bagi hasil',
  withdrawn: 'Ambil saldo setelah bagi hasil',
};

export default function SavingsWithdrawalsPage({ scope = 'all' }) {
  const { profile } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [actions, setActions] = useState([]);
  const [filters, setFilters] = useState({ periodId: '', classId: '' });
  const [note, setNote] = useState('');
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const isWalasScope = scope === 'walas';

  async function loadBase() {
    setLoading(true);
    try {
      const [periodRows, classRows] = await Promise.all([listPeriodOptions(), listClassOptions()]);
      const walasClass = classRows.find((item) => item.id === profile?.assigned_class_id);
      const activePeriod = periodRows.find((period) => period.id === walasClass?.period_id) || periodRows.find((period) => period.is_active) || periodRows[0];
      setPeriods(periodRows);
      setClasses(classRows);
      setFilters((current) => ({
        ...current,
        periodId: current.periodId || activePeriod?.id || '',
        classId: isWalasScope ? profile?.assigned_class_id || '' : current.classId,
      }));
    } catch (err) {
      setError(err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  async function loadRows(periodId = filters.periodId) {
    if (!periodId) return;
    setLoading(true);
    try {
      const [studentRows, actionRows] = await Promise.all([
        listStudents(isWalasScope ? { mineAsWalas: true } : { activeOnly: true }),
        listSavingsYearEndActions({ periodId }),
      ]);
      const periodStudents = studentRows.filter((student) => student.current_class?.period_id === periodId);
      const rowsWithBalance = await Promise.all(
        periodStudents.map(async (student) => ({
          ...student,
          active_balance: await getSavingsBalance(student.id, periodId),
          total_balance: await getSavingsBalance(student.id),
        }))
      );
      setStudents(rowsWithBalance);
      setActions(actionRows);
    } catch (err) {
      setError(err.message || 'Gagal memuat saldo tabungan');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, [profile?.assigned_class_id]);

  useEffect(() => {
    if (filters.periodId) loadRows(filters.periodId);
  }, [filters.periodId]);

  const visibleClasses = classes.filter((item) => item.period_id === filters.periodId && (!isWalasScope || item.id === profile?.assigned_class_id));
  const visibleStudents = useMemo(() => (
    students.filter((student) => !filters.classId || student.current_class_id === filters.classId)
  ), [students, filters.classId]);
  const actionByStudent = new Map(actions.map((item) => [item.student_id, item]));
  const totalActiveBalance = visibleStudents.reduce((sum, student) => sum + getBalanceBefore(student, actionByStudent.get(student.id)), 0);
  const totalCutAmount = visibleStudents.reduce((sum, student) => sum + getSavedCutAmount(student, actionByStudent.get(student.id)), 0);
  const totalAfterCut = visibleStudents.reduce((sum, student) => sum + getBalanceAfterCut(student, actionByStudent.get(student.id)), 0);
  const totalAllBalance = visibleStudents.reduce((sum, student) => sum + Number(student.total_balance || 0), 0);

  async function processAction(student, action) {
    setError('');
    setProcessingId(`${student.id}-${action}`);
    try {
      await processYearEndSavingsAction({
        student_id: student.id,
        period_id: filters.periodId,
        action,
        note: note || undefined,
      });
      setToast(`${actionLabels[action]} untuk ${student.name} berhasil diproses`);
      await loadRows(filters.periodId);
    } catch (err) {
      setError(err.message || 'Gagal memproses pengambilan tabungan');
    } finally {
      setProcessingId('');
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div>
        <h2 className="text-xl font-bold text-slate-950">Pengambilan Tabungan</h2>
        <p className="text-sm text-slate-500">Proses bagi hasil sekolah 5%, pengambilan, atau penyimpanan saldo dilakukan per tahun ajaran aktif{isWalasScope ? ' untuk kelas yang dipegang.' : '.'}</p>
      </div>

      <div className="grid gap-3 rounded-[24px] bg-white p-4 shadow-soft md:grid-cols-3">
        <FormField label="Tahun ajaran">
          <select className={inputClass} value={filters.periodId} onChange={(e) => setFilters({ periodId: e.target.value, classId: isWalasScope ? profile?.assigned_class_id || '' : '' })}>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.is_active ? ' (aktif)' : ''}</option>)}
          </select>
        </FormField>
        <FormField label="Kelas">
          <select className={inputClass} value={filters.classId} disabled={isWalasScope} onChange={(e) => setFilters({ ...filters, classId: e.target.value })}>
            <option value="">Semua kelas</option>
            {visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FormField>
        <FormField label="Catatan proses">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" />
        </FormField>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={PiggyBank} title="Saldo sebelum potong" value={formatRupiah(totalActiveBalance)} />
        <SummaryCard icon={HandCoins} title="Bagi hasil sekolah 5%" value={formatRupiah(totalCutAmount)} />
        <SummaryCard icon={Wallet} title="Saldo setelah potong" value={formatRupiah(totalAfterCut)} helper={`Total uang siswa: ${formatRupiah(totalAllBalance)}`} />
        <SummaryCard icon={CheckCircle2} title="Sudah diproses" value={`${actions.length} siswa`} />
      </div>

      <div className="overflow-hidden rounded-[24px] bg-white shadow-soft">
        <div className="border-b border-slate-100 p-4">
          <p className="font-bold text-slate-950">Daftar saldo siswa</p>
          <p className="text-xs text-slate-500">Saldo awal tahun ajaran baru dihitung dari transaksi pada tahun ajaran tersebut, jadi saldo lama tidak ikut terpotong ulang.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? <p className="p-4 text-sm text-slate-500">Memuat data...</p> : null}
          {!loading && visibleStudents.length === 0 ? <p className="p-4 text-sm text-slate-500">Belum ada siswa pada filter ini.</p> : null}
          {visibleStudents.map((student) => {
            const latestAction = actionByStudent.get(student.id);
            const balanceBefore = getBalanceBefore(student, latestAction);
            const cutAmount = getSavedCutAmount(student, latestAction);
            const balanceAfterCut = getBalanceAfterCut(student, latestAction);
            return (
              <div key={student.id} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr] lg:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{student.name}</p>
                  <p className="text-xs text-slate-500">{student.nis || '-'} • {student.current_class?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Sebelum potong</p>
                  <p className="font-bold text-slate-950">{formatRupiah(balanceBefore)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Bagi hasil sekolah 5%</p>
                  <p className="font-semibold text-rose-600">{formatRupiah(cutAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Setelah potong</p>
                  <p className="font-bold text-emerald-700">{formatRupiah(balanceAfterCut)}</p>
                  <p className="text-[11px] text-slate-400">Total: {formatRupiah(student.total_balance)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={Boolean(latestAction) || processingId === `${student.id}-saved`} onClick={() => processAction(student, 'saved')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">
                    Simpan saldo
                  </button>
                  <button disabled={Boolean(latestAction) || processingId === `${student.id}-withdrawn` || Number(student.active_balance) <= 0} onClick={() => processAction(student, 'withdrawn')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">
                    Ambil saldo setelah bagi hasil
                  </button>
                  {latestAction ? <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{actionLabels[latestAction.action]}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCutAmount(balance) {
  return Math.floor(Number(balance || 0) * 0.05);
}

function getBalanceBefore(student, action) {
  return Number(action?.balance_before ?? student.active_balance ?? 0);
}

function getSavedCutAmount(student, action) {
  if (action?.cut_amount !== undefined && action?.cut_amount !== null) return Number(action.cut_amount || 0);
  return getCutAmount(getBalanceBefore(student, action));
}

function getBalanceAfterCut(student, action) {
  return Math.max(getBalanceBefore(student, action) - getSavedCutAmount(student, action), 0);
}

function SummaryCard({ icon: Icon, title, value, helper }) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-soft">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon size={22} />
      </div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}
