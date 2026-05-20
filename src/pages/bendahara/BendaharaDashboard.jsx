import { useEffect, useState } from 'react';
import { BarChart3, Receipt, WalletCards } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DashboardHeroCard from '../../components/DashboardHeroCard';
import ReportPage from '../shared/ReportPage';
import { getFinanceSummary } from '../../services/financeService';
import { formatRupiah } from '../../utils/formatters';

export default function BendaharaDashboard() {
  const [summary, setSummary] = useState({});

  useEffect(() => {
    getFinanceSummary().then(setSummary);
  }, []);

  return (
    <div className="space-y-5">
      <DashboardHeroCard
        title="Pemasukan Global"
        amount={(summary.savings_deposit || 0) + (summary.charge_total || 0)}
        income={(summary.savings_deposit || 0) + (summary.charge_total || 0)}
        expense={summary.savings_withdrawal || 0}
        helper="Pantauan bendahara"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pemasukan Global" value={formatRupiah((summary.savings_deposit || 0) + (summary.charge_total || 0))} icon={BarChart3} />
        <StatCard title="Saldo Tabungan" value={formatRupiah(summary.savings_balance)} icon={WalletCards} />
        <StatCard title="Total Tagihan" value={formatRupiah(summary.charge_total)} icon={Receipt} />
      </div>
      <ReportPage embedded />
    </div>
  );
}
