import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

// One seam for every suite that touches the session: AuthProvider (useSession),
// api.js (getSession/signOut), the auth service (signIn/signUp/reset/two-factor)
// and the screens that drive that service. useSession is a real store hook so a
// test can move the session and let React re-render like better-auth does.

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
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  changePassword: vi.fn(),
  changeEmail: vi.fn(),
  twoFactor: { enable: vi.fn(), disable: vi.fn(), verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
};

/** Move the session the way the BA client would after a transition. */
export function setAuthSession(data, isPending = false) {
  sessionState = { data, isPending };
  listeners.forEach((cb) => cb());
}

const SIGNED_OUT = { data: null, error: null };

/** Back to a settled signed-out state with clean spies. */
export function resetAuthClient() {
  sessionState = { data: null, isPending: false };
  listeners.forEach((cb) => cb());
  authClientMock.getSession.mockReset();
  authClientMock.signOut.mockReset();
  authClientMock.signIn.email.mockReset();
  authClientMock.signUp.email.mockReset();
  authClientMock.requestPasswordReset.mockReset();
  authClientMock.resetPassword.mockReset();
  authClientMock.verifyEmail.mockReset();
  authClientMock.sendVerificationEmail.mockReset();
  authClientMock.changePassword.mockReset();
  authClientMock.changeEmail.mockReset();
  authClientMock.twoFactor.enable.mockReset();
  authClientMock.twoFactor.disable.mockReset();
  authClientMock.twoFactor.verifyTotp.mockReset();
  authClientMock.twoFactor.verifyBackupCode.mockReset();
  authClientMock.getSession.mockResolvedValue(SIGNED_OUT);
  authClientMock.signOut.mockResolvedValue({ data: null, error: null });
  authClientMock.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.verifyEmail.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.changePassword.mockResolvedValue({ data: { token: null }, error: null });
  authClientMock.changeEmail.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.twoFactor.enable.mockResolvedValue({ data: { method: 'totp' }, error: null });
  authClientMock.twoFactor.disable.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.twoFactor.verifyTotp.mockResolvedValue({ data: { status: true }, error: null });
  authClientMock.twoFactor.verifyBackupCode.mockResolvedValue({ data: { status: true }, error: null });
}
