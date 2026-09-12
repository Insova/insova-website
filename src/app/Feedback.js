import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { fmtDate } from './useAppData';

/*
  Feedback.

  The category list is ordered deliberately. "A number looks wrong" is
  first and phrased as an invitation, because a pharmacist telling us a
  figure is off is the most valuable message this product can receive
  and the one most likely to go unsent. Everything here is computed from
  public data anyone can check; if ours disagrees with the HPRA's, ours
  is the one to fix, and we should hear about it the same day.

  Two things are captured automatically alongside the message:

    screen     which part of the app they were looking at
    data_date  which morning's register they were reading

  Without those, "the Gabapentin figure is wrong" is unactionable a week
  later, because the register has moved and we have no idea what they
  saw. Asking someone to remember that themselves is asking them to do
  our job.
*/

const CATEGORIES = [
  {
    id: 'wrong',
    label: 'A number looks wrong',
    hint: 'A figure that disagrees with the HPRA, or with what you know to be true.',
  },
  {
    id: 'broken',
    label: 'Something is broken',
    hint: 'A link that fails, a page that will not load, something that behaves oddly.',
  },
  {
    id: 'idea',
    label: 'Something is missing',
    hint: 'Something that would save you time and is not here yet.',
  },
  {
    id: 'other',
    label: 'Something else',
    hint: 'Anything at all, including telling us this is not useful.',
  },
];

const SCREENS = [
  'Today', 'Your list', 'Shortages', 'Running low',
  'Notices', 'Unlicensed medicines', 'Daily brief', 'Somewhere else',
];

const MAX = 4000;

export default function Feedback({ app }) {
  const { user, pharmacy, profile } = useAuth();
  const [category, setCategory] = useState('wrong');
  const [message, setMessage] = useState('');
  const [screen, setScreen] = useState('Today');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [mine, setMine] = useState([]);

  const dataDate = app?.ready ? app.data.meta.as_of : null;

  const loadMine = useCallback(async () => {
    if (!supabase || !user?.id) return;
    const { data, error: e } = await supabase
      .from('feedback')
      .select('id, created_at, category, message, screen, status, admin_note')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!e && data) setMine(data);
  }, [user]);

  useEffect(() => { loadMine(); }, [loadMine]);

  const submit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) { setError('Write something first.'); return; }
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.from('feedback').insert({
        created_by: user.id,
        pharmacy_id: pharmacy?.id || null,
        category,
        message: text,
        screen,
        data_date: dataDate,
      });
      if (err) { setError(err.message); return; }
      setSent(true);
      setMessage('');
      loadMine();
    } catch (ex) {
      setError(ex?.message || 'Could not send that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const chosen = CATEGORIES.find((c) => c.id === category);

  return (
    <>
      <p className="ia-lead">
        Insova is early and it is being built with pharmacists rather than for
        them. The most useful thing you can send is the bit that annoyed you.
      </p>

      <div className="ia-callout">
        <p>
          If a number looks wrong, we want to hear it the same day. Everything
          here is worked out from public data anyone can check, so if ours
          disagrees with the HPRA&apos;s then ours is the one to fix.
        </p>
      </div>

      <section className="ia-panel">
        <div className="ia-panel-head">
          <h3>Tell us something</h3>
          {profile?.full_name && (
            <span className="ia-panel-note">Sending as {profile.full_name}</span>
          )}
        </div>

        {sent ? (
          <div className="ia-sent">
            <strong>Sent. Thank you.</strong>
            <p>
              A real person reads these. If it is something we can fix, we
              usually do it within a day or two, and you will see the status
              change below.
            </p>
            <button className="ia-btn small" onClick={() => setSent(false)}>
              Send something else
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="ia-fb-form">
            <fieldset className="ia-fb-cats">
              <legend>What kind of thing is it?</legend>
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={'ia-fb-cat' + (category === c.id ? ' on' : '')}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                >
                  {c.label}
                </button>
              ))}
            </fieldset>
            {chosen && <p className="ia-fb-hint">{chosen.hint}</p>}

            <label className="ia-fb-field">
              <span>Where were you?</span>
              <select value={screen} onChange={(e) => setScreen(e.target.value)}>
                {SCREENS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label className="ia-fb-field wide">
              <span>What happened?</span>
              <textarea
                rows={7}
                maxLength={MAX}
                value={message}
                placeholder={
                  category === 'wrong'
                    ? 'Which figure, what it says, and what you expected. A product name or licence number helps us find it.'
                    : 'As much or as little as you like.'
                }
                onChange={(e) => setMessage(e.target.value)}
              />
              <span className="ia-fb-count">
                {message.length > MAX - 300 && `${MAX - message.length} characters left`}
              </span>
            </label>

            <p className="ia-note-rule">
              Please leave patient details out. No names, initials, dates of
              birth or prescription numbers. Insova is not a patient record
              system.
            </p>

            {error && <div className="ia-alert error"><span>{error}</span></div>}

            <div className="ia-fb-actions">
              <button className="ia-btn" type="submit" disabled={busy || !message.trim()}>
                {busy ? 'Sending…' : 'Send'}
              </button>
              {dataDate && (
                <span className="ia-fb-meta">
                  We will note that you were looking at the register collected{' '}
                  {fmtDate(dataDate)}.
                </span>
              )}
            </div>
          </form>
        )}
      </section>

      {mine.length > 0 && (
        <section className="ia-panel">
          <div className="ia-panel-head">
            <h3>What you have sent</h3>
            <span className="ia-panel-note">{mine.length} so far</span>
          </div>
          <div className="ia-fb-list">
            {mine.map((f) => (
              <article key={f.id} className="ia-fb-item">
                <div className="ia-fb-item-top">
                  <span className={'ia-tag ' + statusTone(f.status)}>
                    {statusLabel(f.status)}
                  </span>
                  <span className="ia-fb-item-cat">
                    {(CATEGORIES.find((c) => c.id === f.category) || {}).label || f.category}
                  </span>
                  <span className="ia-fb-item-date">{fmtDate(f.created_at)}</span>
                </div>
                <p className="ia-fb-item-msg">{f.message}</p>
                {f.admin_note && (
                  <p className="ia-fb-item-reply">
                    <strong>Our reply:</strong> {f.admin_note}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="ia-source">
        If you would rather email, <a href="mailto:contact@insova.ie">contact@insova.ie</a>{' '}
        reaches the same two people.
      </p>
    </>
  );
}

function statusLabel(s) {
  return s === 'new' ? 'Sent'
    : s === 'read' ? 'Read'
    : s === 'actioned' ? 'Acted on'
    : 'Closed';
}

function statusTone(s) {
  return s === 'actioned' ? 'green' : s === 'new' ? 'amber' : 'grey';
}
