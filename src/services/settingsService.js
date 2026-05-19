import { supabase } from '../lib/supabase';

export async function getSettings() {
  const { data, error } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSettings(payload) {
  const query = payload.id ? supabase.from('app_settings').update(payload).eq('id', payload.id) : supabase.from('app_settings').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function uploadLogo(file) {
  const ext = file.name.split('.').pop();
  const path = `logos/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('app-assets').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('app-assets').getPublicUrl(path);
  return data.publicUrl;
}
