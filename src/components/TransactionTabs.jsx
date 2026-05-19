import { useEffect, useRef, useState } from "react";
import FormField from "./FormField";
import Toast from "./Toast";
import {
	createFullPeriodInfaq,
	createInfaqPayment,
	createLksPayment,
	createSavingsTransaction,
	getSavingsBalance,
	listInfaqPayments,
	listLksBills,
	listLksPayments,
	listSavingsTransactions,
	updateInfaqPayment,
	updateLksPayment,
	updateSavingsTransaction,
} from "../services/financeService";
import { todayISO, formatRupiah, formatDateId } from "../utils/formatters";
import { useSettings } from "../contexts/SettingsContext";

const tabs = [
	{ id: "savings", label: "Tabungan" },
	{ id: "infaq", label: "Infaq" },
	{ id: "lks", label: "LKS" },
];

export default function TransactionTabs({ student, method = "manual" }) {
	const { settings } = useSettings();
	const [active, setActive] = useState("savings");
	const [balance, setBalance] = useState(0);
	const [savingsRows, setSavingsRows] = useState([]);
	const [bills, setBills] = useState([]);
	const [infaqRows, setInfaqRows] = useState([]);
	const [lksRows, setLksRows] = useState([]);
	const [toast, setToast] = useState(null);
	const [error, setError] = useState(null);
	const amountRef = useRef(null);
	const formRef = useRef(null);
	const [savings, setSavings] = useState({
		type: "setor",
		amount: "",
		transaction_date: todayISO(),
		note: "",
	});
	const [editing, setEditing] = useState(null);
	const periodStartYear = student.current_class?.periods?.start_date
		? new Date(student.current_class.periods.start_date).getFullYear()
		: new Date().getFullYear();
	const periodName = student.current_class?.periods?.name || "Tahun ajaran aktif";
	const infaqMonths = settings?.infaq_months_per_period || 12;
	const monthlyInfaq = Number(settings?.default_monthly_infaq || 0);
	const [infaq, setInfaq] = useState({
		month: new Date().getMonth() + 1,
		amount: settings?.default_monthly_infaq || "",
		note: "",
		full_period: false,
	});
	const [lks, setLks] = useState({
		lks_bill_id: "",
		amount_paid: "",
		payment_date: todayISO(),
		payment_method: "tunai",
		note: "",
	});
	const selectedBill = bills.find((bill) => bill.id === lks.lks_bill_id);
	const classBillAmount = selectedBill?.class_amounts?.find(
		(item) =>
			item.class_id === (student.current_class_id || student.current_class?.id),
	);
	const suggestedLksAmount =
		classBillAmount?.amount || selectedBill?.total_amount || 0;
	const paidInfaqMonths = infaqRows.filter(
		(row) => row.status === "lunas",
	).length;
	const selectedInfaq = infaqRows.find(
		(row) => Number(row.month) === Number(infaq.month),
	);
	const unpaidInfaqMonths = Array.from(
		{ length: Number(infaqMonths || 12) },
		(_, index) => index + 1,
	).filter(
		(month) =>
			infaqRows.find((row) => Number(row.month) === month)?.status !== "lunas",
	);
	const fullPeriodTotal = unpaidInfaqMonths.length * monthlyInfaq;
	const lksPaidTotal = lksRows.reduce(
		(sum, row) => sum + Number(row.amount_paid || 0),
		0,
	);
	const selectedBillPayments = lksRows.filter(
		(row) => row.lks_bill_id === lks.lks_bill_id,
	);
	const selectedBillPaid = selectedBillPayments.reduce(
		(sum, row) => sum + Number(row.amount_paid || 0),
		0,
	);
	const selectedBillRemaining = Math.max(
		Number(suggestedLksAmount || 0) - selectedBillPaid,
		0,
	);
	const selectedInfaqIsLunas = selectedInfaq?.status === "lunas";
	const selectedBillIsLunas =
		Boolean(lks.lks_bill_id) &&
		selectedBillRemaining <= 0 &&
		selectedBillPaid > 0;
	const periodStartMonth = student.current_class?.periods?.start_date
		? new Date(student.current_class.periods.start_date).getMonth()
		: 0;
	const monthNames = Array.from({ length: Number(infaqMonths || 12) }, (_, index) => {
		const date = new Date(2026, periodStartMonth + index, 1);
		return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(date);
	});
	const inferInfaqStatus = (amount) => {
		const value = Number(amount || 0);
		if (value <= 0) return "belum_bayar";
		if (monthlyInfaq && value < monthlyInfaq) return "sebagian";
		return "lunas";
	};
	const inferLksStatus = (amount) => {
		const afterPayment = selectedBillPaid + Number(amount || 0);
		if (afterPayment <= 0) return "belum_bayar";
		if (suggestedLksAmount && afterPayment >= Number(suggestedLksAmount))
			return "lunas";
		return "sebagian";
	};

	async function refresh() {
		if (!student?.id) return;
		const [nextBalance, nextSavings, nextBills, nextInfaq, nextLks] =
			await Promise.all([
				getSavingsBalance(student.id),
				listSavingsTransactions({ studentId: student.id }),
				listLksBills({
					classId: student.current_class_id || student.current_class?.id,
				}),
				listInfaqPayments({
					studentId: student.id,
					periodId: student.current_class?.period_id,
				}),
				listLksPayments({ studentId: student.id }),
			]);
		setBalance(nextBalance);
		setSavingsRows(nextSavings);
		setBills(nextBills);
		setInfaqRows(nextInfaq);
		setLksRows(nextLks);
	}

	useEffect(() => {
		refresh();
	}, [student?.id]);
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
		try {
			const payload = {
				student_id: student.id,
				type: savings.type,
				amount: Number(savings.amount),
				transaction_date: savings.transaction_date,
				input_method: method,
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
		}
	}

	async function saveInfaq(event) {
		event.preventDefault();
		setError(null);
		try {
			if (infaq.full_period) {
				await createFullPeriodInfaq({
					student_id: student.id,
					period_id: student.current_class?.period_id,
					year: periodStartYear,
					monthly_amount:
						Number(infaq.amount) / Math.max(unpaidInfaqMonths.length, 1),
					months: unpaidInfaqMonths,
					months_count: infaqMonths,
					note: infaq.note,
				});
			} else {
				const payload = {
					student_id: student.id,
					period_id: student.current_class?.period_id,
					month: Number(infaq.month),
					year: periodStartYear,
					amount: Number(infaq.amount),
					status: inferInfaqStatus(infaq.amount),
					note: infaq.note,
				};
				if (editing?.type === "infaq")
					await updateInfaqPayment(editing.id, payload);
				else await createInfaqPayment(payload);
			}
			setInfaq({
				...infaq,
				amount: settings?.default_monthly_infaq || "",
				note: "",
				full_period: false,
			});
			setEditing(null);
			setToast("Pembayaran infaq tersimpan");
			await refresh();
		} catch (err) {
			setError(err.message);
		}
	}

	async function saveLks(event) {
		event.preventDefault();
		setError(null);
		try {
			const payload = {
				student_id: student.id,
				lks_bill_id: lks.lks_bill_id,
				amount_paid: Number(lks.amount_paid),
				payment_date: lks.payment_date,
				payment_method: lks.payment_method,
				status: inferLksStatus(lks.amount_paid),
				note: lks.note,
			};
			if (editing?.type === "lks") await updateLksPayment(editing.id, payload);
			else await createLksPayment(payload);
			setLks({ ...lks, amount_paid: "", note: "" });
			setEditing(null);
			setToast("Pembayaran LKS tersimpan");
			await refresh();
		} catch (err) {
			setError(err.message);
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
				{active === "infaq" ? (
					<>
						<p className="text-sm text-white/75">Status infaq {periodName}</p>
						<p className="mt-1 text-2xl font-bold">
							{paidInfaqMonths}/{infaqMonths} bulan lunas
						</p>
						<p className="mt-1 text-sm text-white/75">
							{monthNames[Number(infaq.month) - 1] || `Bulan ${infaq.month}`}:{" "}
							{selectedInfaq?.status
								? selectedInfaq.status.replace("_", " ")
								: "belum bayar"}
						</p>
					</>
				) : null}
				{active === "lks" ? (
					<>
						<p className="text-sm text-white/75">Status LKS siswa</p>
						<p className="mt-1 text-2xl font-bold">
							{formatRupiah(lksPaidTotal)} sudah dibayar
						</p>
						<p className="mt-1 text-sm text-white/75">
							{lks.lks_bill_id
								? `Sisa tagihan dipilih: ${formatRupiah(selectedBillRemaining)}`
								: "Pilih tagihan untuk melihat sisa pembayaran"}
						</p>
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
					<FormField label="Jenis transaksi">
						<select
							className={inputClass}
							value={savings.type}
							onChange={(e) =>
								setSavings({ ...savings, type: e.target.value })
							}>
							<option value="setor">Setor</option>
							<option value="tarik">Tarik</option>
						</select>
					</FormField>
					<FormField label="Nominal">
						<input
							ref={amountRef}
							type="number"
							min="1"
							className={inputClass}
							value={savings.amount}
							onChange={(e) =>
								setSavings({ ...savings, amount: e.target.value })
							}
							required
						/>
					</FormField>
					<FormField label="Tanggal">
						<input
							type="date"
							className={inputClass}
							value={savings.transaction_date}
							onChange={(e) =>
								setSavings({ ...savings, transaction_date: e.target.value })
							}
							required
						/>
					</FormField>
					<FormField label="Keterangan">
						<textarea
							className={inputClass}
							value={savings.note}
							onChange={(e) => setSavings({ ...savings, note: e.target.value })}
							placeholder="Contoh: dibayar oleh ibu"
						/>
					</FormField>
					<button className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white sm:col-span-2">
						{editing?.type === "savings"
							? "Update Tabungan"
							: "Simpan Tabungan"}
					</button>
				</form>
			) : null}

			{active === "infaq" ? (
				<form
					ref={formRef}
					onSubmit={saveInfaq}
					className="grid gap-4 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft sm:grid-cols-2">
					<div className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-700 sm:col-span-2">
						<p className="font-semibold">{periodName}</p>
						<p className="text-xs text-brand-700/75">
							Infaq dicatat berdasarkan tahun ajaran, bukan tahun kalender.
						</p>
					</div>
					<label className="flex items-center gap-2 text-sm sm:col-span-2">
						<input
							type="checkbox"
							checked={infaq.full_period}
							onChange={(e) =>
								setInfaq({
									...infaq,
									full_period: e.target.checked,
									amount: e.target.checked
										? fullPeriodTotal
										: settings?.default_monthly_infaq || "",
								})
							}
						/>{" "}
						Bayar penuh 1 tahun ajaran
					</label>
					{!infaq.full_period ? (
						<FormField label="Bulan">
							<select
								className={inputClass}
								value={infaq.month}
								onChange={(e) => setInfaq({ ...infaq, month: e.target.value })}>
								{monthNames.map((name, index) => (
									<option key={name} value={index + 1}>
										{name}
									</option>
								))}
							</select>
						</FormField>
					) : null}
					{infaq.full_period ? (
						<p className="text-sm text-slate-500 sm:col-span-2">
							Belum lunas: {unpaidInfaqMonths.length} bulan. Nominal otomatis:{" "}
							{formatRupiah(fullPeriodTotal)}.
						</p>
					) : null}
					<FormField
						label={infaq.full_period ? "Nominal total tahun ajaran" : "Nominal"}>
						<input
							ref={amountRef}
							type="number"
							min="1"
							className={inputClass}
							disabled={!editing && !infaq.full_period && selectedInfaqIsLunas}
							placeholder={
								infaq.full_period
									? String(fullPeriodTotal)
									: String(monthlyInfaq || "")
							}
							value={infaq.amount}
							onChange={(e) => setInfaq({ ...infaq, amount: e.target.value })}
							required
						/>
					</FormField>
					{!infaq.full_period ? (
						<p className="self-end text-sm text-slate-500">
							Status otomatis:{" "}
							{inferInfaqStatus(infaq.amount).replace("_", " ")}
						</p>
					) : null}
					<FormField label="Keterangan">
						<textarea
							className={inputClass}
							value={infaq.note}
							onChange={(e) => setInfaq({ ...infaq, note: e.target.value })}
						/>
					</FormField>
					{!editing && !infaq.full_period && selectedInfaqIsLunas ? (
						<p className="text-sm text-emerald-700 sm:col-span-2">
							Bulan ini sudah lunas. Gunakan Edit di history untuk koreksi.
						</p>
					) : null}
					<button
						disabled={!editing && !infaq.full_period && selectedInfaqIsLunas}
						className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">
						{editing?.type === "infaq" ? "Update Infaq" : "Simpan Infaq"}
					</button>
				</form>
			) : null}

			{active === "lks" ? (
				<form
					ref={formRef}
					onSubmit={saveLks}
					className="grid gap-4 rounded-[22px] border border-white/80 bg-white p-4 shadow-soft sm:grid-cols-2">
					<FormField label="Tagihan LKS">
						<select
							className={inputClass}
							value={lks.lks_bill_id}
							onChange={(e) =>
								setLks({
									...lks,
									lks_bill_id: e.target.value,
									amount_paid: e.target.value
										? String(
												Math.max(
													(bills
														.find((bill) => bill.id === e.target.value)
														?.class_amounts?.find(
															(item) =>
																item.class_id ===
																(student.current_class_id ||
																	student.current_class?.id),
														)?.amount ||
														bills.find((bill) => bill.id === e.target.value)
															?.total_amount ||
														0) -
														lksRows
															.filter(
																(row) => row.lks_bill_id === e.target.value,
															)
															.reduce(
																(sum, row) =>
																	sum + Number(row.amount_paid || 0),
																0,
															),
													0,
												),
											)
										: "",
								})
							}
							required>
							<option value="">Pilih tagihan</option>
							{bills.map((bill) => {
								const classAmount = bill.class_amounts?.find(
									(item) =>
										item.class_id ===
										(student.current_class_id || student.current_class?.id),
								);
								return (
									<option key={bill.id} value={bill.id}>
										{bill.name} (Semester {bill.semester || 1}) -{" "}
										{formatRupiah(classAmount?.amount || bill.total_amount)}
									</option>
								);
							})}
						</select>
					</FormField>
					{suggestedLksAmount ? (
						<p className="self-end text-sm text-slate-500">
							Tagihan: {formatRupiah(suggestedLksAmount)}
						</p>
					) : null}
					<FormField label="Nominal bayar">
						<input
							ref={amountRef}
							type="number"
							min="1"
							className={inputClass}
							disabled={!editing && !lks.lks_bill_id}
							value={lks.amount_paid}
							onChange={(e) => setLks({ ...lks, amount_paid: e.target.value })}
							required
						/>
					</FormField>
					<FormField label="Tanggal bayar">
						<input
							type="date"
							className={inputClass}
							value={lks.payment_date}
							onChange={(e) => setLks({ ...lks, payment_date: e.target.value })}
						/>
					</FormField>
					<FormField label="Metode">
						<select
							className={inputClass}
							value={lks.payment_method}
							onChange={(e) =>
								setLks({
									...lks,
									payment_method: e.target.value,
									note:
										e.target.value === "dari_tabungan" && !lks.note
											? "bayar LKS mengambil dari saldo tabungan"
											: lks.note,
								})
							}>
							<option value="tunai">Tunai</option>
							<option value="dari_tabungan">Dari tabungan</option>
						</select>
					</FormField>
					<p className="self-end text-sm text-slate-500">
						Status otomatis: {inferLksStatus(lks.amount_paid).replace("_", " ")}
					</p>
					<FormField label="Keterangan">
						<textarea
							className={inputClass}
							placeholder={
								lks.payment_method === "dari_tabungan"
									? "mengambil dari saldo tabungan"
									: ""
							}
							value={lks.note}
							onChange={(e) => setLks({ ...lks, note: e.target.value })}
						/>
					</FormField>
					{!editing && selectedBillIsLunas ? (
						<p className="text-sm text-emerald-700 sm:col-span-2">
							Tagihan ini sudah lunas. Gunakan Edit di history untuk koreksi.
						</p>
					) : null}
					<button
						disabled={!editing && selectedBillIsLunas}
						className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">
						{editing?.type === "lks" ? "Update LKS" : "Simpan LKS"}
					</button>
				</form>
			) : null}

			{active === "savings" ? (
				<HistoryList
					rows={savingsRows.slice(0, 8)}
					type="savings"
					onEdit={(row) => {
						setEditing({ type: "savings", id: row.id });
						setSavings({
							type: row.type,
							amount: row.amount,
							transaction_date: row.transaction_date,
							note: row.note || "",
						});
						focusInputSection();
					}}
				/>
			) : null}
			{active === "infaq" ? (
				<HistoryList
					rows={infaqRows.slice(0, 12)}
					type="infaq"
					monthNames={monthNames}
					onEdit={(row) => {
						setEditing({ type: "infaq", id: row.id });
						setInfaq({
							month: row.month,
							amount: row.amount,
							note: row.note || "",
							full_period: false,
						});
						focusInputSection();
					}}
				/>
			) : null}
			{active === "lks" ? (
				<HistoryList
					rows={lksRows.slice(0, 8)}
					type="lks"
					onEdit={(row) => {
						if (row.payment_method === "dari_tabungan") {
							setError(
								"Pembayaran LKS dari tabungan tidak diedit langsung agar saldo tetap konsisten. Buat koreksi transaksi baru atau hubungi admin.",
							);
							return;
						}
						setEditing({ type: "lks", id: row.id });
						setLks({
							lks_bill_id: row.lks_bill_id,
							amount_paid: row.amount_paid,
							payment_date: row.payment_date,
							payment_method: row.payment_method,
							note: row.note || "",
						});
						focusInputSection();
					}}
				/>
			) : null}
		</div>
	);
}

function HistoryList({ rows, type, onEdit, monthNames = [] }) {
	return (
		<section className="rounded-[22px] border border-white/80 bg-white p-4 shadow-soft">
			<h3 className="mb-3 font-bold text-slate-950">History</h3>
			<div className="space-y-3">
				{rows.length ? (
					rows.map((row) => (
						<div key={row.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="font-semibold text-slate-900">
										{historyTitle(row, type, monthNames)}
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
							<button
								className="mt-2 text-xs font-semibold text-brand-700"
								onClick={() => onEdit(row)}>
								Edit
							</button>
						</div>
					))
				) : (
					<p className="text-sm text-slate-500">Belum ada history.</p>
				)}
			</div>
		</section>
	);
}

function historyTitle(row, type, monthNames = []) {
	if (type === "savings")
		return row.type === "tarik" ? "Tarik tabungan" : "Setor tabungan";
	if (type === "infaq")
		return `Infaq ${monthNames[Number(row.month) - 1] || `bulan ${row.month}`} - ${row.status?.replace("_", " ") || "-"}`;
	return `${row.bill?.name || "Pembayaran LKS"} - ${row.status?.replace("_", " ") || "-"}`;
}

function historyDate(row, type) {
	if (type === "savings") return formatDateId(row.transaction_date);
	if (type === "lks") return formatDateId(row.payment_date);
	return row.period?.name || "-";
}
