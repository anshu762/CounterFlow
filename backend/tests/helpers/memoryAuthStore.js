import crypto from 'node:crypto';
import {
  DuplicateCustomerError,
  DuplicateAdminEmailError,
  LastOwnerError,
} from '../../src/modules/auth/auth.errors.js';

// In-memory stand-in for the Postgres auth store, so auth tests need no database.
export function createMemoryAuthStore({ users = [], customers = [] } = {}) {
  const admins = new Map(users.map((u) => [u.user_id, { ...u }]));
  const customerMap = new Map(customers.map((c) => [c.customer_id, { ...c }]));
  const tokens = new Map();

  const emailTaken = (email, exceptId) =>
    [...admins.values()].some(
      (u) => u.user_id !== exceptId && u.email.toLowerCase() === email.toLowerCase(),
    );

  const store = {
    _admins: admins,
    _customers: customerMap,
    _tokens: tokens,

    // ---------- staff accounts ----------
    async findAdminByEmail(email) {
      const u = [...admins.values()].find((x) => x.email.toLowerCase() === email.toLowerCase());
      return u ? { ...u } : null;
    },
    async findAdminById(id) {
      const u = admins.get(id);
      return u ? { ...u } : null;
    },
    async touchLastLogin(id) {
      const u = admins.get(id);
      if (u) u.last_login_at = new Date();
    },
    async listAdmins() {
      return [...admins.values()]
        .map(({ password_hash: _hash, ...rest }) => ({ ...rest }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async createAdmin({ name, email, passwordHash, role }) {
      if (emailTaken(email)) throw new DuplicateAdminEmailError();
      const user = {
        user_id: crypto.randomUUID(),
        name,
        email,
        password_hash: passwordHash,
        role,
        is_active: true,
        last_login_at: null,
      };
      admins.set(user.user_id, user);
      return { ...user };
    },
    async updateAdmin(id, patch) {
      const current = admins.get(id);
      if (!current) return null;
      const next = { ...current };
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.email !== undefined) {
        if (emailTaken(patch.email, id)) throw new DuplicateAdminEmailError();
        next.email = patch.email;
      }
      if (patch.role !== undefined) next.role = patch.role;
      if (patch.isActive !== undefined) next.is_active = patch.isActive;

      const wasActiveOwner = current.role === 'owner' && current.is_active;
      const staysActiveOwner = next.role === 'owner' && next.is_active;
      if (wasActiveOwner && !staysActiveOwner) {
        const others = [...admins.values()].filter(
          (u) => u.user_id !== id && u.role === 'owner' && u.is_active,
        );
        if (others.length === 0) throw new LastOwnerError();
      }
      admins.set(id, next);
      return { ...next };
    },
    async setAdminPassword(id, passwordHash) {
      const u = admins.get(id);
      if (!u) return false;
      u.password_hash = passwordHash;
      return true;
    },
    async revokeAllForAdmin(id) {
      for (const t of tokens.values()) {
        if (t.admin_user_id === id && !t.revoked_at) t.revoked_at = new Date();
      }
    },

    // ---------- customers ----------
    async findCustomerByPhone(phone) {
      const c = [...customerMap.values()].find((x) => x.phone === phone);
      return c ? { ...c } : null;
    },
    async findCustomerByEmail(email) {
      const c = [...customerMap.values()].find(
        (x) => x.email && x.email.toLowerCase() === email.toLowerCase(),
      );
      return c ? { ...c } : null;
    },
    async findCustomerById(id) {
      const c = customerMap.get(id);
      return c ? { ...c } : null;
    },
    async createCustomer({ name, phone, email, passwordHash }) {
      const all = [...customerMap.values()];
      if (all.some((c) => c.phone === phone)) throw new DuplicateCustomerError('phone');
      if (email && all.some((c) => c.email && c.email.toLowerCase() === email.toLowerCase())) {
        throw new DuplicateCustomerError('email');
      }
      const customer = {
        customer_id: crypto.randomUUID(),
        name,
        phone,
        email: email ?? null,
        password_hash: passwordHash,
        is_active: true,
      };
      customerMap.set(customer.customer_id, customer);
      return { ...customer };
    },

    // ---------- refresh tokens ----------
    async insertRefreshToken(r) {
      tokens.set(r.tokenId, {
        token_id: r.tokenId,
        family_id: r.familyId,
        admin_user_id: r.adminUserId ?? null,
        customer_id: r.customerId ?? null,
        token_hash: r.tokenHash,
        expires_at: r.expiresAt,
        revoked_at: null,
        replaced_by: null,
      });
    },
    async findRefreshToken(hash) {
      const t = [...tokens.values()].find((x) => x.token_hash === hash);
      return t ? { ...t } : null;
    },
    async rotateRefreshToken(oldId, next) {
      const old = tokens.get(oldId);
      if (!old || old.revoked_at) return false;
      old.revoked_at = new Date();
      await store.insertRefreshToken(next);
      old.replaced_by = next.tokenId;
      return true;
    },
    async revokeFamily(familyId) {
      for (const t of tokens.values()) {
        if (t.family_id === familyId && !t.revoked_at) t.revoked_at = new Date();
      }
    },
    async purgeExpired() {},
  };
  return store;
}
