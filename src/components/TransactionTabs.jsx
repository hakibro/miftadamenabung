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
	const [charge, setCharge] = useState({
		charge_category_id: "",
		amount_paid: "",
		payment_date: todayISO(),
		payment_method: "tunai",
		note: "",
	});
	const [showChargeModal, setShowChargeModal] = useState(false);
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
			setShowChargeModal(false);
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
			{active === "savings" ? (
				<div className="rounded-[24px] bg-gradient-to-br from-brand-700 via-brand-600 to-[#8f28ff] p-4 text-white shadow-glow sm:p-5">
					<>
						<p className="text-xs text-white/75 sm:text-sm">
							Saldo tabungan siswa
						</p>
						<p className="mt-1 text-2xl font-bold sm:text-3xl">
							{formatRupiah(balance)}
						</p>
					</>
				</div>
			) : null}
			{error ? (
				<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{active === "savings" ? (
				<form
					ref={formRef}
					onSubmit={saveSavings}
					className="grid gap-3 rounded-[22px] border border-white/80 bg-white p-3 shadow-soft sm:gap-4 sm:p-5">
					{/* Jenis transaksi — pill toggle */}
					<div className="sm:col-span-2">
						<label className="mb-1.5 block text-xs font-medium text-slate-500 sm:text-sm">
							Jenis transaksi
						</label>
						<div className="flex rounded-xl border-2 border-slate-200 bg-slate-50 p-1">
							<button
								type="button"
								onClick={() => setSavings({ ...savings, type: "setor" })}
								className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
									savings.type === "setor"
										? "bg-emerald-500 text-white shadow-sm"
										: "text-slate-500 hover:text-slate-700"
								}`}>
								<span className="inline-flex items-center gap-1.5">
									<svg
										className="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2.5}>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12 4.5v15m7.5-7.5h-15"
										/>
									</svg>
									Setor
								</span>
							</button>
							<button
								type="button"
								onClick={() => setSavings({ ...savings, type: "tarik" })}
								className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
									savings.type === "tarik"
										? "bg-rose-500 text-white shadow-sm"
										: "text-slate-500 hover:text-slate-700"
								}`}>
								<span className="inline-flex items-center gap-1.5">
									<svg
										className="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2.5}>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M5 12h14"
										/>
									</svg>
									Tarik
								</span>
							</button>
						</div>
					</div>

					{/* Nominal — full-width, prominent */}
					<div className="sm:col-span-2">
						<label className="mb-1.5 block text-xs font-medium text-slate-500 sm:text-sm">
							Nominal
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 sm:left-4 sm:text-2xl">
								Rp
							</span>
							<input
								ref={amountRef}
								type="text"
								inputMode="numeric"
								autoComplete="off"
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
								className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white pl-10 pr-4 text-right text-lg font-bold text-slate-900 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 sm:h-16 sm:pl-16 sm:pr-6 sm:text-2xl"
								placeholder="0"
								required
							/>
						</div>
					</div>

					{/* Tanggal */}
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

					{/* Keterangan */}
					<FormField label="Keterangan">
						<textarea
							className={inputClass + " resize-none"}
							rows={2}
							value={savings.note}
							onChange={(e) => setSavings({ ...savings, note: e.target.value })}
							placeholder="Contoh: dibayar oleh ibu"
						/>
					</FormField>

					{/* Submit */}
					<button
						disabled={saving}
						className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:brightness-110 disabled:opacity-50 sm:col-span-2 sm:text-base ${
							savings.type === "tarik" ? "bg-rose-500" : "bg-emerald-500"
						}`}>
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
						) : editing?.type === "savings" ? (
							"Update Tabungan"
						) : savings.type === "tarik" ? (
							"Simpan Penarikan"
						) : (
							"Simpan Setoran"
						)}
					</button>
				</form>
			) : null}

			{active === "charge" ? (
				<>
					{/* Tagihan — card-based picker with Bayar button */}
					<div className="rounded-[22px] border border-white/80 bg-white p-4 shadow-soft">
						<label className="mb-2 block text-sm font-medium text-slate-700">
							Pilih tagihan
						</label>
						{!eligibleChargeCategories.length ? (
							<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
								Belum ada tagihan yang berlaku untuk siswa ini.
							</p>
						) : (
							<div className="grid gap-2.5">
								{chargeSummaries.map((item) => {
									const progressPct =
										item.amount > 0
											? Math.round((item.paid / item.amount) * 100)
											: 0;
									const isLunas = item.remaining <= 0;
									return (
										<div
											key={item.id}
											className={`relative flex items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-200 ${
												isLunas
													? "border-emerald-200 bg-emerald-50 opacity-70"
													: "border-slate-200 bg-white"
											}`}>
											<div className="min-w-0 flex-1">
												<div className="flex items-center justify-between gap-2">
													<p
														className={`font-semibold ${isLunas ? "text-emerald-700" : "text-slate-900"}`}>
														{item.name}
													</p>
													<p
														className={`shrink-0 text-sm font-bold ${isLunas ? "text-emerald-600" : "text-slate-500"}`}>
														{isLunas ? (
															<span className="flex items-center gap-1">
																<svg
																	className="h-4 w-4"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																	strokeWidth={2.5}>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		d="M4.5 12.75l6 6 9-13.5"
																	/>
																</svg>
																Lunas
															</span>
														) : (
															"Sisa " + formatRupiah(item.remaining)
														)}
													</p>
												</div>
												{/* Progress bar */}
												<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
													<div
														className={`h-full rounded-full transition-all duration-300 ${
															isLunas ? "bg-emerald-400" : "bg-brand-500"
														}`}
														style={{ width: `${progressPct}%` }}
													/>
												</div>
												<div className="mt-1 flex items-center justify-between text-xs text-slate-400">
													<span>Terbayar {formatRupiah(item.paid)}</span>
													<span>Dari {formatRupiah(item.amount)}</span>
												</div>
											</div>
											{!isLunas ? (
												<button
													type="button"
													onClick={() => {
														setCharge({
															...charge,
															charge_category_id: item.id,
															amount_paid: "",
															payment_date: todayISO(),
															payment_method: "tunai",
															note: "",
														});
														setEditing(null);
														setError(null);
														setShowChargeModal(true);
													}}
													className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:brightness-110">
													Bayar
												</button>
											) : null}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Payment Modal */}
					{showChargeModal ? (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
							<div className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl">
								<div className="mb-4 flex items-center justify-between">
									<h3 className="text-lg font-bold text-slate-900">
										Bayar Tagihan
									</h3>
									<button
										type="button"
										onClick={() => setShowChargeModal(false)}
										className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
										<svg
											className="h-5 w-5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
								{selectedCharge ? (
									<div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
										<p className="font-semibold text-slate-900">
											{selectedCharge.name}
										</p>
										<p className="text-xs text-slate-500">
											Sisa: {formatRupiah(chargeAvailableToPay)}
											{selectedCharge.allow_installments === false
												? " (harus lunas)"
												: ""}
										</p>
									</div>
								) : null}
								<form onSubmit={saveCharge} className="grid gap-4">
									{/* Nominal bayar */}
									<div>
										<label className="mb-1.5 block text-sm font-medium text-slate-700">
											Nominal bayar
										</label>
										<div className="relative">
											<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
												Rp
											</span>
											<input
												ref={amountRef}
												type="text"
												inputMode="numeric"
												autoComplete="off"
												disabled={selectedChargeIsPaid}
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
												className={`h-14 w-full rounded-xl border-2 bg-white pl-14 pr-4 text-right text-xl font-bold outline-none transition-all duration-200 focus:ring-4 disabled:opacity-50 ${
													chargeAmountInvalid
														? "border-red-400 focus:border-red-500 focus:ring-red-100"
														: "border-slate-200 focus:border-brand-500 focus:ring-brand-100"
												}`}
												placeholder="0"
												required
											/>
										</div>
										{chargeAmountInvalid ? (
											<p className="mt-1 text-xs font-semibold text-red-600">
												{selectedCharge?.allow_installments === false
													? `Harus lunas: ${formatRupiah(chargeAvailableToPay)}`
													: `Max: ${formatRupiah(chargeAvailableToPay)}`}
											</p>
										) : null}
									</div>

									{/* Tanggal */}
									<FormField label="Tanggal bayar">
										<input
											type="date"
											className={inputClass}
											value={charge.payment_date}
											onChange={(e) =>
												setCharge({
													...charge,
													payment_date: e.target.value,
												})
											}
										/>
									</FormField>

									{/* Metode — pill toggle */}
									<FormField label="Metode bayar">
										<div className="flex rounded-xl border-2 border-slate-200 bg-slate-50 p-1">
											<button
												type="button"
												disabled={editing?.type === "charge"}
												onClick={() =>
													setCharge({
														...charge,
														payment_method: "tunai",
														note: "",
													})
												}
												className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
													charge.payment_method === "tunai"
														? "bg-white text-slate-900 shadow-sm"
														: "text-slate-500 hover:text-slate-700"
												}`}>
												Tunai
											</button>
											<button
												type="button"
												disabled={editing?.type === "charge"}
												onClick={() =>
													setCharge({
														...charge,
														payment_method: "dari_tabungan",
														note:
															!charge.note && selectedCharge?.name
																? `Pembayaran tagihan ${selectedCharge.name} dari tabungan`
																: "Pembayaran tagihan dari tabungan",
													})
												}
												className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
													charge.payment_method === "dari_tabungan"
														? "bg-white text-slate-900 shadow-sm"
														: "text-slate-500 hover:text-slate-700"
												}`}>
												Dari tabungan
											</button>
										</div>
									</FormField>

									{/* Keterangan */}
									<FormField label="Keterangan (opsional)">
										<textarea
											className={inputClass + " resize-none"}
											placeholder={
												charge.payment_method === "dari_tabungan"
													? selectedCharge?.name
														? `Pembayaran tagihan ${selectedCharge.name} dari tabungan`
														: "Pembayaran tagihan dari tabungan"
													: "Catatan (opsional)"
											}
											value={charge.note}
											onChange={(e) =>
												setCharge({ ...charge, note: e.target.value })
											}
										/>
									</FormField>

									{/* Sisa setelah bayar */}
									{selectedCharge && charge.amount_paid ? (
										<div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
											<span className="text-sm text-slate-600">
												Sisa setelah bayar
											</span>
											<span
												className={`text-base font-bold ${
													chargeAvailableToPay -
														Number(charge.amount_paid || 0) <=
													0
														? "text-emerald-600"
														: "text-slate-700"
												}`}>
												{formatRupiah(
													Math.max(
														chargeAvailableToPay -
															Number(charge.amount_paid || 0),
														0,
													),
												)}
											</span>
										</div>
									) : null}

									{error ? (
										<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
											{error}
										</div>
									) : null}

									{/* Submit + Cancel */}
									<div className="flex gap-3">
										<button
											type="button"
											onClick={() => setShowChargeModal(false)}
											className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 font-semibold text-slate-600 transition-all hover:bg-slate-50">
											Batal
										</button>
										<button
											type="submit"
											disabled={
												saving ||
												chargeAmountInvalid ||
												selectedChargeIsPaid ||
												(!editing && !charge.charge_category_id)
											}
											className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-glow transition-all duration-200 hover:brightness-110 disabled:opacity-50">
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
									</div>
								</form>
							</div>
						</div>
					) : null}
				</>
			) : null}

			{active === "savings" ? (
				<HistoryList
					rows={savingsRows}
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
					onDelete={async (row) => {
						if (!window.confirm("Hapus transaksi tabungan ini?")) return;
						setError(null);
						try {
							await deleteSavingsTransaction(row.id);
							setEditing(null);
							setSavings({
								type: "setor",
								amount: "",
								transaction_date: todayISO(),
								note: "",
							});
							setToast("Transaksi tabungan dihapus");
							await refresh();
							focusInputSection();
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
						setError(null);
						setShowChargeModal(true);
					}}
					onDelete={async (row) => {
						if (!window.confirm("Hapus pembayaran tagihan ini?")) return;
						setError(null);
						try {
							await deleteChargePayment(row.id);
							setEditing(null);
							setShowChargeModal(false);
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
							) : null}
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
