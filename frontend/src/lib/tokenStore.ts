const KEY = "inventory.authToken";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

let memoryToken: string | null = storage()?.getItem(KEY) ?? null;

export const tokenStore = {
  get(): string | null {
    return memoryToken;
  },
  set(token: string) {
    memoryToken = token;
    try {
      storage()?.setItem(KEY, token);
    } catch {
      /* storage unavailable: keep the in-memory token only */
    }
  },
  clear() {
    memoryToken = null;
    try {
      storage()?.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
  /** Re-read sessionStorage (used by tests). */
  reload() {
    memoryToken = storage()?.getItem(KEY) ?? null;
  },
};
