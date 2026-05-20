import { useEffect, useState } from 'react';
import { GraduationCap, Receipt, WalletCards } from 'lucide-react';
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
      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <MobileSafeStat title="Siswa Aktif" value={students.length} icon={GraduationCap} />
        <MobileSafeStat title="Tabungan Kelas" value={formatRupiah(summary.savings_balance)} icon={WalletCards} />
        <MobileSafeStat title="Setor" value={formatRupiah(summary.savings_deposit || 0)} icon={WalletCards} />
        <MobileSafeStat title="Tarik" value={formatRupiah(summary.savings_withdrawal || 0)} icon={WalletCards} />
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

function MobileSafeStat({ title, value, icon: Icon }) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-[18px] border border-white/80 bg-white p-3 shadow-sm sm:rounded-[22px] sm:p-4 sm:shadow-soft">
      <div className="flex min-h-[104px] flex-col justify-between gap-3 sm:min-h-0 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-xs leading-snug text-slate-500 sm:text-sm">{title}</p>
          <p className="mt-2 break-words text-lg font-bold leading-tight text-slate-950 sm:text-xl">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 sm:h-auto sm:w-auto sm:p-2.5">
          <Icon size={18} />
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
