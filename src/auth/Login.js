import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import './auth.css';

export default function Login({ onDone, onHome }) {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const err = await signIn(email.trim(), password);
        if (err) setError(friendly(err.message));
        else onDone && onDone();
      } else {
        const err = await signUp(email.trim(), password, fullName.trim());
        if (err) setError(friendly(err.message));
        else setNotice('Account created. Check your email if confirmation is required, then sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not configured</h1>
          <p className="auth-lead">
            Sign in is unavailable because the Supabase environment variables are not set on
            this deployment. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY and
            redeploy.
          </p>
          <button className="auth-btn ghost" onClick={onHome}>Back to insova.ie</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-grid">
        <div className="auth-brand">
          <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
          <h2>Shortage intelligence, and more, to save you time</h2>
          <p>
            
          </p>
          
          <p className="auth-fine">
            Insova is an information tool. It never substitutes, orders or dispenses.
            Nothing in it is clinical guidance.
          </p>
        </div>

        <div className="auth-card">
          <h1>{mode === 'signin' ? 'Pharmacy sign in' : 'Create your account'}</h1>
          <p className="auth-lead">
            {mode === 'signin'
              ? 'Access is by invitation while Insova is in trial.'
              : 'Use the email address your invitation was sent to.'}
          </p>

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label>
                Your name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </label>

            {error && <div className="auth-error">{error}</div>}
            {notice && <div className="auth-notice">{notice}</div>}

            <button className="auth-btn" type="submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'signin' ? (
              <>
                Been invited but have no account yet?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(''); }}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(''); }}>
                  Sign in
                </button>
              </>
            )}
          </div>

          <button className="auth-back" type="button" onClick={onHome}>
            ← Back to insova.ie
          </button>
        </div>
      </div>
    </div>
  );
}

function friendly(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password combination was not recognised.';
  if (m.includes('already registered')) return 'An account already exists for that email. Try signing in.';
  if (m.includes('password')) return 'Password must be at least 8 characters.';
  if (m.includes('email')) return 'That email address was not accepted.';
  return msg || 'Something went wrong. Try again.';
}