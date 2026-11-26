// Access levels of the SDD (section 5.1), the same lists as the backend
// middleware requireRole. The front end only uses them to hide pages and
// links: the API checks the role again on every request (NFR-08).
export const STAFF = ['STAFF', 'EQUIPMENT_MANAGER', 'ADMIN'];
export const EQUIPMENT_MANAGER = ['EQUIPMENT_MANAGER', 'ADMIN'];
export const ADMIN = ['ADMIN'];

// True when the logged-in user has one of the allowed roles.
export function hasRole(user, allowedRoles) {
  return Boolean(user) && allowedRoles.includes(user.role);
}
