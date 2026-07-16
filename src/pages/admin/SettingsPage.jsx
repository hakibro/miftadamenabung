import { useEffect, useState } from "react";
import {
	BookOpen,
	CalendarRange,
	HandCoins,
	ImageUp,
	Settings as SettingsIcon,
	X,
} from "lucide-react";
import FormField from "../../components/FormField";
import Toast from "../../components/Toast";
import {
	getSettings,
	saveSettings,
	uploadLogo,
} from "../../services/settingsService";
import { useSettings } from "../../contexts/SettingsContext";
import PeriodsPage from "./PeriodsPage";
import ClassesPage from "./ClassesPage";
import PromotionPage from "./PromotionPage";
import ImportPage from "./ImportPage";
import ChargesPage from "./ChargesPage";

const defaultSettings = {
	app_name: "Sistem Keuangan Kelas",
	school_name: "",
	logo_url: "",
	active_period_format: "YYYY/YYYY",
	transaction_edit_rule: "same_day_for_walas",
	show_withdrawal: true,
};

export default function SettingsPage() {
	const { refreshSettings } = useSettings();
	const [settings, setSettings] = useState(defaultSettings);
	const [toast, setToast] = useState(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [uploadingLogo, setUploadingLogo] = useState(false);
	const [activeCategory, setActiveCategory] = useState(null);

	async function load() {
		setError("");
		setLoading(true);
		try {
			const current = await getSettings();
			setSettings(current || defaultSettings);
		} catch (err) {
			setError(err.message || "Gagal memuat data settings");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function submit(event) {
		event.preventDefault();
		await saveSettings(settings);
		await refreshSettings();
		setToast("Settings tersimpan");
	}

	async function handleLogoUpload(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		setUploadingLogo(true);
		try {
			const publicUrl = await uploadLogo(file);
			setSettings((current) => ({ ...current, logo_url: publicUrl }));
			setToast("Logo berhasil diupload. Klik Simpan Settings untuk menyimpan.");
		} catch (err) {
			setToast(err.message || "Gagal upload logo");
		} finally {
			setUploadingLogo(false);
		}
	}

	const inputClass =
		"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

	return (
		<div className="space-y-5">
			<Toast message={toast} onClose={() => setToast(null)} />
			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="grid gap-3 sm:grid-cols-3">
				<button
					onClick={() => setActiveCategory("app")}
					className="rounded-[24px] bg-white p-5 text-left shadow-soft">
					<SettingsIcon className="mb-3 text-brand-700" />
					<p className="font-bold text-slate-950">Aplikasi</p>
					<p className="text-sm text-slate-500">
						Nama sekolah, logo, aturan edit.
					</p>
				</button>
				<button
					onClick={() => setActiveCategory("charges")}
					className="rounded-[24px] bg-white p-5 text-left shadow-soft">
					<HandCoins className="mb-3 text-brand-700" />
					<p className="font-bold text-slate-950">Tagihan</p>
					<p className="text-sm text-slate-500">
						Buku, kegiatan, dan tagihan lain.
					</p>
				</button>
				<button
					onClick={() => setActiveCategory("initial")}
					className="rounded-[24px] bg-white p-5 text-left shadow-soft">
					<BookOpen className="mb-3 text-brand-700" />
					<p className="font-bold text-slate-950">Data Awal</p>
					<p className="text-sm text-slate-500">Tahun ajaran, rombel, kelas.</p>
				</button>
				<button
					onClick={() => setActiveCategory("new-year")}
					className="rounded-[24px] bg-white p-5 text-left shadow-soft">
					<CalendarRange className="mb-3 text-brand-700" />
					<p className="font-bold text-slate-950">Tahun Ajaran Baru</p>
					<p className="text-sm text-slate-500">
						Naik kelas, lulus, siswa baru.
					</p>
				</button>
			</div>

			{activeCategory ? (
				<div
					className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"
					onMouseDown={() => setActiveCategory(null)}>
					<div
						className="mx-auto max-w-6xl rounded-[28px] bg-[#f7f1ff] p-4 shadow-soft"
						onMouseDown={(event) => event.stopPropagation()}>
						<div className="mb-4 flex items-center justify-between gap-3">
							<h2 className="text-lg font-bold text-slate-950">
								{activeCategory === "app"
									? "Settings Aplikasi"
									: activeCategory === "charges"
										? "Settings Tagihan"
										: activeCategory === "initial"
											? "Setting Data Awal"
											: "Setting Tahun Ajaran Baru"}
							</h2>
							<button
								className="rounded-full bg-white p-2 text-slate-600 shadow-sm"
								onClick={() => setActiveCategory(null)}>
								<X size={18} />
							</button>
						</div>

						{activeCategory === "app" ? (
							<form
								onSubmit={submit}
								className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
								<div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
									{settings.logo_url ? (
										<img
											src={settings.logo_url}
											alt="Logo sekolah"
											className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain"
										/>
									) : (
										<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
											<ImageUp size={26} />
										</div>
									)}
									<div className="min-w-0 flex-1">
										<p className="text-sm font-semibold text-slate-800">
											Logo sekolah
										</p>
										<p className="text-xs text-slate-500">
											Gunakan PNG/JPG persegi agar tampil rapi.
										</p>
										<input
											className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
											type="file"
											accept="image/*"
											onChange={handleLogoUpload}
											disabled={uploadingLogo}
										/>
									</div>
								</div>
								<FormField label="Nama aplikasi">
									<input
										className={inputClass}
										value={settings.app_name || ""}
										onChange={(e) =>
											setSettings({ ...settings, app_name: e.target.value })
										}
									/>
								</FormField>
								<FormField label="Nama sekolah/lembaga">
									<input
										className={inputClass}
										value={settings.school_name || ""}
										onChange={(e) =>
											setSettings({ ...settings, school_name: e.target.value })
										}
									/>
								</FormField>
								<FormField label="URL logo">
									<input
										className={inputClass}
										value={settings.logo_url || ""}
										onChange={(e) =>
											setSettings({ ...settings, logo_url: e.target.value })
										}
										placeholder="https://..."
									/>
								</FormField>
								<FormField label="Aturan edit transaksi">
									<select
										className={inputClass}
										value={
											settings.transaction_edit_rule || "same_day_for_walas"
										}
										onChange={(e) =>
											setSettings({
												...settings,
												transaction_edit_rule: e.target.value,
											})
										}>
										<option value="same_day_for_walas">
											Walas hanya tanggal yang sama
										</option>
										<option value="admin_only">Admin saja</option>
									</select>
								</FormField>
								<FormField label="Tampilkan menu pengambilan (Tarik) di walas">
									<label className="inline-flex items-center gap-3 cursor-pointer">
										<input
											type="checkbox"
											checked={settings.show_withdrawal !== false}
											onChange={(e) =>
												setSettings({
													...settings,
													show_withdrawal: e.target.checked,
												})
											}
											className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
										/>
										<span className="text-sm text-slate-700">
											{settings.show_withdrawal !== false
												? "Ditampilkan"
												: "Disembunyikan"}
										</span>
									</label>
								</FormField>
								<button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:w-auto">
									Simpan Settings
								</button>
							</form>
						) : null}

						{activeCategory === "charges" ? (
							<ChargesPage mode="settings" embedded />
						) : null}

						{activeCategory === "initial" ? (
							<div className="space-y-5">
								<div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-soft">
									Setup awal aplikasi: buat tahun ajaran aktif, import siswa
									dengan format Excel saat ini, kelas akan otomatis dibuat jika
									data import berisi tingkat dan nama kelas. Setelah itu assign
									wali kelas secara manual.
								</div>
								<div className="rounded-2xl bg-white p-4 shadow-soft">
									<h3 className="mb-3 font-bold text-slate-950">
										1. Buat Tahun Ajaran
									</h3>
									<PeriodsPage />
								</div>
								<div className="rounded-2xl bg-white p-4 shadow-soft">
									<h3 className="mb-3 font-bold text-slate-950">
										2. Import Siswa
									</h3>
									<p className="mb-4 text-sm text-slate-500">
										Gunakan kolom name, nis, gender, grade/tingkat, class_name,
										note. Jika kelas belum ada, sistem membuatnya otomatis di
										tahun ajaran aktif.
									</p>
									<ImportPage />
								</div>
								<div className="rounded-2xl bg-white p-4 shadow-soft">
									<h3 className="mb-3 font-bold text-slate-950">
										3. Kelas dan Assign Wali Kelas
									</h3>
									<p className="mb-4 text-sm text-slate-500">
										Kelas opsional dibuat manual jika belum dibuat dari import
										siswa. Wali kelas dapat dipilih manual per rombel.
									</p>
									<ClassesPage />
								</div>
							</div>
						) : null}

						{activeCategory === "new-year" ? (
							<div className="space-y-5">
								<div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-soft">
									Buat tahun ajaran baru, rombel otomatis, proses siswa naik
									kelas, import siswa baru kelas 1, lalu assign wali kelas
									manual.
								</div>
								<PromotionPage />
							</div>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}
