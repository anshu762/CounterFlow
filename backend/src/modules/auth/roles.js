export const ROLE_OWNER = 'owner';
export const ROLE_STAFF = 'staff';
export const ROLE_CUSTOMER = 'customer';

// Staff-side roles (admin_users.role). Customers are a separate kind of account.
export const ROLES = [ROLE_OWNER, ROLE_STAFF];
export const ALL_ROLES = [...ROLES, ROLE_CUSTOMER];
