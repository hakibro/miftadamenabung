import { supabase } from '../lib/supabase';

function normalizeTransactionEditError(error) {
  if (error?.message?.includes('Cannot coerce the result to a single JSON object') || error?.code === 'PGRST116') {
    return new Error('Transaksi pada tanggal ini tidak bisa diedit oleh walas. Silakan hubungi admin untuk koreksi.');
  }
  return error;
}

export async function getSavingsBalance(studentId) {
  const { data, error } = await supabase.rpc('get_student_savings_balance', { target_student_id: studentId });
  if (error) throw error;
  return Number(data || 0);
}

export async function listSavingsTransactions(filters = {}) {
  let query = supabase
    .from('savings_transactions')
    .select('*, student:students(id,name,nis,current_class:classes(name))')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (filters.studentId) query = query.eq('student_id', filters.studentId);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.startDate) query = query.gte('transaction_date', filters.startDate);
  if (filters.endDate) query = query.lte('transaction_date', filters.endDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createSavingsTransaction(payload) {
  const { data, error } = await supabase.from('savings_transactions').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateSavingsTransaction(id, payload) {
  const { data, error } = await supabase.from('savings_transactions').update(payload).eq('id', id).select().single();
  if (error) throw normalizeTransactionEditError(error);
  return data;
}

export async function deleteSavingsTransaction(id) {
  const { error } = await supabase.from('savings_transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function listInfaqPayments(filters = {}) {
  let query = supabase
    .from('infaq_payments')
    .select('*, student:students(id,name,nis,current_class:classes(name)), period:periods(name)')
    .order('year', { ascending: false })
    .order('month', { ascending: true });
  if (filters.studentId) query = query.eq('student_id', filters.studentId);
  if (filters.periodId) query = query.eq('period_id', filters.periodId);
  if (filters.month) query = query.eq('month', filters.month);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createInfaqPayment(payload) {
  const { data, error } = await supabase
    .from('infaq_payments')
    .upsert(payload, { onConflict: 'student_id,period_id,month,year' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInfaqPayment(id, payload) {
  const { data, error } = await supabase.from('infaq_payments').update(payload).eq('id', id).select().single();
  if (error) throw normalizeTransactionEditError(error);
  return data;
}

export async function createFullPeriodInfaq({ student_id, period_id, year, monthly_amount, months = [], months_count = 12, note }) {
  const targetMonths = months.length ? months : Array.from({ length: Number(months_count || 12) }, (_, index) => index + 1);
  const rows = targetMonths.map((month) => ({
    student_id,
    period_id,
    year,
    month,
    amount: monthly_amount,
    status: 'lunas',
    note,
  }));
  const { data, error } = await supabase
    .from('infaq_payments')
    .upsert(rows, { onConflict: 'student_id,period_id,month,year' })
    .select();
  if (error) throw error;
  return data || [];
}

export const createFullYearInfaq = createFullPeriodInfaq;

export async function listLksBills(filters = {}) {
  let query = supabase
    .from('lks_bills')
    .select('*, class:classes(name), period:periods(name), class_amounts:lks_bill_class_amounts(id,class_id,amount,note,class:classes(name))')
    .order('semester', { ascending: true })
    .order('created_at', { ascending: false });
  if (filters.classId) query = query.or(`class_id.eq.${filters.classId},class_id.is.null`);
  if (filters.periodId) query = query.eq('period_id', filters.periodId);
  if (filters.semester) query = query.eq('semester', Number(filters.semester));
  const { data, error } = await query;
  if (error) {
    let fallback = supabase.from('lks_bills').select('*').order('semester', { ascending: true }).order('created_at', { ascending: false });
    if (filters.classId) fallback = fallback.or(`class_id.eq.${filters.classId},class_id.is.null`);
    if (filters.periodId) fallback = fallback.eq('period_id', filters.periodId);
    if (filters.semester) fallback = fallback.eq('semester', Number(filters.semester));

    const { data: bills, error: billsError } = await fallback;
    if (billsError) throw error;

    const billIds = (bills || []).map((bill) => bill.id);
    const classIds = [...new Set((bills || []).map((bill) => bill.class_id).filter(Boolean))];
    const { data: amountRows } = billIds.length
      ? await supabase.from('lks_bill_class_amounts').select('*').in('lks_bill_id', billIds)
      : { data: [] };
    classIds.push(...(amountRows || []).map((item) => item.class_id).filter(Boolean));
    const uniqueClassIds = [...new Set(classIds)];
    const periodIds = [...new Set((bills || []).map((bill) => bill.period_id).filter(Boolean))];
    const { data: classRows } = uniqueClassIds.length
      ? await supabase.from('classes').select('id,name').in('id', uniqueClassIds)
      : { data: [] };
    const { data: periodRows } = periodIds.length
      ? await supabase.from('periods').select('id,name').in('id', periodIds)
      : { data: [] };
    const classById = new Map((classRows || []).map((item) => [item.id, item]));
    const periodById = new Map((periodRows || []).map((item) => [item.id, item]));

    return (bills || []).map((bill) => ({
      ...bill,
      class: bill.class_id ? classById.get(bill.class_id) || null : null,
      period: bill.period_id ? periodById.get(bill.period_id) || null : null,
      class_amounts: (amountRows || [])
        .filter((item) => item.lks_bill_id === bill.id)
        .map((item) => ({ ...item, class: classById.get(item.class_id) || null })),
    }));
  }
  return data || [];
}

export async function saveLksBill(payload) {
  const { class_amounts, ...billPayload } = payload;
  const query = billPayload.id ? supabase.from('lks_bills').update(billPayload).eq('id', billPayload.id) : supabase.from('lks_bills').insert(billPayload);
  const { data, error } = await query.select().single();
  if (error) throw error;

  if (Array.isArray(class_amounts)) {
    const rows = class_amounts
      .filter((item) => item.class_id && Number(item.amount) > 0)
      .map((item) => ({
        lks_bill_id: data.id,
        class_id: item.class_id,
        amount: Number(item.amount),
        note: item.note || null,
      }));

    if (billPayload.id) {
      const { error: deleteError } = await supabase.from('lks_bill_class_amounts').delete().eq('lks_bill_id', data.id);
      if (deleteError) throw deleteError;
    }

    if (rows.length) {
      const { error: detailError } = await supabase.from('lks_bill_class_amounts').insert(rows);
      if (detailError) throw detailError;
    }
  }

  return data;
}

export async function deleteLksBill(id) {
  const { error } = await supabase.from('lks_bills').delete().eq('id', id);
  if (error) throw error;
}

export async function listLksPayments(filters = {}) {
  let query = supabase
    .from('lks_payments')
    .select('*, student:students(id,name,nis,current_class:classes(name)), bill:lks_bills(name,semester,total_amount)')
    .order('payment_date', { ascending: false });
  if (filters.studentId) query = query.eq('student_id', filters.studentId);
  if (filters.billId) query = query.eq('lks_bill_id', filters.billId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateLksPayment(id, payload) {
  const { data, error } = await supabase.from('lks_payments').update(payload).eq('id', id).select().single();
  if (error) throw normalizeTransactionEditError(error);
  return data;
}

export async function createLksPayment(payload) {
  const { data, error } = await supabase.rpc('create_lks_payment', { payment: payload });
  if (error) throw error;
  return data;
}

export async function getFinanceSummary(filters = {}) {
  const { data, error } = await supabase.rpc('get_finance_summary', {
    target_period_id: filters.periodId || null,
    target_class_id: filters.classId || null,
    target_student_id: filters.studentId || null,
    start_date: filters.startDate || null,
    end_date: filters.endDate || null,
  });
  if (error) throw error;
  return data?.[0] || {};
}
