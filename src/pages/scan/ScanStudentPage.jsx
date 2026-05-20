import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TransactionTabs from '../../components/TransactionTabs';
import { getStudent } from '../../services/masterDataService';
import { getPublicStudentQrFinance } from '../../services/financeService';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateId, formatRupiah } from '../../utils/formatters';

export default function ScanStudentPage() {
  const { id } = useParams();
  const { profile, loading } = useAuth();
  const [student, setStudent] = useState(null);
  const [publicData, setPublicData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setError('');
      try {
        const data = await getPublicStudentQrFinance(id);
        setPublicData(data);
        if (profile?.role === 'walas') {
          const studentData = await getStudent(id);
          setStudent(studentData);
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat data QR siswa');
      }
    }

    if (!loading) load();
  }, [id, profile?.role, loading]);

  if (loading || (!publicData && !error)) return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Memuat siswa...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  if (profile?.role === 'walas' && student) {
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

  const qrStudent = publicData?.student;

  return (
    <div className="min-h-screen bg-[#f7f1ff] px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[28px] bg-gradient-to-br from-brand-700 via-brand-600 to-[#8f28ff] p-5 text-white shadow-glow">
          <p className="text-sm text-white/75">Informasi siswa</p>
          <h1 className="mt-1 text-3xl font-bold">{qrStudent?.name || 'Siswa'}</h1>
          <p className="text-white/80">{qrStudent?.class_name || '-'} - NIS {qrStudent?.nis || '-'}</p>
          <div className="mt-5 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="text-sm text-white/75">Saldo tabungan tahun ajaran aktif</p>
            <p className="mt-1 text-3xl font-bold">{formatRupiah(publicData?.savings_balance || 0)}</p>
          </div>
        </div>

        <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-bold text-slate-950">Tagihan Siswa</h2>
          <div className="space-y-3">
            {(publicData?.charges || []).map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    <p className="text-xs text-slate-500">Terbayar {formatRupiah(item.paid)} dari {formatRupiah(item.amount)}</p>
                  </div>
                  <p className="font-bold text-slate-950">{formatRupiah(item.remaining)}</p>
                </div>
              </div>
            ))}
            {!publicData?.charges?.length ? <p className="text-sm text-slate-500">Belum ada tagihan untuk siswa ini.</p> : null}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-bold text-slate-950">Riwayat Tabungan</h2>
          <div className="space-y-3">
            {(publicData?.savings_history || []).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.type === 'tarik' ? 'Tarik' : 'Setor'} tabungan</p>
                  <p className="text-xs text-slate-500">{formatDateId(item.transaction_date)} - {item.note || 'Tanpa keterangan'}</p>
                </div>
                <p className="font-bold text-slate-950">{formatRupiah(item.amount)}</p>
              </div>
            ))}
            {!publicData?.savings_history?.length ? <p className="text-sm text-slate-500">Belum ada riwayat tabungan.</p> : null}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-bold text-slate-950">Riwayat Tagihan</h2>
          <div className="space-y-3">
            {(publicData?.charge_history || []).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.category_name}</p>
                  <p className="text-xs text-slate-500">{formatDateId(item.payment_date)} - {item.payment_method === 'dari_tabungan' ? 'Dari tabungan' : 'Tunai'}</p>
                </div>
                <p className="font-bold text-slate-950">{formatRupiah(item.amount_paid)}</p>
              </div>
            ))}
            {!publicData?.charge_history?.length ? <p className="text-sm text-slate-500">Belum ada riwayat pembayaran tagihan.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
