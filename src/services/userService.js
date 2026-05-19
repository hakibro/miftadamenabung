import { supabase } from '../lib/supabase';

export async function manageUser(action, payload) {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, payload },
  });

  if (error) {
    throw new Error(
      error.message === 'Failed to send a request to the Edge Function'
        ? 'Gagal menghubungi Edge Function manage-user. Pastikan function sudah dideploy, nama function benar, dan secrets Supabase sudah diset.'
        : error.message
    );
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listProfiles() {
  const data = await manageUser('list', {});
  return data.profiles || [];
}

export async function createUserAccount(payload) {
  return manageUser('create', payload);
}

export async function updateUserAccount(payload) {
  return manageUser('update', payload);
}

export async function deleteUserAccount(id) {
  return manageUser('delete', { id });
}

export async function setUserActive(id, isActive) {
  return manageUser('set-active', { id, is_active: isActive });
}
