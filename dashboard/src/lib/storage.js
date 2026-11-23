export const REFRESH_KEY = 'cf.refresh';

let memory = null; // fallback when localStorage is unavailable (private mode, tests)

function local() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Only the long-lived refresh token is persisted. The access token lives in memory.
export const refreshTokenStore = {
  get() {
    const ls = local();
    if (ls) {
      try {
        return ls.getItem(REFRESH_KEY);
      } catch {
        /* fall through to memory */
      }
    }
    return memory;
  },
  set(token) {
    memory = token;
    const ls = local();
    if (ls) {
      try {
        ls.setItem(REFRESH_KEY, token);
      } catch {
        /* storage full or blocked: memory copy still works for this tab */
      }
    }
  },
  clear() {
    memory = null;
    const ls = local();
    if (ls) {
      try {
        ls.removeItem(REFRESH_KEY);
      } catch {
        /* nothing to do */
      }
    }
  },
};