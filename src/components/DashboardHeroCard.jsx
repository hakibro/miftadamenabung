import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatRupiah } from '../utils/formatters';

export default function DashboardHeroCard({ title = 'Total Balance', amount, income, expense, helper, incomeLabel = 'Pemasukan', expenseLabel = 'Pengeluaran' }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-700 via-brand-600 to-[#8f28ff] p-5 text-white shadow-glow sm:p-6">
      <div className="absolute inset-0 opacity-20">
        <div className="h-full w-full bg-[linear-gradient(135deg,rgba(255,255,255,0.34)_0_12%,transparent_12%_28%,rgba(255,255,255,0.18)_28%_42%,transparent_42%_100%)]" />
      </div>
      <div className="relative">
        <p className="text-sm font-medium text-white/80">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">{formatRupiah(amount)}</p>
        {helper ? <p className="mt-1 text-sm text-white/75">{helper}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-white/75">
              <ArrowDownLeft size={14} className="text-candy-mint" />
              {incomeLabel}
            </div>
            <p className="mt-1 truncate text-base font-semibold">{formatRupiah(income)}</p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-white/75">
              <ArrowUpRight size={14} className="text-candy-pink" />
              {expenseLabel}
            </div>
            <p className="mt-1 truncate text-base font-semibold">{formatRupiah(expense)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
