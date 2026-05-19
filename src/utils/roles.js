export const ROLES = {
  ADMIN: 'admin',
  BENDAHARA: 'bendahara',
  WALAS: 'walas',
};

export function roleHome(role) {
  if (role === ROLES.ADMIN) return '/admin/dashboard';
  if (role === ROLES.BENDAHARA) return '/bendahara/dashboard';
  if (role === ROLES.WALAS) return '/walas/dashboard';
  return '/login';
}

export function canAccess(profile, allowedRoles = []) {
  if (!profile) return false;
  if (profile.role === ROLES.ADMIN) return true;
  return allowedRoles.includes(profile.role);
}
