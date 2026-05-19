import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, HandCoins, Receipt, WalletCards } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import DashboardHeroCard from '../../components/DashboardHeroCard';
import { listClassOptions, listStudents } from '../../services/masterDataService';
import { getFinanceSummary, listSavingsTransactions } from '../../services/financeService';
import { formatDateId, formatRupiah } from '../../utils/formatters';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, classes: 0, summary: {}, latest: [] });

  useEffect(() => {
    Promise.all([listStudents(), listClassOptions(), getFinanceSummary(), listSavingsTransactions()])
      .then(([students, classes, summary, transactions]) => {
        setStats({ students: students.length, classes: classes.length, summary, latest: transactions.slice(0, 8) });
      });
  }, []);

  return (
    <div className="space-y-5">
      <DashboardHeroCard
        title="Total Saldo Tabungan"
        amount={stats.summary.savings_balance}
        income={(stats.summary.savings_deposit || 0) + (stats.summary.infaq_total || 0) + (stats.summary.lks_total || 0)}
        expense={stats.summary.savings_withdrawal || 0}
        helper="Ringkasan keuangan sekolah"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Siswa" value={stats.students} icon={GraduationCap} />
        <StatCard title="Total Kelas" value={stats.classes} icon={BookOpen} />
        <StatCard title="Saldo Tabungan" value={formatRupiah(stats.summary.savings_balance)} icon={WalletCards} />
        <StatCard title="Total Infaq" value={formatRupiah(stats.summary.infaq_total)} icon={HandCoins} />
        <StatCard title="Total LKS" value={formatRupiah(stats.summary.lks_total)} icon={Receipt} />
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
