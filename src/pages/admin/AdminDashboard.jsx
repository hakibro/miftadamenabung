import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, Receipt, WalletCards } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import DashboardHeroCard from '../../components/DashboardHeroCard';
import { listClassOptions, listPeriodOptions, listStudents } from '../../services/masterDataService';
import { getFinanceSummary, listSavingsTransactions } from '../../services/financeService';
import { formatDateId, formatRupiah } from '../../utils/formatters';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, classes: 0, summary: {}, latest: [] });
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');

  useEffect(() => {
    listPeriodOptions().then((periodRows) => {
      setPeriods(periodRows);
      setPeriodId((current) => current || periodRows.find((item) => item.is_active)?.id || periodRows[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    if (!periodId) return;
    Promise.all([listStudents(), listClassOptions(), getFinanceSummary({ periodId }), listSavingsTransactions({ periodId })])
      .then(([students, classes, summary, transactions]) => {
        setStats({
          students: students.filter((student) => student.current_class?.period_id === periodId).length,
          classes: classes.filter((item) => item.period_id === periodId).length,
          summary,
          latest: transactions.slice(0, 8),
        });
      });
  }, [periodId]);

  const selectedPeriod = periods.find((period) => period.id === periodId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Dashboard Admin</h2>
          <p className="text-sm text-slate-500">Data ditampilkan untuk {selectedPeriod?.name || 'tahun ajaran terpilih'}.</p>
        </div>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          {periods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.is_active ? ' (aktif)' : ''}</option>)}
        </select>
      </div>
      <DashboardHeroCard
        title="Total Saldo Tabungan"
        amount={stats.summary.savings_balance}
        income={(stats.summary.savings_deposit || 0) + (stats.summary.charge_total || 0)}
        expense={stats.summary.savings_withdrawal || 0}
        helper={`Ringkasan ${selectedPeriod?.name || 'tahun ajaran'}`}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Siswa" value={stats.students} icon={GraduationCap} />
        <StatCard title="Total Kelas" value={stats.classes} icon={BookOpen} />
        <StatCard title="Saldo Tabungan" value={formatRupiah(stats.summary.savings_balance)} icon={WalletCards} />
        <StatCard title="Total Tagihan" value={formatRupiah(stats.summary.charge_total)} icon={Receipt} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-950">Transaksi terbaru</h2>
        <DataTable
          rows={stats.latest}
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
