const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential':       'Incorrect email or password.',
  'auth/wrong-password':           'Incorrect email or password.',
  'auth/user-not-found':           'No account found with this email.',
  'auth/email-already-in-use':     'An account with this email already exists.',
  'auth/weak-password':            'Password must be at least 6 characters.',
  'auth/invalid-email':            'Please enter a valid email address.',
  'auth/network-request-failed':   'Network error. Check your connection.',
  'auth/too-many-requests':        'Too many attempts. Please try again later.',
  'auth/user-disabled':            'This account has been disabled.',
  'auth/requires-recent-login':    'Please log in again to continue.',
  'auth/popup-closed-by-user':     '',
  'auth/cancelled-popup-request':  '',
};

export function getAuthErrorMessage(err: any): string {
  const code: string = err?.code ?? '';
  if (code && ERROR_MESSAGES[code] !== undefined) return ERROR_MESSAGES[code];
  return err?.message?.replace(/^Firebase:\s*/i, '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim()
    || 'Something went wrong. Please try again.';
}
