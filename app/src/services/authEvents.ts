type AuthListener = () => void;

const listeners = new Set<AuthListener>();

export const authEvents = {
  onLogout(listener: AuthListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emitLogout() {
    listeners.forEach((l) => {
      try { l(); } catch { /* silent */ }
    });
  },
};
