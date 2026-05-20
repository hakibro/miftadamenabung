import { supabase } from '../lib/supabase';

async function getFunctionErrorMessage(error) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // Response body may already be consumed or may not be JSON.
    }
  }

  if (error?.message === 'Failed to send a request to the Edge Function') {
    return 'Gagal menghubungi Edge Function manage-user. Pastikan function sudah dideploy, nama function benar, dan secrets Supabase sudah diset.';
  }

  if (error?.message === 'Edge Function returned a non-2xx status code') {
    return 'Edge Function manage-user menolak request. Buka Supabase Edge Function logs untuk detail, atau deploy ulang function manage-user terbaru.';
  }

  return error?.message || 'Gagal menjalankan Edge Function manage-user';
}

export async function manageUser(action, payload) {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, payload },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
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
