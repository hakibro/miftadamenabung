import { supabase } from "../lib/supabase";

function normalizeTransactionEditError(error) {
	if (
		error?.message?.includes(
			"Cannot coerce the result to a single JSON object",
		) ||
		error?.code === "PGRST116"
	) {
		return new Error(
			"Transaksi pada tanggal ini tidak bisa diedit oleh walas. Silakan hubungi admin untuk koreksi.",
		);
	}
	return error;
}

export async function getSavingsBalance(studentId, periodId = null) {
	const { data, error } = await supabase.rpc("get_student_savings_balance", {
		target_student_id: studentId,
		target_period_id: periodId,
	});
	if (error) throw error;
	return Number(data || 0);
}

export async function getPublicStudentQrFinance(studentId) {
	const { data, error } = await supabase.rpc("get_public_student_qr_finance", {
		target_student_id: studentId,
	});
	if (error) throw error;
	return data || null;
}

export async function listSavingsTransactions(filters = {}) {
	let query = supabase
		.from("savings_transactions")
		.select(
			"*, student:students(id,name,nis,current_class:classes(name)), charge_payment:charge_payments!charge_payments_savings_transaction_id_fkey(id,charge_category_id,category:charge_categories(name))",
		)
		.order("transaction_date", { ascending: false })
		.order("created_at", { ascending: false });
	if (filters.studentId) query = query.eq("student_id", filters.studentId);
	if (filters.type) query = query.eq("type", filters.type);
	if (filters.periodId) query = query.eq("period_id", filters.periodId);
	if (filters.startDate)
		query = query.gte("transaction_date", filters.startDate);
	if (filters.endDate) query = query.lte("transaction_date", filters.endDate);
	const { data, error } = await query;
	if (error) throw error;
	return (data || []).map((row) => ({
		...row,
		withdrawal_category: getSavingsWithdrawalCategory(row),
	}));
}

export function getSavingsWithdrawalCategory(row) {
	if (row.type !== "tarik") return "setoran";
	if (row.category === "charge") return "charge";
	if (row.category === "year_end_cut") return "potongan_akhir_tahun";
	if (row.category === "year_end_withdrawal") return "pengambilan_akhir_tahun";
	const chargePayment = Array.isArray(row.charge_payment)
		? row.charge_payment[0]
		: row.charge_payment;
	if (chargePayment?.id) return "charge";
	if (
		String(row.note || "")
			.toLowerCase()
			.includes("bagi hasil sekolah")
	)
		return "potongan_akhir_tahun";
	if (
		String(row.note || "")
			.toLowerCase()
			.includes("potongan akhir tahun ajaran")
	)
		return "potongan_akhir_tahun";
	if (
		String(row.note || "")
			.toLowerCase()
			.includes("potongan akhir periode")
	)
		return "potongan_akhir_tahun";
	return "manual";
}

export function getSavingsWithdrawalCategoryLabel(row) {
	const category = row.withdrawal_category || getSavingsWithdrawalCategory(row);
	if (category === "charge") return "Pembayaran tagihan";
	if (category === "potongan_akhir_tahun") return "Bagi hasil sekolah 5%";
	if (category === "pengambilan_akhir_tahun") return "Pengambilan akhir tahun";
	if (category === "manual") return "Penarikan manual";
	return "Setoran";
}

export async function createSavingsTransaction(payload) {
	const { data, error } = await supabase
		.from("savings_transactions")
		.insert(payload)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function updateSavingsTransaction(id, payload) {
	const { data, error } = await supabase
		.from("savings_transactions")
		.update(payload)
		.eq("id", id)
		.select()
		.single();
	if (error) throw normalizeTransactionEditError(error);
	return data;
}

export async function deleteSavingsTransaction(id) {
	const { error } = await supabase.rpc("walas_delete_savings_transaction", {
		p_id: id,
	});
	if (error) throw error;
}

export async function getFinanceSummary(filters = {}) {
	const { data, error } = await supabase.rpc("get_finance_summary", {
		target_period_id: filters.periodId || null,
		target_class_id: filters.classId || null,
		target_student_id: filters.studentId || null,
		start_date: filters.startDate || null,
		end_date: filters.endDate || null,
	});
	if (error) throw error;
	return data?.[0] || {};
}

export async function processYearEndSavingsAction(payload) {
	const { data, error } = await supabase.rpc(
		"process_year_end_savings_action",
		{ action_payload: payload },
	);
	if (error) throw error;
	return data;
}

export async function listSavingsYearEndActions(filters = {}) {
	let query = supabase
		.from("savings_year_end_actions")
		.select(
			"*, student:students(id,name,nis,current_class:classes(id,name,grade)), period:periods(id,name)",
		)
		.order("created_at", { ascending: false });
	if (filters.periodId) query = query.eq("period_id", filters.periodId);
	if (filters.studentId) query = query.eq("student_id", filters.studentId);
	if (filters.startDate) query = query.gte("created_at", filters.startDate);
	if (filters.endDate)
		query = query.lte("created_at", `${filters.endDate}T23:59:59`);
	const { data, error } = await query;
	if (error) throw error;
	return (data || []).filter((row) => {
		if (filters.classId && row.student?.current_class?.id !== filters.classId)
			return false;
		return true;
	});
}

export async function listChargeCategories(filters = {}) {
	let query = supabase
		.from("charge_categories")
		.select(
			"*, period:periods(id,name), grades:charge_category_grades(id,grade)",
		)
		.order("created_at", { ascending: false });
	if (filters.periodId) query = query.eq("period_id", filters.periodId);
	const { data, error } = await query;
	if (error) throw error;
	return data || [];
}

export async function saveChargeCategory(payload) {
	const { grades = [], ...categoryPayload } = payload;
	const { id, period, created_at, updated_at, created_by, ...values } =
		categoryPayload;
	const query = categoryPayload.id
		? supabase.from("charge_categories").update(values).eq("id", id)
		: supabase.from("charge_categories").insert(values);
	const { data, error } = await query.select().single();
	if (error) throw error;

	const { error: deleteError } = await supabase
		.from("charge_category_grades")
		.delete()
		.eq("charge_category_id", data.id);
	if (deleteError) throw deleteError;

	const gradeRows = grades
		.map((grade) => ({ charge_category_id: data.id, grade: Number(grade) }))
		.filter((row) => row.grade);
	if (gradeRows.length) {
		const { error: gradeError } = await supabase
			.from("charge_category_grades")
			.insert(gradeRows);
		if (gradeError) throw gradeError;
	}

	return data;
}

export async function deleteChargeCategory(id) {
	const { error } = await supabase
		.from("charge_categories")
		.delete()
		.eq("id", id);
	if (error) throw error;
}

export async function createChargePayment(payload) {
	const { data, error } = await supabase.rpc("create_charge_payment", {
		payment: payload,
	});
	if (error) throw error;
	return data;
}

export async function updateChargePayment(id, payload) {
	const { data, error } = await supabase.rpc("update_charge_payment", {
		payment_id: id,
		payment: payload,
	});
	if (error) throw normalizeTransactionEditError(error);
	return data;
}

export async function deleteChargePayment(id) {
	const { data, error } = await supabase.rpc("delete_charge_payment", {
		payment_id: id,
	});
	if (error) throw error;
	return data;
}

export async function listChargePayments(filters = {}) {
	let query = supabase
		.from("charge_payments")
		.select(
			"*, student:students(id,name,nis,current_class:classes(id,name,grade,period_id)), category:charge_categories(id,name,amount,period_id)",
		)
		.order("payment_date", { ascending: false });
	if (filters.studentId) query = query.eq("student_id", filters.studentId);
	if (filters.categoryId)
		query = query.eq("charge_category_id", filters.categoryId);
	if (filters.startDate) query = query.gte("payment_date", filters.startDate);
	if (filters.endDate) query = query.lte("payment_date", filters.endDate);
	const { data, error } = await query;
	if (error) throw error;
	return (data || []).filter((row) => {
		if (filters.periodId && row.category?.period_id !== filters.periodId)
			return false;
		if (filters.classId && row.student?.current_class?.id !== filters.classId)
			return false;
		return true;
	});
}
