import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	Receipt,
	WalletCards,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { listStudents } from "../../services/masterDataService";
import {
	getFinanceSummary,
	getClassStudentFinance,
} from "../../services/financeService";
import { formatRupiah, todayISO } from "../../utils/formatters";

function chargeAppliesToStudent(category, student) {
	if (!category || !student) return false;
	const gradeSet = new Set(
		(category.grades || []).map((item) => Number(item.grade)),
	);
	if (category.period_id !== student.current_class?.period_id) return false;
	if (gradeSet.size && !gradeSet.has(Number(student.current_class?.grade)))
		return false;
	if (
		category.gender_scope !== "all" &&
		student.gender !== category.gender_scope
	)
		return false;
	return true;
}

export default function WalasDashboard() {
	const { profile } = useAuth();
	const navigate = useNavigate();
	const [students, setStudents] = useState([]);
	const [summary, setSummary] = useState({});
	const [chargeSummary, setChargeSummary] = useState({ paid: 0, unpaid: 0 });
	const [studentFinance, setStudentFinance] = useState(new Map());
	const [studentTotalCharge, setStudentTotalCharge] = useState(new Map());
	const [filterMode, setFilterMode] = useState("today"); // "today" | "all"
	const [pickDate, setPickDate] = useState(todayISO());

	const effectiveDate = filterMode === "all" ? null : pickDate;

	const shiftDate = useCallback((days) => {
		setPickDate((prev) => {
			const [y, m, d] = prev.split("-").map(Number);
			const dt = new Date(y, m - 1, d + days);
			const yy = dt.getFullYear();
			const mm = String(dt.getMonth() + 1).padStart(2, "0");
			const dd = String(dt.getDate()).padStart(2, "0");
			return `${yy}-${mm}-${dd}`;
		});
		setFilterMode("today");
	}, []);

	useEffect(() => {
		const classId = profile?.assigned_class_id;
		if (!classId) return;
		listStudents({ mineAsWalas: true }).then(async (studentRows) => {
			const activePeriodId = studentRows[0]?.current_class?.period_id || null;

			const [finance, classFinance] = await Promise.all([
				getFinanceSummary({
					classId,
					periodId: activePeriodId,
					startDate: effectiveDate,
					endDate: effectiveDate,
				}),
				getClassStudentFinance(
					classId,
					activePeriodId,
					effectiveDate,
					effectiveDate,
				),
			]);

			const {
				savingsByStudent,
				chargeCategories,
				chargePaidByStudent,
				chargePayments,
			} = classFinance;

			// Build paid-by-student-category map
			const paidByStudentCategory = new Map();
			for (const cp of chargePayments) {
				const key = `${cp.student_id}-${cp.charge_category_id}`;
				paidByStudentCategory.set(
					key,
					(paidByStudentCategory.get(key) || 0) + Number(cp.amount_paid || 0),
				);
			}

			// Build per-student finance map
			const perStudent = new Map();
			const perStudentTotalCharge = new Map();
			let totalChargePaid = 0;
			let totalChargeUnpaid = 0;

			for (const student of studentRows) {
				const sav = savingsByStudent.get(student.id) || {
					deposit: 0,
					withdrawal: 0,
				};
				const chargePaid = chargePaidByStudent.get(student.id) || 0;
				let chargeUnpaid = 0;
				let totalCharge = 0;
				for (const cat of chargeCategories) {
					if (chargeAppliesToStudent(cat, student)) {
						const paid =
							paidByStudentCategory.get(`${student.id}-${cat.id}`) || 0;
						const catAmount = Number(cat.amount || 0);
						totalCharge += catAmount;
						chargeUnpaid += Math.max(catAmount - paid, 0);
					}
				}
				perStudent.set(student.id, {
					savingsBalance: sav.deposit - sav.withdrawal,
					savingsDeposit: sav.deposit,
					savingsWithdrawal: sav.withdrawal,
					chargePaid,
					chargeUnpaid,
				});
				perStudentTotalCharge.set(student.id, totalCharge);
				totalChargePaid += chargePaid;
				totalChargeUnpaid += chargeUnpaid;
			}

			setStudents(studentRows);
			setSummary(finance);
			setChargeSummary({ paid: totalChargePaid, unpaid: totalChargeUnpaid });
			setStudentFinance(perStudent);
			setStudentTotalCharge(perStudentTotalCharge);
		});
	}, [profile?.assigned_class_id, filterMode, pickDate]);

	return (
		<div className="walas-dashboard space-y-5">
			{/* Filter */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-1">
					<button
						onClick={() => shiftDate(-1)}
						className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
						title="Hari sebelumnya">
						<ChevronLeft size={18} />
					</button>
					<input
						type="date"
						value={pickDate}
						onChange={(e) => {
							setPickDate(e.target.value);
							setFilterMode("today");
						}}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
					/>
					<button
						onClick={() => shiftDate(1)}
						className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
						title="Hari berikutnya">
						<ChevronRight size={18} />
					</button>
				</div>
				<button
					onClick={() => setFilterMode((m) => (m === "all" ? "today" : "all"))}
					className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
						filterMode === "all"
							? "bg-brand-600 text-white"
							: "bg-white text-slate-700 border border-slate-200"
					}`}>
					<span>Semua</span>
					<span
						className={`text-xs px-1.5 py-0.5 rounded font-semibold transition ${
							filterMode === "all"
								? "bg-white/20 text-white"
								: "bg-slate-100 text-slate-500"
						}`}>
						{filterMode === "all" ? "ON" : "OFF"}
					</span>
				</button>
			</div>

			{/* Total row */}
			<div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-purple-50 p-4">
				<div className="flex items-center justify-between mb-3">
					<p className="text-sm font-bold text-brand-800">
						Total {filterMode === "all" ? "Keseluruhan" : pickDate}
					</p>
					<span className="rounded-full bg-brand-200/60 px-2 py-0.5 text-xs font-semibold text-brand-700">
						{filterMode === "all" ? "Semua Waktu" : "Per Tanggal"}
					</span>
				</div>
				<div className="flex gap-3">
					{/* Tabungan: Setor + Tarik */}
					<div className="flex-[2] rounded-xl bg-white/70 p-3">
						<p className="text-xs font-medium text-slate-500 mb-2">Tabungan</p>
						<div className="flex gap-2">
							<div className="flex-1">
								<p className="text-xs text-slate-400">Setor</p>
								<p className="text-sm font-bold text-green-700">
									{formatRupiah(summary.savings_deposit || 0)}
								</p>
							</div>
							<div className="w-px bg-slate-200 shrink-0" />
							<div className="flex-1">
								<p className="text-xs text-slate-400">Tarik</p>
								<p className="text-sm font-bold text-red-600">
									{formatRupiah(summary.savings_withdrawal || 0)}
								</p>
							</div>
						</div>
					</div>
					{/* Bayar Tagihan */}
					<div className="flex-1 rounded-xl bg-white/70 p-3 flex flex-col justify-center">
						<p className="text-xs font-medium text-slate-500 mb-1">Tagihan</p>
						<p className="text-xs text-slate-400">Bayar</p>
						<p className="text-sm font-bold text-brand-700">
							{formatRupiah(chargeSummary.paid)}
						</p>
					</div>
				</div>
			</div>

			{/* Student list */}
			<section>
				<h2 className="mb-3 text-lg font-bold text-slate-950">Daftar Siswa</h2>
				{students.length === 0 ? (
					<p className="text-sm text-slate-500">Belum ada siswa.</p>
				) : (
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{students.map((student) => {
							const fin = studentFinance.get(student.id) || {
								savingsBalance: 0,
								savingsDeposit: 0,
								savingsWithdrawal: 0,
								chargePaid: 0,
								chargeUnpaid: 0,
							};
							const totalCharge = studentTotalCharge.get(student.id) || 0;
							return (
								<button
									key={student.id}
									type="button"
									onClick={() => navigate(`/walas/input?student=${student.id}`)}
									className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:shadow-md hover:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-500">
									{/* Nama + gender */}
									<div className="flex-1 min-w-0">
										<p className="text-sm font-bold text-slate-950 truncate">
											{student.name}
										</p>
										<div className="flex items-center gap-2 mt-0.5 text-xs">
											<span className="rounded-full bg-brand-50 px-1.5 py-px font-semibold text-brand-700">
												{student.gender}
											</span>
											{totalCharge > 0 && (
												<span className="text-slate-500">
													Bayar Tagihan {formatRupiah(fin.chargePaid)}
												</span>
											)}
										</div>
									</div>
									{/* Tabungan */}
									<div className="text-right shrink-0">
										<p className="text-xs text-slate-400">Tabungan</p>
										<p className="text-sm font-extrabold text-brand-700">
											{formatRupiah(fin.savingsBalance)}
										</p>
									</div>
									{/* Action arrow */}
									<ChevronRight size={16} className="shrink-0 text-slate-300" />
								</button>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}

function WalasStatCard({ title, value, icon: Icon }) {
	return (
		<div className="min-h-[116px] min-w-0 basis-[calc(50%-0.375rem)] rounded-2xl border border-slate-100 bg-white p-3 xl:basis-[calc(25%-0.5625rem)]">
			<div className="flex h-full flex-col justify-between gap-3">
				<div className="flex items-start justify-between gap-2">
					<p className="min-w-0 text-xs leading-snug text-slate-500">{title}</p>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
						<Icon size={18} />
					</span>
				</div>
				<p className="break-words text-lg font-bold leading-tight text-slate-950">
					{value}
				</p>
			</div>
		</div>
	);
}
