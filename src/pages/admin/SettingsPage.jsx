import { useEffect, useState } from 'react';
import { BookOpen, CalendarRange, HandCoins, ImageUp, Receipt, Settings as SettingsIcon, X } from 'lucide-react';
import FormField from '../../components/FormField';
import Toast from '../../components/Toast';
import { getSettings, saveSettings, uploadLogo } from '../../services/settingsService';
import { listClassOptions, listPeriodOptions } from '../../services/masterDataService';
import { deleteLksBill, listLksBills, saveLksBill } from '../../services/financeService';
import DataTable from '../../components/DataTable';
import { formatRupiah } from '../../utils/formatters';
import { useSettings } from '../../contexts/SettingsContext';
import PeriodsPage from './PeriodsPage';
import ClassesPage from './ClassesPage';
import PromotionPage from './PromotionPage';

const defaultSettings = {
  app_name: 'Sistem Keuangan Kelas',
  school_name: '',
  logo_url: '',
  default_monthly_infaq: 10000,
  infaq_months_per_period: 12,
  active_period_format: 'YYYY/YYYY',
  transaction_edit_rule: 'same_day_for_walas',
};

export default function SettingsPage() {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState(defaultSettings);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [options, setOptions] = useState({ periods: [], classes: [] });
  const [bills, setBills] = useState([]);
  const [bill, setBill] = useState({ name: '', period_id: '', semester: '1', total_amount: '', due_date: '', note: '' });
  const [classAmounts, setClassAmounts] = useState({});

  async function load() {
    setError('');
    setLoading(true);
    try {
      const [current, periods, classes, billRows] = await Promise.all([getSettings(), listPeriodOptions(), listClassOptions(), listLksBills()]);
      setSettings(current || defaultSettings);
      setOptions({ periods, classes });
      setBills(billRows);
    } catch (err) {
      setError(err.message || 'Gagal memuat data settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    await saveSettings(settings);
    await refreshSettings();
    setToast('Settings tersimpan');
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const publicUrl = await uploadLogo(file);
      setSettings((current) => ({ ...current, logo_url: publicUrl }));
      setToast('Logo berhasil diupload. Klik Simpan Settings untuk menyimpan.');
    } catch (err) {
      setToast(err.message || 'Gagal upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function submitBill(event) {
    event.preventDefault();
    await saveLksBill({
      ...bill,
      semester: Number(bill.semester),
      total_amount: Number(bill.total_amount),
      class_id: null,
      due_date: bill.due_date || null,
      class_amounts: Object.entries(classAmounts).map(([class_id, amount]) => ({ class_id, amount })),
    });
    setBill({ name: '', period_id: '', semester: '1', total_amount: '', due_date: '', note: '' });
    setClassAmounts({});
    setToast('Tagihan LKS tersimpan');
    await load();
  }

  function editBill(row) {
    setBill({
      id: row.id,
      name: row.name || '',
      period_id: row.period_id || '',
      semester: String(row.semester || 1),
      total_amount: row.total_amount || '',
      due_date: row.due_date || '',
      note: row.note || '',
    });
    setClassAmounts(
      (row.class_amounts || []).reduce((acc, item) => {
        acc[item.class_id] = item.amount;
        return acc;
      }, {})
    );
  }

  function loadExistingBillForPeriodSemester(periodId, semester) {
    const existing = bills.find((item) => item.period_id === periodId && Number(item.semester || 1) === Number(semester || 1));
    if (!existing) return;
    editBill(existing);
  }

  function resetBillForm() {
    setBill({ name: '', period_id: '', semester: '1', total_amount: '', due_date: '', note: '' });
    setClassAmounts({});
  }

  async function removeBill(row) {
    if (!confirm(`Hapus tagihan LKS "${row.name}"?`)) return;
    try {
      await deleteLksBill(row.id);
      setToast('Tagihan LKS dihapus');
      if (bill.id === row.id) resetBillForm();
      await load();
    } catch (err) {
      setError(err.message || 'Gagal menghapus tagihan LKS');
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
  const selectedBill = bill.id ? bills.find((item) => item.id === bill.id) : null;
  const savedClassAmounts = selectedBill?.class_amounts || [];

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => setActiveCategory('app')} className="rounded-[24px] bg-white p-5 text-left shadow-soft">
          <SettingsIcon className="mb-3 text-brand-700" />
          <p className="font-bold text-slate-950">Aplikasi</p>
          <p className="text-sm text-slate-500">Nama sekolah, logo, aturan edit.</p>
        </button>
        <button onClick={() => setActiveCategory('infaq')} className="rounded-[24px] bg-white p-5 text-left shadow-soft">
          <HandCoins className="mb-3 text-brand-700" />
          <p className="font-bold text-slate-950">Infaq</p>
          <p className="text-sm text-slate-500">Nominal dan jumlah bulan.</p>
        </button>
        <button onClick={() => setActiveCategory('lks')} className="rounded-[24px] bg-white p-5 text-left shadow-soft">
          <Receipt className="mb-3 text-brand-700" />
          <p className="font-bold text-slate-950">LKS</p>
          <p className="text-sm text-slate-500">Tagihan, semester, nominal kelas.</p>
        </button>
        <button onClick={() => setActiveCategory('initial')} className="rounded-[24px] bg-white p-5 text-left shadow-soft">
          <BookOpen className="mb-3 text-brand-700" />
          <p className="font-bold text-slate-950">Data Awal</p>
          <p className="text-sm text-slate-500">Tahun ajaran, rombel, kelas.</p>
        </button>
        <button onClick={() => setActiveCategory('new-year')} className="rounded-[24px] bg-white p-5 text-left shadow-soft">
          <CalendarRange className="mb-3 text-brand-700" />
          <p className="font-bold text-slate-950">Tahun Ajaran Baru</p>
          <p className="text-sm text-slate-500">Naik kelas, lulus, siswa baru.</p>
        </button>
      </div>

      {activeCategory ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl rounded-[28px] bg-[#f7f1ff] p-4 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-950">{activeCategory === 'app' ? 'Settings Aplikasi' : activeCategory === 'infaq' ? 'Settings Infaq' : activeCategory === 'lks' ? 'Settings LKS' : activeCategory === 'initial' ? 'Setting Data Awal' : 'Setting Tahun Ajaran Baru'}</h2>
              <button className="rounded-full bg-white p-2 text-slate-600 shadow-sm" onClick={() => setActiveCategory(null)}><X size={18} /></button>
            </div>

      {activeCategory === 'app' ? <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Logo sekolah" className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ImageUp size={26} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Logo sekolah</p>
            <p className="text-xs text-slate-500">Gunakan PNG/JPG persegi agar tampil rapi.</p>
            <input className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
          </div>
        </div>
        <FormField label="Nama aplikasi"><input className={inputClass} value={settings.app_name || ''} onChange={(e) => setSettings({ ...settings, app_name: e.target.value })} /></FormField>
        <FormField label="Nama sekolah/lembaga"><input className={inputClass} value={settings.school_name || ''} onChange={(e) => setSettings({ ...settings, school_name: e.target.value })} /></FormField>
        <FormField label="URL logo"><input className={inputClass} value={settings.logo_url || ''} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} placeholder="https://..." /></FormField>
        <FormField label="Aturan edit transaksi"><select className={inputClass} value={settings.transaction_edit_rule || 'same_day_for_walas'} onChange={(e) => setSettings({ ...settings, transaction_edit_rule: e.target.value })}><option value="same_day_for_walas">Walas hanya tanggal yang sama</option><option value="admin_only">Admin saja</option></select></FormField>
        <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:w-auto">Simpan Settings</button>
      </form> : null}

      {activeCategory === 'infaq' ? <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <FormField label="Nominal default infaq bulanan"><input type="number" className={inputClass} value={settings.default_monthly_infaq || ''} onChange={(e) => setSettings({ ...settings, default_monthly_infaq: Number(e.target.value) })} /></FormField>
        <FormField label="Jumlah bulan infaq per tahun ajaran"><input type="number" className={inputClass} value={settings.infaq_months_per_period || 12} onChange={(e) => setSettings({ ...settings, infaq_months_per_period: Number(e.target.value) })} /></FormField>
        <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:w-auto">Simpan Settings Infaq</button>
      </form> : null}

      {activeCategory === 'lks' ? <div className="space-y-4">
        <form onSubmit={submitBill} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">{bill.id ? 'Edit Tagihan LKS' : 'Tagihan LKS'}</h2>
            {bill.id ? <button type="button" className="text-sm font-semibold text-slate-500 hover:text-brand-700" onClick={resetBillForm}>Batal edit</button> : null}
          </div>
          {loading ? <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">Memuat tahun ajaran dan kelas...</p> : null}
          {!loading && !options.periods.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Belum ada tahun ajaran. Tambahkan di Settings Data Awal.</p> : null}
          {!loading && !options.classes.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Belum ada kelas. Tambahkan di Settings Data Awal.</p> : null}
          <FormField label="Tahun ajaran"><select className={inputClass} value={bill.period_id} onChange={(e) => {
            const next = { ...bill, period_id: e.target.value };
            setBill(next);
            if (e.target.value) loadExistingBillForPeriodSemester(e.target.value, next.semester);
          }} required><option value="">Pilih tahun ajaran</option>{options.periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField>
          <FormField label="Semester"><select className={inputClass} value={bill.semester} onChange={(e) => {
            const next = { ...bill, semester: e.target.value };
            setBill(next);
            if (next.period_id) loadExistingBillForPeriodSemester(next.period_id, e.target.value);
          }} required><option value="1">Semester 1</option><option value="2">Semester 2</option></select></FormField>
          <FormField label="Nama/tagihan LKS"><input className={inputClass} value={bill.name} onChange={(e) => setBill({ ...bill, name: e.target.value })} required /></FormField>
          <FormField label="Nominal default tagihan"><input type="number" className={inputClass} value={bill.total_amount} onChange={(e) => setBill({ ...bill, total_amount: e.target.value })} required /></FormField>
          {savedClassAmounts.length ? (
            <div className="rounded-2xl bg-brand-50 p-3 sm:col-span-2">
              <p className="mb-2 text-sm font-bold text-brand-700">Nominal khusus tersimpan</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {savedClassAmounts.map((item) => (
                  <div key={item.id} className="rounded-xl bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-800">{item.class?.name || 'Kelas'}</p>
                    <p className="text-brand-700">{formatRupiah(item.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Nominal berbeda per kelas</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.classes.map((item) => (
                <label key={item.id} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">{item.name}</span>
                  <input
                    type="number"
                    className={inputClass}
                    placeholder={bill.total_amount ? `Default ${formatRupiah(bill.total_amount)}` : 'Ikuti default'}
                    value={classAmounts[item.id] || ''}
                    onChange={(e) => setClassAmounts({ ...classAmounts, [item.id]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Kosongkan kelas yang nominalnya sama dengan default.</p>
          </div>
          <FormField label="Jatuh tempo"><input type="date" className={inputClass} value={bill.due_date} onChange={(e) => setBill({ ...bill, due_date: e.target.value })} /></FormField>
          <FormField label="Keterangan"><textarea className={inputClass} value={bill.note} onChange={(e) => setBill({ ...bill, note: e.target.value })} /></FormField>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:col-span-2">{bill.id ? 'Update Tagihan' : 'Tambah Tagihan'}</button>
        </form>
        <DataTable
          rows={bills}
          columns={[
            { key: 'name', label: 'Tagihan' },
            { key: 'period', label: 'Tahun Ajaran', render: (row) => row.period?.name || '-' },
            { key: 'semester', label: 'Semester', render: (row) => `Semester ${row.semester || 1}` },
            { key: 'total_amount', label: 'Default', render: (row) => formatRupiah(row.total_amount) },
            { key: 'class_amounts', label: 'Nominal khusus', render: (row) => row.class_amounts?.length ? row.class_amounts.map((item) => `${item.class?.name}: ${formatRupiah(item.amount)}`).join(', ') : '-' },
          ]}
          actions={(row) => (
            <div className="flex justify-end gap-2">
              <button className="font-semibold text-brand-700" onClick={() => editBill(row)}>Edit</button>
              <button className="font-semibold text-red-600" onClick={() => removeBill(row)}>Hapus</button>
            </div>
          )}
        />
      </div> : null}

      {activeCategory === 'initial' ? <div className="space-y-5">
        <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-soft">
          Atur tahun ajaran berjalan, rombel, dan kelas. Tingkat SD/MI selalu 1 sampai 6; rombel bebas seperti 1A, 2A, 2B, atau 5B.
        </div>
        <PeriodsPage />
        <ClassesPage />
      </div> : null}

      {activeCategory === 'new-year' ? <div className="space-y-5">
        <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-soft">
          Buat tahun ajaran baru dan rombelnya di Data Awal terlebih dahulu. Setelah itu proses siswa naik kelas akan mempertahankan rombel: contoh 3A naik ke 4A. Siswa baru tingkat 1 ditambahkan lewat menu Siswa atau Import Excel.
        </div>
        <PromotionPage />
      </div> : null}

          </div>
        </div>
      ) : null}
    </div>
  );
}
