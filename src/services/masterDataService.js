import { supabase } from '../lib/supabase';

export async function listPeriods() {
  const { data, error } = await supabase.from('periods').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listPeriodOptions() {
  const { data, error } = await supabase
    .from('periods')
    .select('id,name,start_date,end_date,is_active')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function savePeriod(payload) {
  const query = payload.id ? supabase.from('periods').update(payload).eq('id', payload.id) : supabase.from('periods').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deletePeriod(id) {
  const { error } = await supabase.from('periods').delete().eq('id', id);
  if (error) throw error;
}

export async function listClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('*, periods(name), homeroom:profiles!classes_homeroom_teacher_id_fkey(full_name,email)')
    .order('grade')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function listClassOptions() {
  const { data, error } = await supabase
    .from('classes')
    .select('id,name,grade,period_id,homeroom_teacher_id,period:periods(id,name,is_active)')
    .order('grade')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function saveClass(payload) {
  const query = payload.id ? supabase.from('classes').update(payload).eq('id', payload.id) : supabase.from('classes').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteClass(id) {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

export async function listStudents(filters = {}) {
  if (filters.mineAsWalas) {
    const { data, error } = await supabase.rpc('list_my_walas_students');
    if (error) throw error;
    return data || [];
  }

  let query = supabase
    .from('students')
    .select('*, current_class:classes(id,name,grade,period_id, periods(name,start_date,end_date))')
    .order('name');
  if (filters.classId) query = query.eq('current_class_id', filters.classId);
  if (filters.activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getStudent(id) {
  const { data, error } = await supabase
    .from('students')
    .select('*, current_class:classes(id,name,grade,period_id, periods(name,start_date,end_date), homeroom:profiles!classes_homeroom_teacher_id_fkey(id,full_name))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function saveStudent(payload) {
  const query = payload.id ? supabase.from('students').update(payload).eq('id', payload.id) : supabase.from('students').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteStudent(id) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

export async function createStudentHistory(payload) {
  const { data, error } = await supabase.from('student_class_histories').insert(payload).select().single();
  if (error) throw error;
  return data;
}
