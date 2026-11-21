import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

// One seam for every suite that touches the session: AuthProvider (useSession)
// and api.js (getSession/signOut). useSession is a real store hook so a test
// can move the session and let React re-render like better-auth does.

let sessionState = { data: null, isPending: false };
const listeners = new Set();
const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => sessionState;

export const authClientMock = {
  useSession: () => useSyncExternalStore(subscribe, getSnapshot),
  getSession: vi.fn(),
  signOut: vi.fn(),
};

/** Move the session the way the BA client would after a transition. */
export function setAuthSession(data, isPending = false) {
  sessionState = { data, isPending };
  listeners.forEach((cb) => cb());
}

/** Back to a settled signed-out state with clean spies. */
export function resetAuthClient() {
  sessionState = { data: null, isPending: false };
  listeners.forEach((cb) => cb());
  authClientMock.getSession.mockReset();
  authClientMock.signOut.mockReset();
  authClientMock.getSession.mockResolvedValue({ data: null });
  authClientMock.signOut.mockResolvedValue({});
}
