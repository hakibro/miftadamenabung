import { supabase } from '../lib/supabase';

export async function getProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, assigned_class:classes!profiles_assigned_class_id_fkey(name)')
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function updateProfile(id, payload) {
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
