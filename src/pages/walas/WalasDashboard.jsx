import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, GraduationCap, Receipt, WalletCards } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../contexts/AuthContext';
import { listStudents } from '../../services/masterDataService';
import { getFinanceSummary, listChargeCategories, listChargePayments } from '../../services/financeService';
import { formatRupiah } from '../../utils/formatters';

export default function WalasDashboard() {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({});
  const [chargeSummary, setChargeSummary] = useState({ paid: 0, unpaid: 0 });

  useEffect(() => {
    const classId = profile?.assigned_class_id;
    if (!classId) return;
    listStudents({ mineAsWalas: true }).then(async (studentRows) => {
      const activePeriodId = studentRows[0]?.current_class?.period_id || null;
      const [finance, categories, payments] = await Promise.all([
        getFinanceSummary({ classId, periodId: activePeriodId }),
        listChargeCategories({ periodId: activePeriodId }),
        listChargePayments({ classId, periodId: activePeriodId }),
      ]);
      const paidByStudentCategory = payments.reduce((map, payment) => {
        const key = `${payment.student_id}-${payment.charge_category_id}`;
        map.set(key, (map.get(key) || 0) + Number(payment.amount_paid || 0));
        return map;
      }, new Map());
      const totals = studentRows.reduce((acc, student) => {
        categories.filter((category) => chargeAppliesToStudent(category, student)).forEach((category) => {
          const paid = paidByStudentCategory.get(`${student.id}-${category.id}`) || 0;
          acc.paid += paid;
          acc.unpaid += Math.max(Number(category.amount || 0) - paid, 0);
        });
        return acc;
      }, { paid: 0, unpaid: 0 });
      setStudents(studentRows);
      setSummary(finance);
      setChargeSummary(totals);
    });
  }, [profile?.assigned_class_id]);

  return (
    <div className="flex min-w-0 flex-col gap-5 overflow-hidden">
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <WalasSummaryCard
          title="Tabungan Kelas"
          amount={summary.savings_balance}
          income={summary.savings_deposit || 0}
          expense={summary.savings_withdrawal || 0}
          incomeLabel="Setor"
          expenseLabel="Tarik"
          helper={`${students.length} siswa aktif`}
        />
        <WalasSummaryCard
          title="Tagihan Kelas"
          amount={chargeSummary.unpaid}
          income={chargeSummary.paid}
          expense={chargeSummary.unpaid}
          incomeLabel="Sudah bayar"
          expenseLabel="Belum lunas"
          helper="Sisa tagihan siswa pada tahun ajaran aktif"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <MobileSafeStat title="Siswa Aktif" value={students.length} icon={GraduationCap} />
        <MobileSafeStat title="Tabungan Kelas" value={formatRupiah(summary.savings_balance)} icon={WalletCards} />
        <MobileSafeStat title="Tagihan Sudah Bayar" value={formatRupiah(chargeSummary.paid)} icon={Receipt} />
        <MobileSafeStat title="Tagihan Belum Lunas" value={formatRupiah(chargeSummary.unpaid)} icon={Receipt} />
      </div>
      <section className="relative z-0 min-w-0">
        <h2 className="mb-3 text-lg font-bold text-slate-950">Siswa kelas</h2>
        <div className="flex flex-col gap-3 md:hidden">
          {students.length ? students.slice(0, 8).map((student) => (
            <article key={student.id} className="min-w-0 rounded-2xl border border-white/80 bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-bold leading-snug text-slate-950">{student.name}</p>
                  <p className="mt-1 text-sm text-slate-500">NIS {student.nis || '-'}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {student.gender}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{student.is_active ? 'Aktif' : 'Nonaktif'}</p>
            </article>
          )) : (
            <div className="rounded-2xl border border-white/80 bg-white p-4 text-sm text-slate-500 shadow-soft">Belum ada siswa.</div>
          )}
          {students.length > 8 ? <p className="px-1 text-sm text-slate-500">Menampilkan 8 dari {students.length} siswa. Buka menu Siswa untuk daftar lengkap.</p> : null}
        </div>
        <div className="hidden md:block">
          <DataTable
            rows={students}
            columns={[
              { key: 'name', label: 'Nama' },
              { key: 'nis', label: 'NIS' },
              { key: 'gender', label: 'JK' },
              { key: 'status', label: 'Status', render: (row) => (row.is_active ? 'Aktif' : 'Nonaktif') },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function WalasSummaryCard({ title, amount, helper, income, expense, incomeLabel, expenseLabel }) {
  return (
    <section className="min-w-0 rounded-[28px] bg-brand-600 p-5 text-white shadow-sm sm:p-6 sm:shadow-glow">
      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="mt-2 break-words text-3xl font-bold leading-tight tracking-normal sm:text-4xl">{formatRupiah(amount)}</p>
      {helper ? <p className="mt-1 text-sm text-white/75">{helper}</p> : null}
      <div className="mt-5 grid min-w-0 grid-cols-2 gap-3 rounded-2xl bg-white/12 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs text-white/75">
            <ArrowDownLeft size={14} className="text-candy-mint" />
            <span className="truncate">{incomeLabel}</span>
          </div>
          <p className="mt-1 truncate text-base font-semibold">{formatRupiah(income)}</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs text-white/75">
            <ArrowUpRight size={14} className="text-candy-pink" />
            <span className="truncate">{expenseLabel}</span>
          </div>
          <p className="mt-1 truncate text-base font-semibold">{formatRupiah(expense)}</p>
        </div>
      </div>
    </section>
  );
}

function MobileSafeStat({ title, value, icon: Icon }) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-[22px] border border-white/80 bg-white p-4 shadow-sm sm:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-slate-950">{value}</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-brand-50 p-2.5 text-brand-700">
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function chargeAppliesToStudent(category, student) {
  if (!category || !student) return false;
  const gradeSet = new Set((category.grades || []).map((item) => Number(item.grade)));
  if (category.period_id !== student.current_class?.period_id) return false;
  if (gradeSet.size && !gradeSet.has(Number(student.current_class?.grade))) return false;
  if (category.gender_scope !== 'all' && student.gender !== category.gender_scope) return false;
  return true;
}
