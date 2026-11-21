// In-memory stand-in for the Postgres auth store, so auth tests need no database.
export function createMemoryAuthStore({ users = [] } = {}) {
  const admins = new Map(users.map((u) => [u.user_id, { ...u }]));
  const tokens = new Map();

  const store = {
    _admins: admins,
    _tokens: tokens,

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
    async insertRefreshToken(r) {
      tokens.set(r.tokenId, {
        token_id: r.tokenId,
        family_id: r.familyId,
        admin_user_id: r.adminUserId,
        customer_id: null,
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