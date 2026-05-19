import { useEffect, useState } from 'react';
import { GraduationCap, HandCoins, Receipt, WalletCards } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import DashboardHeroCard from '../../components/DashboardHeroCard';
import { useAuth } from '../../contexts/AuthContext';
import { listStudents } from '../../services/masterDataService';
import { getFinanceSummary } from '../../services/financeService';
import { formatRupiah } from '../../utils/formatters';

export default function WalasDashboard() {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    const classId = profile?.assigned_class_id;
    if (!classId) return;
    Promise.all([listStudents({ mineAsWalas: true }), getFinanceSummary({ classId })]).then(([studentRows, finance]) => {
      setStudents(studentRows);
      setSummary(finance);
    });
  }, [profile?.assigned_class_id]);

  return (
    <div className="space-y-5">
      <DashboardHeroCard
        title="Tabungan Kelas"
        amount={summary.savings_balance}
        income={(summary.savings_deposit || 0) + (summary.infaq_total || 0) + (summary.lks_total || 0)}
        expense={summary.savings_withdrawal || 0}
        helper={`${students.length} siswa aktif`}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Siswa Aktif" value={students.length} icon={GraduationCap} />
        <StatCard title="Tabungan Kelas" value={formatRupiah(summary.savings_balance)} icon={WalletCards} />
        <StatCard title="Infaq Kelas" value={formatRupiah(summary.infaq_total)} icon={HandCoins} />
        <StatCard title="Pembayaran LKS" value={formatRupiah(summary.lks_total)} icon={Receipt} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-950">Siswa kelas</h2>
        <DataTable
          rows={students}
          columns={[
            { key: 'name', label: 'Nama' },
            { key: 'nis', label: 'NIS' },
            { key: 'gender', label: 'JK' },
            { key: 'status', label: 'Status', render: (row) => (row.is_active ? 'Aktif' : 'Nonaktif') },
          ]}
        />
      </section>
    </div>
  );
}
