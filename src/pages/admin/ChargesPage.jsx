import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { listPeriodOptions, listStudents } from '../../services/masterDataService';
import { createChargePayment, deleteChargeCategory, listChargeCategories, listChargePayments, saveChargeCategory } from '../../services/financeService';
import { formatDateId, formatRupiah, todayISO } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const emptyCategory = {
  id: null,
  name: '',
  period_id: '',
  amount: '',
  allow_installments: true,
  gender_scope: 'all',
  grades: [1, 2, 3, 4, 5, 6],
  note: '',
};

export default function ChargesPage({ mode = 'full', scope = 'all', embedded = false }) {
  const { profile } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [paymentForm, setPaymentForm] = useState({ charge_category_id: '', student_id: '', amount_paid: '', payment_method: 'tunai', payment_date: todayISO(), note: '' });
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const showSettings = mode === 'full' || mode === 'settings';
  const showInput = mode === 'full' || mode === 'input';
  const isWalasScope = scope === 'walas';

  async function load() {
    try {
      const [periodRows, studentRows] = await Promise.all([
        listPeriodOptions(),
        listStudents(isWalasScope ? { mineAsWalas: true } : { activeOnly: true }),
      ]);
      const walasPeriodId = studentRows[0]?.current_class?.period_id || '';
      const activePeriod = periodRows.find((period) => period.id === walasPeriodId) || periodRows.find((period) => period.is_active) || periodRows[0];
      setPeriods(periodRows);
      setStudents(studentRows);
      const periodId = categoryForm.period_id || activePeriod?.id || '';
      setCategoryForm((current) => ({ ...current, period_id: current.period_id || periodId }));
      const [categoryRows, paymentRows] = await Promise.all([
        listChargeCategories({ periodId }),
        listChargePayments(),
      ]);
      setCategories(categoryRows);
      setPayments(paymentRows);
    } catch (err) {
      setError(err.message || 'Gagal memuat tagihan');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function reloadForPeriod(periodId) {
    const categoryRows = await listChargeCategories({ periodId });
    setCategories(categoryRows);
  }

  const selectedStudent = students.find((student) => student.id === paymentForm.student_id);
  function chargeAppliesToStudent(category, student) {
    if (!category || !student) return false;
    const gradeSet = new Set((category.grades || []).map((item) => Number(item.grade)));
    if (student.current_class?.period_id !== category.period_id) return false;
    if (gradeSet.size && !gradeSet.has(Number(student.current_class?.grade))) return false;
    if (category.gender_scope !== 'all' && student.gender !== category.gender_scope) return false;
    return true;
  }
  const eligibleCategories = useMemo(() => {
    if (selectedStudent) return categories.filter((category) => chargeAppliesToStudent(category, selectedStudent));
    return categories.filter((category) => students.some((student) => chargeAppliesToStudent(category, student)));
  }, [categories, students, selectedStudent]);
  async function submitCategory(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await saveChargeCategory({
        ...categoryForm,
        amount: Number(categoryForm.amount),
        grades: categoryForm.grades,
      });
      setToast('Kategori tagihan tersimpan');
      setCategoryForm({ ...emptyCategory, period_id: categoryForm.period_id });
      await reloadForPeriod(categoryForm.period_id);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan kategori tagihan');
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const selectedCategory = categories.find((item) => item.id === paymentForm.charge_category_id);
      const defaultSavingsNote = selectedCategory?.name
        ? `Pembayaran tagihan ${selectedCategory.name} dari tabungan`
        : 'Pembayaran tagihan dari tabungan';
      await createChargePayment({
        ...paymentForm,
        note: paymentForm.payment_method === 'dari_tabungan'
          ? paymentForm.note || defaultSavingsNote
          : paymentForm.note,
      });
      setToast('Pembayaran tagihan tersimpan');
      setPaymentForm({ ...paymentForm, amount_paid: '', note: '' });
      const paymentRows = await listChargePayments();
      setPayments(paymentRows);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pembayaran tagihan');
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(id) {
    if (!window.confirm('Hapus kategori tagihan ini?')) return;
    setError('');
    try {
      await deleteChargeCategory(id);
      setToast('Kategori tagihan dihapus');
      await reloadForPeriod(categoryForm.period_id);
    } catch (err) {
      setError(err.message || 'Gagal menghapus kategori tagihan');
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
  const visiblePayments = isWalasScope
    ? payments.filter((item) => students.some((student) => student.id === item.student_id))
    : payments;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {!embedded ? (
        <div>
          <h2 className="text-xl font-bold text-slate-950">Tagihan</h2>
          <p className="text-sm text-slate-500">{showSettings ? 'Buat kategori tagihan untuk tingkat tertentu.' : 'Input pembayaran tagihan siswa pada kelas yang dipegang.'}</p>
        </div>
      ) : null}

      {showSettings ? <form onSubmit={submitCategory} className="grid gap-3 rounded-[24px] bg-white p-4 shadow-soft md:grid-cols-3">
        <FormField label="Tahun ajaran">
          <select
            className={inputClass}
            value={categoryForm.period_id}
            onChange={async (e) => {
              const periodId = e.target.value;
              setCategoryForm({ ...categoryForm, period_id: periodId });
              await reloadForPeriod(periodId);
            }}
            required
          >
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.is_active ? ' (aktif)' : ''}</option>)}
          </select>
        </FormField>
        <FormField label="Nama tagihan">
          <input className={inputClass} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Contoh: Buku Tema" required />
        </FormField>
        <FormField label="Nominal">
          <input type="number" min="1" className={inputClass} value={categoryForm.amount} onChange={(e) => setCategoryForm({ ...categoryForm, amount: e.target.value })} required />
        </FormField>
        <FormField label="Untuk JK">
          <select className={inputClass} value={categoryForm.gender_scope} onChange={(e) => setCategoryForm({ ...categoryForm, gender_scope: e.target.value })}>
            <option value="all">Semua</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </FormField>
        <FormField label="Catatan">
          <input className={inputClass} value={categoryForm.note} onChange={(e) => setCategoryForm({ ...categoryForm, note: e.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={categoryForm.allow_installments} onChange={(e) => setCategoryForm({ ...categoryForm, allow_installments: e.target.checked })} />
          Bisa dicicil
        </label>
        <div className="md:col-span-3">
          <p className="mb-2 text-sm font-medium text-slate-700">Terapkan ke tingkat</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((grade) => (
              <label key={grade} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={categoryForm.grades.includes(grade)}
                  onChange={(e) => {
                    const grades = e.target.checked
                      ? [...categoryForm.grades, grade]
                      : categoryForm.grades.filter((item) => item !== grade);
                    setCategoryForm({ ...categoryForm, grades });
                  }}
                />
                {grade}
              </label>
            ))}
          </div>
        </div>
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-glow disabled:opacity-50 md:col-span-3">
          <Plus size={18} /> {categoryForm.id ? 'Update Kategori' : 'Simpan Kategori'}
        </button>
      </form> : null}

      <div className={`grid gap-4 ${showSettings && showInput ? 'lg:grid-cols-[1fr_0.9fr]' : ''}`}>
        {showSettings ? (
        <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <h3 className="mb-3 font-bold text-slate-950">Daftar kategori</h3>
          <div className="space-y-3">
            {categories.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.period?.name} • Tingkat {(item.grades || []).map((grade) => grade.grade).sort().join(', ') || 'semua'} • {item.gender_scope === 'all' ? 'Semua JK' : item.gender_scope}
                    </p>
                  </div>
                  <p className="font-bold text-slate-950">{formatRupiah(item.amount)}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                    onClick={() => setCategoryForm({
                      ...item,
                      amount: item.amount,
                      grades: (item.grades || []).map((grade) => Number(grade.grade)),
                    })}
                  >
                    Edit
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" onClick={() => removeCategory(item.id)}>
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            ))}
            {!categories.length ? <p className="text-sm text-slate-500">Belum ada kategori tagihan.</p> : null}
          </div>
        </section>
        ) : null}

        {showInput ? <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <h3 className="mb-3 font-bold text-slate-950">Input pembayaran</h3>
          {isWalasScope && !profile?.assigned_class_id ? <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Akun walas belum memiliki kelas.</p> : null}
          <form onSubmit={submitPayment} className="space-y-3">
            <FormField label="Siswa">
              <select
                className={inputClass}
                value={paymentForm.student_id}
                onChange={(e) => {
                  const student = students.find((item) => item.id === e.target.value);
                  const currentCategory = categories.find((item) => item.id === paymentForm.charge_category_id);
                  const keepCategory = currentCategory && chargeAppliesToStudent(currentCategory, student);
                  setPaymentForm({
                    ...paymentForm,
                    student_id: e.target.value,
                    charge_category_id: keepCategory ? paymentForm.charge_category_id : '',
                    amount_paid: keepCategory ? paymentForm.amount_paid : '',
                  });
                }}
                required
              >
                <option value="">Pilih siswa</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.current_class?.name}</option>)}
              </select>
            </FormField>
            <FormField label="Kategori tagihan">
              <select
                className={inputClass}
                value={paymentForm.charge_category_id}
                disabled={!paymentForm.student_id}
                onChange={(e) => {
                  const category = categories.find((item) => item.id === e.target.value);
                  setPaymentForm({ ...paymentForm, charge_category_id: e.target.value, amount_paid: category?.amount || '' });
                }}
                required
              >
                <option value="">Pilih kategori sesuai siswa</option>
                {eligibleCategories.map((item) => <option key={item.id} value={item.id}>{item.name} - {formatRupiah(item.amount)}</option>)}
              </select>
            </FormField>
            {paymentForm.student_id && !eligibleCategories.length ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Belum ada tagihan yang cocok untuk siswa ini.</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nominal bayar">
                <input type="number" min="1" className={inputClass} value={paymentForm.amount_paid} onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })} required />
              </FormField>
              <FormField label="Tanggal">
                <input type="date" className={inputClass} value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Metode">
              <select
                className={inputClass}
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({
                  ...paymentForm,
                  payment_method: e.target.value,
                  note: e.target.value === 'dari_tabungan' && !paymentForm.note
                    ? categories.find((item) => item.id === paymentForm.charge_category_id)?.name
                      ? `Pembayaran tagihan ${categories.find((item) => item.id === paymentForm.charge_category_id)?.name} dari tabungan`
                      : 'Pembayaran tagihan dari tabungan'
                    : paymentForm.note,
                })}
              >
                <option value="tunai">Tunai</option>
                <option value="dari_tabungan">Dari tabungan aktif</option>
              </select>
            </FormField>
            <FormField label="Keterangan">
              <textarea className={inputClass} value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
            </FormField>
            <button disabled={saving || !paymentForm.student_id} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-glow disabled:opacity-50">
              <Receipt size={18} /> Simpan Pembayaran
            </button>
          </form>
        </section> : null}
      </div>

      {showInput ? <section className="rounded-[24px] bg-white p-4 shadow-soft">
        <h3 className="mb-3 font-bold text-slate-950">Riwayat pembayaran tagihan</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Siswa</th>
                <th className="px-3 py-2">Tagihan</th>
                <th className="px-3 py-2">Metode</th>
                <th className="px-3 py-2">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.slice(0, 20).map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatDateId(item.payment_date)}</td>
                  <td className="px-3 py-2">{item.student?.name}</td>
                  <td className="px-3 py-2">{item.category?.name}</td>
                  <td className="px-3 py-2">{item.payment_method === 'dari_tabungan' ? 'Dari tabungan' : 'Tunai'}</td>
                  <td className="px-3 py-2 font-semibold">{formatRupiah(item.amount_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section> : null}
    </div>
  );
}
