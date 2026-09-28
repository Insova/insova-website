import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import './auth.css';

/*
  Set a new password.

  Two ways in, one screen:

    reason "recovery"  arrived from a "forgot your password" email. They
                       are signed in by the link itself, but do not know
                       their password, so there is no way out except
                       setting a new one or signing out.
    reason "change"    already signed in and chose to change it. They can
                       cancel and go back to the app.

  Supabase needs a live session for either, which both cases have.
*/
export default function SetPassword({ reason = 'change', onDone, onCancel }) {
  const { updatePassword, signOut, user } = useAuth();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // The reset link leaves its token in the address bar. It has been
  // used, and it should not sit in browser history.
  useEffect(() => {
    if (reason === 'recovery' && (window.location.hash.includes('access_token') || window.location.search)) {
      window.history.replaceState(null, '', window.location.pathname + '#/password');
    }
  }, [reason]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (pw !== again) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const err = await updatePassword(pw);
      if (err) setError(friendly(err.message));
      else setDone(true);
    } finally {
      setBusy(false);
    }
  };

  const recovery = reason === 'recovery';

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440, margin: '0 auto' }}>
        {done ? (
          <>
            <h1>Password changed</h1>
            <p className="auth-lead">
              Your new password is saved. Use it the next time you sign in.
            </p>
            <button className="auth-btn" type="button" onClick={onDone}>
              Open Insova
            </button>
          </>
        ) : (
          <>
            <h1>{recovery ? 'Set a new password' : 'Change your password'}</h1>
            <p className="auth-lead">
              {recovery
                ? `Choose a new password${user?.email ? ` for ${user.email}` : ''}.`
                : 'Choose a new password. You will stay signed in on this computer.'}
            </p>

            <form onSubmit={submit}>
              <label>
                New password
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  autoFocus
                />
              </label>
              <label>
                Type it again
                <input
                  type="password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button className="auth-btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>

            <div className="auth-switch">
              {recovery ? (
                <>
                  Didn't ask for this?{' '}
                  <button type="button" onClick={signOut}>Sign out</button>
                </>
              ) : (
                <button type="button" onClick={onCancel}>Cancel</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function friendly(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('different from the old')) return 'Choose a password you have not used before.';
  if (m.includes('should be at least') || m.includes('too short')) return 'Use at least 8 characters.';
  if (m.includes('weak')) return 'That password is too easy to guess. Try something longer.';
  if (m.includes('session') || m.includes('not authenticated') || m.includes('jwt')) {
    return 'This link has expired. Go back to sign in and request a new one.';
  }
  return msg || 'Something went wrong. Try again.';
}