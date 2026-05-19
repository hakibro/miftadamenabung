import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TransactionTabs from '../../components/TransactionTabs';
import { getStudent } from '../../services/masterDataService';

export default function ScanStudentPage() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    getStudent(id).then(setStudent);
  }, [id]);

  if (!student) return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Memuat siswa...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Input cepat QR</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-900">{student.name}</h2>
        <p className="text-lg text-slate-600">{student.current_class?.name} - NIS {student.nis}</p>
      </div>
      <TransactionTabs student={student} method="scan_qr" />
    </div>
  );
}
