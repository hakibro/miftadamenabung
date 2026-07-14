import { useEffect, useRef, useState } from "react";
import FormField from "./FormField";
import Toast from "./Toast";
import {
	createChargePayment,
	createSavingsTransaction,
	deleteChargePayment,
	deleteSavingsTransaction,
	getSavingsBalance,
	listChargeCategories,
	listChargePayments,
	listSavingsYearEndActions,
	listSavingsTransactions,
	updateChargePayment,
	updateSavingsTransaction,
} from "../services/financeService";
import {
	todayISO,
	formatRupiah,
	formatDateId,
	parseNumericInput,
} from "../utils/formatters";

const tabs = [
	{ id: "savings", label: "Tabungan" },
	{ id: "charge", label: "Tagihan" },
];

export default function TransactionTabs({ student, method = "manual" }) {
	const [active, setActive] = useState("savings");
	const [balance, setBalance] = useState(0);
	const [savingsRows, setSavingsRows] = useState([]);
	const [yearEndAction, setYearEndAction] = useState(null);
	const [chargeCategories, setChargeCategories] = useState([]);
	const [chargeRows, setChargeRows] = useState([]);
	const [toast, setToast] = useState(null);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);
	const amountRef = useRef(null);
	const formRef = useRef(null);
	const [savings, setSavings] = useState({
		type: "setor",
		amount: "",
		transaction_date: todayISO(),
		note: "",
	});
	const [editing, setEditing] = useState(null);
	const activePeriodId = student.current_class?.period_id;
	const savingsLocked = Boolean(yearEndAction);
	const savingsLockedMessage =
		"Tabungan siswa ini sudah diproses di Pengambilan Tabungan untuk tahun ajaran ini. Input tabungan dikunci karena akan masuk tahun ajaran berikutnya.";
	const [charge, setCharge] = useState({
		charge_category_id: "",
		amount_paid: "",
		payment_date: todayISO(),
		payment_method: "tunai",
		note: "",
	});
	function chargeAppliesToStudent(category) {
		if (!category) return false;
		const gradeSet = new Set(
			(category.grades || []).map((item) => Number(item.grade)),
		);
		if (category.period_id !== activePeriodId) return false;
		if (gradeSet.size && !gradeSet.has(Number(student.current_class?.grade)))
			return false;
		if (
			category.gender_scope !== "all" &&
			student.gender !== category.gender_scope
		)
			return false;
		return true;
	}
	const eligibleChargeCategories = chargeCategories.filter(
		chargeAppliesToStudent,
	);
	const selectedCharge = eligibleChargeCategories.find(
		(item) => item.id === charge.charge_category_id,
	);
	const chargeSummaries = eligibleChargeCategories.map((category) => {
		const paid = chargeRows
			.filter((row) => row.charge_category_id === category.id)
			.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
		return {
			...category,
			paid,
			remaining: Math.max(Number(category.amount || 0) - paid, 0),
		};
	});
	const selectedChargePayments = chargeRows.filter(
		(row) => row.charge_category_id === charge.charge_category_id,
	);
	const selectedChargePaid = selectedChargePayments.reduce(
		(sum, row) => sum + Number(row.amount_paid || 0),
		0,
	);
	const selectedChargeRemaining = Math.max(
		Number(selectedCharge?.amount || 0) - selectedChargePaid,
		0,
	);
	const editingChargeOriginalAmount =
		editing?.type === "charge" &&
		editing.charge_category_id === charge.charge_category_id
			? Number(editing.originalAmount || 0)
			: 0;
	const chargeAvailableToPay =
		selectedChargeRemaining + editingChargeOriginalAmount;
	const selectedChargeIsPaid =
		Boolean(selectedCharge) && chargeAvailableToPay <= 0;
	const chargeAmountValue = Number(charge.amount_paid || 0);
	const chargeAmountInvalid =
		Boolean(selectedCharge) &&
		(chargeAmountValue <= 0 ||
			chargeAmountValue > chargeAvailableToPay ||
			(selectedCharge.allow_installments === false &&
				chargeAmountValue !== chargeAvailableToPay));
	async function refresh() {
		if (!student?.id) return;
		const [
			nextBalance,
			nextSavings,
			nextYearEndActions,
			nextCharges,
			nextChargeRows,
		] = await Promise.all([
			getSavingsBalance(student.id, activePeriodId),
			listSavingsTransactions({
				studentId: student.id,
				periodId: activePeriodId,
			}),
			activePeriodId
				? listSavingsYearEndActions({
						studentId: student.id,
						periodId: activePeriodId,
					})
				: Promise.resolve([]),
			listChargeCategories({ periodId: activePeriodId }),
			listChargePayments({ studentId: student.id, periodId: activePeriodId }),
		]);
		setBalance(nextBalance);
		setSavingsRows(nextSavings);
		setYearEndAction(nextYearEndActions[0] || null);
		setChargeCategories(nextCharges);
		setChargeRows(nextChargeRows);
	}

	useEffect(() => {
		refresh();
	}, [student?.id, activePeriodId]);
	useEffect(() => {
		amountRef.current?.focus();
	}, [active, student?.id]);

	function focusInputSection() {
		setTimeout(() => {
			formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
			amountRef.current?.focus();
		}, 0);
	}

	async function saveSavings(event) {
		event.preventDefault();
		setError(null);
		if (savingsLocked) {
			setError(savingsLockedMessage);
			return;
		}
		setSaving(true);
		try {
			const payload = {
				student_id: student.id,
				period_id: activePeriodId,
				type: savings.type,
				amount: Number(savings.amount),
				transaction_date: savings.transaction_date,
				input_method: method,
				category: "manual",
				note: savings.note,
			};
			if (editing?.type === "savings")
				await updateSavingsTransaction(editing.id, payload);
			else await createSavingsTransaction(payload);
			setSavings({
				type: "setor",
				amount: "",
				transaction_date: todayISO(),
				note: "",
			});
			setEditing(null);
			setToast("Transaksi tabungan tersimpan");
			await refresh();
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	async function saveCharge(event) {
		event.preventDefault();
		setError(null);
		setSaving(true);
		try {
			if (!selectedCharge) throw new Error("Pilih tagihan terlebih dahulu");
			if (selectedChargeIsPaid && editing?.type !== "charge")
				throw new Error("Tagihan ini sudah lunas");
			if (chargeAmountInvalid) {
				throw new Error(
					selectedCharge.allow_installments === false
						? "Tagihan ini harus dibayar lunas sesuai sisa tagihan"
						: "Nominal bayar harus lebih dari 0 dan tidak boleh melebihi sisa tagihan",
				);
			}
			const defaultSavingsNote = selectedCharge?.name
				? `Pembayaran tagihan ${selectedCharge.name} dari tabungan`
				: "Pembayaran tagihan dari tabungan";
			const payload = {
				student_id: student.id,
				charge_category_id: charge.charge_category_id,
				amount_paid: Number(charge.amount_paid),
				payment_date: charge.payment_date,
				payment_method: charge.payment_method,
				note:
					charge.payment_method === "dari_tabungan"
						? charge.note || defaultSavingsNote
						: charge.note,
			};
			if (editing?.type === "charge")
				await updateChargePayment(editing.id, payload);
			else await createChargePayment(payload);
			setCharge({ ...charge, amount_paid: "", note: "" });
			setEditing(null);
			setToast("Pembayaran tagihan tersimpan");
			await refresh();
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	}

	const inputClass =
		"w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

	return (
		<div className="space-y-4">
			<Toast message={toast} onClose={() => setToast(null)} />
			<div className="flex rounded-2xl border border-white/80 bg-white p-1 shadow-soft">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActive(tab.id)}
						className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${active === tab.id ? "bg-brand-600 text-white shadow-glow" : "text-slate-600 hover:bg-brand-50"}`}>
						{tab.label}
					</button>
				))}
			</div>
			<div className="rounded-[24px] bg-gradient-to-br from-brand-700 via-brand-600 to-[#8f28ff] p-4 text-white shadow-glow">
				{active === "savings" ? (
					<>
						<p className="text-sm text-white/75">Saldo tabungan siswa</p>
						<p className="mt-1 text-3xl font-bold">{formatRupiah(balance)}</p>
					</>
				) : null}
				{active === "charge" ? (
					<>
						<p className="text-sm text-white/75">Status tagihan siswa</p>
						<div className="mt-3 space-y-2">
							{chargeSummaries.length ? (
								chargeSummaries.map((item) => (
									<div
										key={item.id}
										className="rounded-2xl bg-white/10 p-3 backdrop-blur">
										<div className="flex items-start justify-between gap-3">
											<p className="text-sm font-semibold">{item.name}</p>
											<p className="shrink-0 text-sm font-bold">
												{formatRupiah(item.remaining)}
											</p>
										</div>
										<p className="mt-1 text-xs text-white/75">
											Sudah bayar {formatRupiah(item.paid)} dari{" "}
											{formatRupiah(item.amount)}
										</p>
									</div>
								))
							) : (
								<p className="text-sm text-white/75">
									Belum ada tagihan yang berlaku untuk siswa ini
								</p>
							)}
						</div>
					</>
				) : null}
			</div>
			{error ? (
				<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{active === "savings" ? (
				<form
					ref={formRef}
					onSubmit={saveSavings}
					className="grid gap-4 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft sm:grid-cols-2">
					{savingsLocked ? (
						<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
							<p className="font-semibold">
								Tabungan tahun ajaran ini sudah dikunci.
							</p>
							<p className="mt-1 text-xs">
								Aksi pengambilan:{" "}
								{yearEndAction?.action === "withdrawn"
									? "diambil"
									: yearEndAction?.action === "saved"
										? "saldo disimpan"
										: "diproses"}
								. Gunakan tahun ajaran baru untuk input tabungan berikutnya.
							</p>
						</div>
					) : null}
					{/* Nominal — large, prominen, auto-focus */}
					<div className="sm:col-span-2">
						<label className="mb-1.5 block text-sm font-medium text-slate-700">
							Nominal
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
								Rp
							</span>
							<input
								ref={amountRef}
								type="text"
								inputMode="numeric"
								autoComplete="off"
								disabled={savingsLocked}
								value={
									savings.amount
										? Number(savings.amount).toLocaleString("id-ID")
										: ""
								}
								onChange={(e) =>
									setSavings({
										...savings,
										amount: parseNumericInput(e.target.value),
									})
								}
								className="h-16 w-full rounded-2xl border-2 border-slate-200 bg-white pl-16 pr-6 text-right text-2xl font-bold text-slate-900 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:opacity-50"
								placeholder="0"
								required
							/>
						</div>
						{savings.amount && Number(savings.amount) > 0 ? (
							<p className="mt-2 text-right text-lg font-semibold text-brand-600">
								{formatRupiah(savings.amount)}
							</p>
						) : null}
						{/* Quick-amount chips */}
						{!savingsLocked ? (
							<div className="mt-3 flex flex-wrap gap-2">
								{[5000, 10000, 20000, 50000].map((n) => (
									<button
										key={n}
										type="button"
										onClick={() =>
											setSavings({ ...savings, amount: String(n) })
										}
										className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all duration-150 ${
											savings.amount === String(n)
												? "border-brand-500 bg-brand-50 text-brand-700"
												: "border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600"
										}`}>
										{formatRupiah(n)}
									</button>
								))}
							</div>
						) : null}
					</div>
					<div className="border-t border-slate-100 pt-4 sm:col-span-2" />
					<FormField label="Jenis transaksi">
						<select
							className={inputClass}
							disabled={savingsLocked}
							value={savings.type}
							onChange={(e) =>
								setSavings({ ...savings, type: e.target.value })
							}>
							<option value="setor">Setor</option>
							<option value="tarik">Tarik</option>
						</select>
					</FormField>
					<FormField label="Tanggal">
						<input
							type="date"
							className={inputClass}
							disabled={savingsLocked}
							value={savings.transaction_date}
							onChange={(e) =>
								setSavings({ ...savings, transaction_date: e.target.value })
							}
							required
						/>
					</FormField>
					<FormField label="Keterangan">
						<textarea
							className={inputClass + " resize-none"}
							disabled={savingsLocked}
							value={savings.note}
							onChange={(e) => setSavings({ ...savings, note: e.target.value })}
							placeholder="Contoh: dibayar oleh ibu"
						/>
					</FormField>
					<button
						disabled={savingsLocked || saving}
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-glow transition-all duration-200 hover:brightness-110 disabled:opacity-50 sm:col-span-2">
						{saving ? (
							<>
								<svg
									className="h-5 w-5 animate-spin"
									viewBox="0 0 24 24"
									fill="none">
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
									/>
								</svg>
								Menyimpan...
							</>
						) : savingsLocked ? (
							"Tabungan Dikunci"
						) : editing?.type === "savings" ? (
							"Update Tabungan"
						) : (
							"Simpan Tabungan"
						)}
					</button>
				</form>
			) : null}

			{active === "charge" ? (
				<form
					ref={formRef}
					onSubmit={saveCharge}
					className="grid gap-4 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft sm:grid-cols-2">
					<FormField label="Tagihan">
						<select
							className={inputClass}
							value={charge.charge_category_id}
							onChange={(e) => {
								const category = eligibleChargeCategories.find(
									(item) => item.id === e.target.value,
								);
								const paid = chargeRows
									.filter((row) => row.charge_category_id === e.target.value)
									.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
								const remaining = Math.max(
									Number(category?.amount || 0) - paid,
									0,
								);
								setCharge({
									...charge,
									charge_category_id: e.target.value,
									amount_paid: e.target.value ? String(remaining) : "",
								});
							}}
							required>
							<option value="">Pilih tagihan</option>
							{chargeSummaries.map((item) => (
								<option
									key={item.id}
									value={item.id}
									disabled={
										item.remaining <= 0 &&
										editing?.charge_category_id !== item.id
									}>
									{item.name} -{" "}
									{item.remaining <= 0 ? "Lunas" : formatRupiah(item.remaining)}
								</option>
							))}
						</select>
					</FormField>
					{selectedCharge ? (
						<p className="self-end text-sm text-slate-500">
							Tagihan: {formatRupiah(selectedCharge.amount)}
						</p>
					) : null}
					{!eligibleChargeCategories.length ? (
						<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
							Belum ada tagihan yang berlaku untuk siswa ini.
						</p>
					) : null}
					{/* Nominal bayar — large & prominen */}
					<div className="sm:col-span-2">
						<label className="mb-1.5 block text-sm font-medium text-slate-700">
							Nominal bayar
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
								Rp
							</span>
							<input
								ref={amountRef}
								type="text"
								inputMode="numeric"
								autoComplete="off"
								disabled={
									selectedChargeIsPaid ||
									(!editing && !charge.charge_category_id)
								}
								value={
									charge.amount_paid
										? Number(charge.amount_paid).toLocaleString("id-ID")
										: ""
								}
								onChange={(e) =>
									setCharge({
										...charge,
										amount_paid: parseNumericInput(e.target.value),
									})
								}
								className={`h-16 w-full rounded-2xl border-2 bg-white pl-16 pr-6 text-right text-2xl font-bold outline-none transition-all duration-200 focus:ring-4 disabled:opacity-50 ${
									chargeAmountInvalid
										? "border-red-400 focus:border-red-500 focus:ring-red-100"
										: "border-slate-200 focus:border-brand-500 focus:ring-brand-100"
								}`}
								placeholder="0"
								required
							/>
						</div>
						<div className="mt-2 flex items-center justify-between gap-3">
							{selectedCharge &&
							charge.amount_paid &&
							Number(charge.amount_paid) > 0 ? (
								<p className="text-lg font-semibold text-brand-600">
									{formatRupiah(charge.amount_paid)}
								</p>
							) : (
								<span />
							)}
							{selectedCharge ? (
								<p
									className={`text-right text-sm ${
										chargeAmountInvalid
											? "font-semibold text-red-600"
											: "text-slate-500"
									}`}>
									{selectedCharge.allow_installments === false
										? `Harus lunas: ${formatRupiah(chargeAvailableToPay)}`
										: `Maks: ${formatRupiah(chargeAvailableToPay)}`}
								</p>
							) : null}
						</div>
					</div>
					<div className="border-t border-slate-100 pt-4 sm:col-span-2" />
					<FormField label="Tanggal bayar">
						<input
							type="date"
							className={inputClass}
							value={charge.payment_date}
							onChange={(e) =>
								setCharge({ ...charge, payment_date: e.target.value })
							}
						/>
					</FormField>
					<FormField label="Metode">
						<select
							className={inputClass}
							disabled={editing?.type === "charge"}
							value={charge.payment_method}
							onChange={(e) =>
								setCharge({
									...charge,
									payment_method: e.target.value,
									note:
										e.target.value === "dari_tabungan" && !charge.note
											? selectedCharge?.name
												? `Pembayaran tagihan ${selectedCharge.name} dari tabungan`
												: "Pembayaran tagihan dari tabungan"
											: charge.note,
								})
							}>
							<option value="tunai">Tunai</option>
							<option value="dari_tabungan">Dari tabungan</option>
						</select>
					</FormField>
					<p className="self-end text-sm text-slate-500">
						Sisa setelah bayar:{" "}
						{formatRupiah(
							Math.max(
								chargeAvailableToPay - Number(charge.amount_paid || 0),
								0,
							),
						)}
					</p>
					<FormField label="Keterangan">
						<textarea
							className={inputClass + " resize-none"}
							placeholder={
								charge.payment_method === "dari_tabungan"
									? selectedCharge?.name
										? `Pembayaran tagihan ${selectedCharge.name} dari tabungan`
										: "Pembayaran tagihan dari tabungan"
									: ""
							}
							value={charge.note}
							onChange={(e) => setCharge({ ...charge, note: e.target.value })}
						/>
					</FormField>
					<button
						disabled={
							saving ||
							chargeAmountInvalid ||
							selectedChargeIsPaid ||
							(!editing && !charge.charge_category_id)
						}
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-glow transition-all duration-200 hover:brightness-110 disabled:opacity-50 sm:col-span-2">
						{saving ? (
							<>
								<svg
									className="h-5 w-5 animate-spin"
									viewBox="0 0 24 24"
									fill="none">
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
									/>
								</svg>
								Menyimpan...
							</>
						) : selectedChargeIsPaid ? (
							"Tagihan Lunas"
						) : editing?.type === "charge" ? (
							"Update Tagihan"
						) : (
							"Simpan Tagihan"
						)}
					</button>
				</form>
			) : null}

			{active === "savings" ? (
				<HistoryList
					rows={savingsRows}
					type="savings"
					onEdit={(row) => {
						if (savingsLocked) {
							setError(savingsLockedMessage);
							return;
						}
						const chargePayment = Array.isArray(row.charge_payment)
							? row.charge_payment[0]
							: row.charge_payment;
						if (chargePayment?.id) {
							setError(
								"Transaksi tarik tabungan ini berasal dari pembayaran tagihan, jadi tidak bisa diedit langsung. Silakan koreksi pembayaran tagihan atau hubungi admin.",
							);
							return;
						}
						setEditing({ type: "savings", id: row.id });
						setSavings({
							type: row.type,
							amount: row.amount,
							transaction_date: row.transaction_date,
							note: row.note || "",
						});
						focusInputSection();
					}}
					onDelete={async (row) => {
						if (savingsLocked) {
							setError(savingsLockedMessage);
							return;
						}
						const chargePayment = Array.isArray(row.charge_payment)
							? row.charge_payment[0]
							: row.charge_payment;
						if (chargePayment?.id) {
							setError(
								"Transaksi tarik tabungan ini berasal dari pembayaran tagihan, tidak bisa dihapus langsung. Koreksi pembayaran tagihan atau hubungi admin.",
							);
							return;
						}
						if (!window.confirm("Hapus transaksi tabungan ini?")) return;
						setError(null);
						try {
							await deleteSavingsTransaction(row.id);
							setToast("Transaksi tabungan dihapus");
							await refresh();
						} catch (err) {
							setError(err.message);
						}
					}}
				/>
			) : null}
			{active === "charge" ? (
				<HistoryList
					rows={chargeRows}
					type="charge"
					onEdit={(row) => {
						if (row.savings_transaction_id) {
							setError(
								"Pembayaran tagihan dari tabungan tidak diedit langsung agar saldo tetap konsisten. Buat koreksi transaksi baru atau hubungi admin.",
							);
							return;
						}
						setEditing({
							type: "charge",
							id: row.id,
							originalAmount: row.amount_paid,
							charge_category_id: row.charge_category_id,
						});
						setCharge({
							charge_category_id: row.charge_category_id,
							amount_paid: row.amount_paid,
							payment_date: row.payment_date,
							payment_method: row.payment_method,
							note: row.note || "",
						});
						focusInputSection();
					}}
					onDelete={async (row) => {
						const msg = row.savings_transaction_id
							? "Pembayaran tagihan ini dari tabungan. Hapus juga akan mengembalikan saldo tabungan. Lanjutkan?"
							: "Hapus pembayaran tagihan ini?";
						if (!window.confirm(msg)) return;
						setError(null);
						try {
							await deleteChargePayment(row.id);
							setToast("Pembayaran tagihan dihapus");
							await refresh();
						} catch (err) {
							setError(err.message);
						}
					}}
				/>
			) : null}
		</div>
	);
}

function HistoryList({ rows, type, onEdit, onDelete }) {
	const [page, setPage] = useState(1);
	const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
	const pageSize = 5;
	const filteredRows = rows.filter((row) => {
		const date = historyRawDate(row, type);
		if (dateFilter.start && date < dateFilter.start) return false;
		if (dateFilter.end && date > dateFilter.end) return false;
		return true;
	});
	const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
	const currentPage = Math.min(page, totalPages);
	const pagedRows = filteredRows.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize,
	);

	return (
		<section className="rounded-[22px] border border-white/80 bg-white p-4 shadow-soft">
			<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h3 className="font-bold text-slate-950">History</h3>
				<div className="grid gap-2 sm:grid-cols-2">
					<input
						type="date"
						className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
						value={dateFilter.start}
						onChange={(e) => {
							setDateFilter({ ...dateFilter, start: e.target.value });
							setPage(1);
						}}
					/>
					<input
						type="date"
						className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
						value={dateFilter.end}
						onChange={(e) => {
							setDateFilter({ ...dateFilter, end: e.target.value });
							setPage(1);
						}}
					/>
				</div>
			</div>
			<div className="space-y-3">
				{pagedRows.length ? (
					pagedRows.map((row) => (
						<div key={row.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="font-semibold text-slate-900">
										{historyTitle(row, type)}
									</p>
									<p className="text-xs text-slate-500">
										{historyDate(row, type)}
									</p>
								</div>
								<p className="shrink-0 font-bold text-slate-950">
									{formatRupiah(row.amount || row.amount_paid || 0)}
								</p>
							</div>
							<p className="mt-2 text-xs text-slate-500">
								{row.note || "Tanpa keterangan"}
							</p>
							{type === "savings" && getLinkedChargePayment(row)?.id ? (
								<p className="mt-2 text-xs font-semibold text-amber-700">
									Terkunci: pembayaran tagihan{" "}
									{getLinkedChargePayment(row)?.category?.name || ""}
								</p>
							) : (
								<div className="mt-2 flex gap-2">
									<button
										className="text-xs font-semibold text-brand-700"
										onClick={() => onEdit(row)}>
										Edit
									</button>
									<button
										className="text-xs font-semibold text-red-600"
										onClick={() => onDelete(row)}>
										Hapus
									</button>
								</div>
							)}
						</div>
					))
				) : (
					<p className="text-sm text-slate-500">Belum ada history.</p>
				)}
			</div>
			{filteredRows.length > pageSize ? (
				<div className="mt-4 flex items-center justify-between gap-3 text-sm">
					<button
						className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40"
						disabled={currentPage <= 1}
						onClick={() => setPage(currentPage - 1)}>
						Sebelumnya
					</button>
					<span className="text-slate-500">
						Halaman {currentPage}/{totalPages}
					</span>
					<button
						className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40"
						disabled={currentPage >= totalPages}
						onClick={() => setPage(currentPage + 1)}>
						Berikutnya
					</button>
				</div>
			) : null}
		</section>
	);
}

function getLinkedChargePayment(row) {
	return Array.isArray(row.charge_payment)
		? row.charge_payment[0]
		: row.charge_payment;
}

function historyTitle(row, type) {
	if (type === "savings")
		return row.type === "tarik" ? "Tarik tabungan" : "Setor tabungan";
	if (type === "charge") return row.category?.name || "Pembayaran tagihan";
	return "Pembayaran";
}

function historyDate(row, type) {
	if (type === "savings") return formatDateId(row.transaction_date);
	if (type === "charge") return formatDateId(row.payment_date);
	return row.period?.name || formatDateId(row.created_at) || "-";
}

function historyRawDate(row, type) {
	if (type === "savings") return row.transaction_date || "";
	if (type === "charge") return row.payment_date || "";
	return row.created_at?.slice(0, 10) || "";
}
