import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import { listClassOptions, listPeriodOptions, listStudents } from '../../services/masterDataService';
import { getFinanceSummary, getSavingsWithdrawalCategoryLabel, listChargePayments, listSavingsTransactions, listSavingsYearEndActions } from '../../services/financeService';
import { formatDateId, formatRupiah } from '../../utils/formatters';
import { exportExcel } from '../../services/importService';
import { useAuth } from '../../contexts/AuthContext';

export default function ReportPage({ embedded = false, scope = 'all' }) {
  const { profile } = useAuth();
  const lockedClassId = scope === 'walas' ? profile?.assigned_class_id : null;
  const [filters, setFilters] = useState({});
  const [options, setOptions] = useState({ periods: [], classes: [], students: [] });
  const [summary, setSummary] = useState({});
  const [rows, setRows] = useState({ savings: [], charges: [], yearEnd: [] });
  const [activeTab, setActiveTab] = useState('savings');
  const [page, setPage] = useState(1);

  async function load() {
    const [finance, savings, charges, yearEnd] = await Promise.all([
      getFinanceSummary(filters),
      listSavingsTransactions(filters),
      listChargePayments(filters),
      listSavingsYearEndActions(filters),
    ]);
    setSummary(finance);
    setRows({ savings, charges, yearEnd });
  }

  useEffect(() => {
    Promise.all([listPeriodOptions(), listClassOptions(), listStudents({ activeOnly: true })]).then(([periods, classes, students]) => {
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
  const filteredClasses = options.classes.filter((item) => !filters.periodId || item.period_id === filters.periodId);
  const studentOptions = useMemo(() => {
    const search = (filters.studentSearch || '').trim().toLowerCase();
    return options.students.filter((student) => {
      if (lockedClassId && student.current_class_id !== lockedClassId && student.current_class?.id !== lockedClassId) return false;
      if (filters.periodId && student.current_class?.period_id !== filters.periodId) return false;
      if (filters.classId && student.current_class_id !== filters.classId && student.current_class?.id !== filters.classId) return false;
      if (search && !student.name?.toLowerCase().includes(search) && !student.nis?.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [options.students, filters.studentSearch, filters.periodId, filters.classId, lockedClassId]);
  const withdrawalSummary = rows.savings.reduce((acc, row) => {
    if (row.type !== 'tarik') return acc;
    const key = row.withdrawal_category || 'manual';
    acc[key] = (acc[key] || 0) + Number(row.amount || 0);
    return acc;
  }, {});
  const chargeTotal = rows.charges.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
  const yearEndSummary = rows.yearEnd.reduce((acc, row) => {
    const balanceBefore = Number(row.balance_before || 0);
    const cutAmount = Number(row.cut_amount || 0);
    acc.balanceBefore += balanceBefore;
    acc.cutAmount += cutAmount;
    acc.withdrawn += row.action === 'withdrawn' ? Number(row.amount || 0) : 0;
    acc.saved += row.action === 'saved' ? Math.max(balanceBefore - cutAmount, 0) : 0;
    return acc;
  }, { balanceBefore: 0, cutAmount: 0, withdrawn: 0, saved: 0 });
  const balanceAfterCut = Math.max(yearEndSummary.balanceBefore - yearEndSummary.cutAmount, 0);
  const tabs = [
    { id: 'savings', label: 'Tabungan', rows: rows.savings, exportName: 'tabungan.xlsx' },
    { id: 'charges', label: 'Tagihan', rows: rows.charges, exportName: 'tagihan.xlsx' },
    { id: 'yearEnd', label: 'Akhir Tahun', rows: rows.yearEnd, exportName: 'pengambilan-tabungan.xlsx' },
  ];
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="space-y-5">
      {!embedded ? (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Laporan Keuangan</h2>
          <p className="text-sm text-slate-500">Ringkasan pemasukan, penarikan, tagihan, dan pengambilan tabungan berdasarkan filter.</p>
        </div>
      ) : null}
      <div className="grid gap-3 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft md:grid-cols-6">
        <select className={inputClass} value={filters.periodId || ''} onChange={(e) => setFilters({ ...filters, periodId: e.target.value || undefined, classId: lockedClassId || undefined, studentId: undefined })}>
          <option value="">Semua tahun ajaran</option>
          {options.periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
        <select className={inputClass} value={filters.classId || ''} disabled={Boolean(lockedClassId) || !filters.periodId} onChange={(e) => setFilters({ ...filters, classId: e.target.value || undefined, studentId: undefined })}>
          <option value="">Semua kelas</option>
          {filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className={inputClass} value={filters.studentSearch || ''} onChange={(e) => setFilters({ ...filters, studentSearch: e.target.value, studentId: undefined })} placeholder="Cari siswa / NIS" />
        <select className={inputClass} value={filters.studentId || ''} disabled={!filters.periodId} onChange={(e) => setFilters({ ...filters, studentId: e.target.value || undefined })}>
          <option value="">Semua siswa</option>
          {studentOptions.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.current_class?.name || '-'}</option>)}
        </select>
        <input className={inputClass} type="date" value={filters.startDate || ''} onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })} />
        <input className={inputClass} type="date" value={filters.endDate || ''} onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-soft">
          <p className="font-bold text-slate-950">Tabungan</p>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <StatCard title="Saldo" value={formatRupiah(summary.savings_balance)} />
            <StatCard title="Setoran" value={formatRupiah(summary.savings_deposit)} />
            <StatCard title="Penarikan" value={formatRupiah(summary.savings_withdrawal)} />
          </div>
        </section>
        <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-soft">
          <p className="font-bold text-slate-950">Tagihan</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard title="Pembayaran Tagihan" value={formatRupiah(summary.charge_total ?? chargeTotal)} />
            <StatCard title="Dari Tabungan" value={formatRupiah(withdrawalSummary.charge)} />
          </div>
        </section>
        <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-soft">
          <p className="font-bold text-slate-950">Akhir Tahun</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard title="Saldo Sebelum Potong" value={formatRupiah(yearEndSummary.balanceBefore)} />
            <StatCard title="Bagi Hasil Sekolah" value={formatRupiah(yearEndSummary.cutAmount)} />
            <StatCard title="Saldo Setelah Potong" value={formatRupiah(balanceAfterCut)} />
            <StatCard title="Saldo Disimpan" value={formatRupiah(yearEndSummary.saved)} />
          </div>
        </section>
      </div>

      <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-2xl bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={() => exportExcel(currentTab.rows, currentTab.exportName)}>
            <Download size={16} /> Export Excel
          </button>
        </div>
        {activeTab === 'savings' ? (
          <PaginatedTable
            rows={rows.savings}
            page={page}
            setPage={setPage}
            columns={[
              { key: 'student', label: 'Siswa', render: (row) => row.student?.name },
              { key: 'transaction_date', label: 'Tanggal', render: (row) => formatDateId(row.transaction_date) },
              { key: 'type', label: 'Jenis' },
              { key: 'withdrawal_category', label: 'Kategori', render: (row) => getSavingsWithdrawalCategoryLabel(row) },
              { key: 'amount', label: 'Nominal', render: (row) => formatRupiah(row.amount) },
              { key: 'note', label: 'Keterangan' },
            ]}
          />
        ) : null}
        {activeTab === 'charges' ? (
          <PaginatedTable
            rows={rows.charges}
            page={page}
            setPage={setPage}
            columns={[
              { key: 'payment_date', label: 'Tanggal', render: (row) => formatDateId(row.payment_date) },
              { key: 'student', label: 'Siswa', render: (row) => row.student?.name },
              { key: 'category', label: 'Tagihan', render: (row) => row.category?.name },
              { key: 'payment_method', label: 'Metode', render: (row) => row.payment_method === 'dari_tabungan' ? 'Dari tabungan' : 'Tunai' },
              { key: 'amount_paid', label: 'Nominal', render: (row) => formatRupiah(row.amount_paid) },
              { key: 'note', label: 'Keterangan' },
            ]}
          />
        ) : null}
        {activeTab === 'yearEnd' ? (
          <PaginatedTable
            rows={rows.yearEnd}
            page={page}
            setPage={setPage}
            columns={[
              { key: 'student', label: 'Siswa', render: (row) => row.student?.name },
              { key: 'period', label: 'Tahun ajaran', render: (row) => row.period?.name },
              { key: 'action', label: 'Aksi', render: (row) => row.action === 'withdrawn' ? 'Diambil setelah bagi hasil' : row.action === 'saved' ? 'Disimpan setelah bagi hasil' : 'Bagi hasil 5%' },
              { key: 'balance_before', label: 'Sebelum potong', render: (row) => formatRupiah(row.balance_before) },
              { key: 'cut_amount', label: 'Bagi hasil 5%', render: (row) => formatRupiah(row.cut_amount) },
              { key: 'after_cut', label: 'Setelah potong', render: (row) => formatRupiah(Math.max(Number(row.balance_before || 0) - Number(row.cut_amount || 0), 0)) },
              { key: 'amount', label: 'Nominal diambil', render: (row) => formatRupiah(row.amount) },
              { key: 'note', label: 'Keterangan' },
            ]}
          />
        ) : null}
      </section>
    </div>
  );
}

function PaginatedTable({ rows, columns, page, setPage }) {
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-3">
      <DataTable rows={pagedRows} columns={columns} />
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500">Menampilkan {pagedRows.length} dari {rows.length} data</p>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button>
          <span className="text-slate-500">{currentPage}/{totalPages}</span>
          <button className="rounded-xl border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Berikutnya</button>
        </div>
      </div>
    </div>
  );
}
