import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import StatCard from '../../components/StatCard';
import { getStudent } from '../../services/masterDataService';
import { getSavingsBalance, listInfaqPayments, listLksPayments, listSavingsTransactions } from '../../services/financeService';
import { formatDateId, formatRupiah } from '../../utils/formatters';

export default function StudentDetailPage() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [balance, setBalance] = useState(0);
  const [rows, setRows] = useState({ savings: [], infaq: [], lks: [] });

  useEffect(() => {
    Promise.all([getStudent(id), getSavingsBalance(id), listSavingsTransactions({ studentId: id }), listInfaqPayments({ studentId: id }), listLksPayments({ studentId: id })])
      .then(([studentData, savingsBalance, savings, infaq, lks]) => {
        setStudent(studentData);
        setBalance(savingsBalance);
        setRows({ savings, infaq, lks });
      });
  }, [id]);

  if (!student) return <p className="text-sm text-slate-500">Memuat detail siswa...</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-2xl font-semibold text-slate-900">{student.name}</h2>
          <p className="text-slate-600">NIS {student.nis} | {student.current_class?.name}</p>
          <p className="mt-2 text-sm text-slate-500">{student.note || 'Tidak ada keterangan'}</p>
        </div>
        <StatCard title="Saldo Tabungan" value={formatRupiah(balance)} />
      </div>
      <DataTable
        rows={rows.savings}
        columns={[
          { key: 'transaction_date', label: 'Tanggal', render: (row) => formatDateId(row.transaction_date) },
          { key: 'type', label: 'Jenis' },
          { key: 'amount', label: 'Nominal', render: (row) => formatRupiah(row.amount) },
          { key: 'note', label: 'Keterangan' },
        ]}
      />
    </div>
  );
}
