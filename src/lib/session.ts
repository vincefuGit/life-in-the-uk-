const SESSION_KEY = "life-in-uk-session-id";

// Progress is now keyed to an authenticated user, not a device. This only reads
// any leftover device-local id from the pre-login era so that history can be
// imported into the account on first sign-in. It never creates a new id.
export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}
