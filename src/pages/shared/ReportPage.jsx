import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import { listClassOptions, listPeriodOptions, listStudents } from '../../services/masterDataService';
import { getFinanceSummary, listInfaqPayments, listLksPayments, listSavingsTransactions } from '../../services/financeService';
import { formatDateId, formatRupiah } from '../../utils/formatters';
import { exportExcel } from '../../services/importService';
import { useAuth } from '../../contexts/AuthContext';

export default function ReportPage({ embedded = false, scope = 'all' }) {
  const { profile } = useAuth();
  const lockedClassId = scope === 'walas' ? profile?.assigned_class_id : null;
  const [filters, setFilters] = useState({});
  const [options, setOptions] = useState({ periods: [], classes: [], students: [] });
  const [summary, setSummary] = useState({});
  const [rows, setRows] = useState({ savings: [], infaq: [], lks: [] });

  async function load() {
    const [finance, savings, infaq, lks] = await Promise.all([
      getFinanceSummary(filters),
      listSavingsTransactions(filters),
      listInfaqPayments(filters),
      listLksPayments(filters),
    ]);
    setSummary(finance);
    setRows({ savings, infaq, lks });
  }

  useEffect(() => {
    Promise.all([listPeriodOptions(), listClassOptions(), listStudents({ classId: lockedClassId, activeOnly: true })]).then(([periods, classes, students]) => {
      setOptions({ periods, classes: lockedClassId ? classes.filter((item) => item.id === lockedClassId) : classes, students });
      const activePeriod = periods.find((period) => period.is_active) || periods[0];
      if (activePeriod) {
        setFilters((current) => ({ ...current, periodId: current.periodId || activePeriod.id }));
      }
    });
  }, [lockedClassId]);

  useEffect(() => {
    if (lockedClassId) setFilters((current) => ({ ...current, classId: lockedClassId }));
  }, [lockedClassId]);

  useEffect(() => {
    load();
  }, [filters.periodId, filters.classId, filters.studentId, filters.startDate, filters.endDate]);

  const inputClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="space-y-5">
      {!embedded ? <h2 className="text-xl font-semibold text-slate-900">Laporan Keuangan</h2> : null}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <select className={inputClass} value={filters.periodId || ''} onChange={(e) => setFilters({ ...filters, periodId: e.target.value || undefined })}>
          <option value="">Semua tahun ajaran</option>
          {options.periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
        <select className={inputClass} value={filters.classId || ''} disabled={Boolean(lockedClassId) || !filters.periodId} onChange={(e) => setFilters({ ...filters, classId: e.target.value || undefined, studentId: undefined })}>
          <option value="">Semua kelas</option>
          {options.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={filters.studentId || ''} disabled={!filters.periodId} onChange={(e) => setFilters({ ...filters, studentId: e.target.value || undefined })}>
          <option value="">Semua siswa</option>
          {options.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className={inputClass} type="date" value={filters.startDate || ''} onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })} />
        <input className={inputClass} type="date" value={filters.endDate || ''} onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Saldo Tabungan" value={formatRupiah(summary.savings_balance)} />
        <StatCard title="Setoran" value={formatRupiah(summary.savings_deposit)} />
        <StatCard title="Penarikan" value={formatRupiah(summary.savings_withdrawal)} />
        <StatCard title="Infaq" value={formatRupiah(summary.infaq_total)} />
        <StatCard title="LKS" value={formatRupiah(summary.lks_total)} />
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">Riwayat tabungan</h3>
          <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm" onClick={() => exportExcel(rows.savings, 'tabungan.xlsx')}>
            <Download size={16} /> Export Excel
          </button>
        </div>
        <DataTable
          rows={rows.savings}
          columns={[
            { key: 'student', label: 'Siswa', render: (row) => row.student?.name },
            { key: 'transaction_date', label: 'Tanggal', render: (row) => formatDateId(row.transaction_date) },
            { key: 'type', label: 'Jenis' },
            { key: 'amount', label: 'Nominal', render: (row) => formatRupiah(row.amount) },
            { key: 'note', label: 'Keterangan' },
          ]}
        />
      </section>
    </div>
  );
}
