import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import './booking.css';

/*
  Book a demo, from the homepage.

  1. Pick a day and a time. Only times inside the hours set in
     Admin > Demos > Availability, and not already taken or blocked, are
     offered. All times are Irish time, whatever the visitor's computer
     says, because that is when we are free.
  2. Name, pharmacy, email, and optionally phone, town and a note.
  3. Done, with an "add to calendar" file.

  Saved through the book_demo() database function (demo_booking.sql),
  which checks everything again on the server: the hours, the blocks,
  that nobody else has just taken the slot. Bookings appear in the app
  under Demos for admins.

  If the booking service cannot be reached, the window says so and
  offers email instead, so a demo request is never lost.
*/

const TZ = 'Europe/Dublin';
const DAYS_AHEAD = 21;
const MIN_NOTICE_MS = 3 * 60 * 60 * 1000; // matches book_demo()
const SLOT_MIN = 30;

/* ---------------- Irish time helpers ---------------- */
const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
function dublinParts(ms) {
  const o = {};
  partsFmt.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute };
}
/* The instant at which the Dublin wall clock reads y-m-d h:min. */
function dublinToUtc(y, m, d, h, min) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = dublinParts(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess;
  const t = guess - offset;
  const p2 = dublinParts(t);
  const offset2 = Date.UTC(p2.y, p2.m - 1, p2.d, p2.h, p2.min) - t;
  return guess - offset2;
}
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, '0');

const dayFmt = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, weekday: 'short' });
const dateFmt = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('en-IE', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });

/* Every free slot for the next few weeks, grouped by Irish day. */
function buildDays(rules, busy, now) {
  const byDay = new Map(rules.filter((r) => r.enabled).map((r) => [r.weekday, r]));
  const today = dublinParts(now);
  const out = [];
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const base = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const y = base.getUTCFullYear(); const m = base.getUTCMonth() + 1; const d = base.getUTCDate();
    const iso = ((base.getUTCDay() + 6) % 7) + 1;
    const rule = byDay.get(iso);
    const noon = dublinToUtc(y, m, d, 12, 0);
    const day = { key: `${y}-${pad(m)}-${pad(d)}`, noon, slots: [] };
    if (rule) {
      for (let t = toMin(rule.start_time); t + SLOT_MIN <= toMin(rule.end_time); t += SLOT_MIN) {
        const start = dublinToUtc(y, m, d, Math.floor(t / 60), t % 60);
        const end = start + SLOT_MIN * 60000;
        if (start < now + MIN_NOTICE_MS) continue;
        if (busy.some((b) => b.s < end && b.e > start)) continue;
        day.slots.push(start);
      }
    }
    out.push(day);
  }
  return out;
}

/* A calendar file, so the visitor can drop it straight into Outlook. */
function icsFor(start, form) {
  const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const text = (s) => String(s || '').replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Insova//Demo//EN', 'BEGIN:VEVENT',
    `UID:insova-demo-${start}@insova.ie`, `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(start + SLOT_MIN * 60000)}`,
    'SUMMARY:Insova demo',
    `DESCRIPTION:${text(`Insova demo for ${form.pharmacy}. We will email the call link to ${form.email}. Questions: contact@insova.ie`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(body);
}

export default function DemoBooking({ onClose, fallbackMail }) {
  const [state, setState] = useState('loading'); // loading | ready | error | sending | done
  const [days, setDays] = useState([]);
  const [dayKey, setDayKey] = useState(null);
  const [slot, setSlot] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', pharmacy: '', email: '', phone: '', town: '', notes: '', website: '' });
  const [err, setErr] = useState('');
  const dialogRef = useRef(null);

  const load = async () => {
    setState('loading'); setErr('');
    try {
      if (!supabase) throw new Error('not configured');
      const now = Date.now();
      const [a, b] = await Promise.all([
        supabase.from('demo_availability').select('weekday,enabled,start_time,end_time'),
        supabase.rpc('demo_busy', {
          p_from: new Date(now).toISOString(),
          p_to: new Date(now + (DAYS_AHEAD + 1) * 86400000).toISOString(),
        }),
      ]);
      if (a.error || b.error) throw new Error((a.error || b.error).message);
      const busy = (b.data || []).map((r) => ({ s: Date.parse(r.starts_at), e: Date.parse(r.ends_at) }));
      const built = buildDays(a.data || [], busy, now);
      setDays(built);
      const first = built.find((d) => d.slots.length);
      setDayKey((k) => (k && built.some((d) => d.key === k && d.slots.length) ? k : first ? first.key : null));
      setState('ready');
    } catch (e) {
      setState('error');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes, focus starts inside, the page behind does not scroll.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialogRef.current) dialogRef.current.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const day = useMemo(() => days.find((d) => d.key === dayKey), [days, dayKey]);
  const anyFree = days.some((d) => d.slots.length);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    // A hidden field people never see. Bots fill it in.
    if (form.website) { setState('done'); return; }
    setState('sending');
    const { error } = await supabase.rpc('book_demo', {
      p_slot: new Date(slot).toISOString(),
      p_name: form.name, p_pharmacy: form.pharmacy, p_email: form.email,
      p_phone: form.phone || null, p_town: form.town || null, p_notes: form.notes || null,
    });
    if (error) {
      setErr(error.message || 'That did not go through. Please try again.');
      setState('ready');
      if (/taken|no longer available|just booked/i.test(error.message || '')) {
        setSlot(null); setStep(1); load();
      }
      return;
    }
    setState('done');
  };

  const content = (
    <div className="bk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bk" role="dialog" aria-modal="true" aria-labelledby="bk-title" tabIndex={-1} ref={dialogRef}>
        <button type="button" className="bk-x" onClick={onClose} aria-label="Close">{'×'}</button>

        <aside className="bk-side">
          <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" className="bk-logo" />
          <h2 id="bk-title">Book a demo</h2>
          <p>A 20-minute video call with the Insova team. We'll show you the app on the medicines your pharmacy dispenses, and answer anything you want to ask.</p>
          <ul className="bk-facts">
            <li><span>Length</span>20 minutes</li>
            <li><span>Where</span>Microsoft Teams, link by email</li>
            <li><span>Times</span>Irish time</li>
          </ul>
          {slot && step === 2 && state !== 'done' && (
            <div className="bk-chosen">
              <span>Your time</span>
              <b>{longFmt.format(new Date(slot))}</b>
              <b>{timeFmt.format(new Date(slot))}</b>
              <button type="button" onClick={() => setStep(1)}>Change</button>
            </div>
          )}
        </aside>

        <div className="bk-main">
          {state === 'loading' && <div className="bk-wait"><i /><span>Finding free times</span></div>}

          {state === 'error' && (
            <div className="bk-msg">
              <h3>We couldn't load the calendar.</h3>
              <p>Email us instead and we'll find a time that suits you.</p>
              <div className="bk-row">
                <a className="bk-btn" href={fallbackMail}>Email contact@insova.ie</a>
                <button type="button" className="bk-link" onClick={load}>Try again</button>
              </div>
            </div>
          )}

          {state === 'done' && (
            <div className="bk-msg bk-done">
              <span className="bk-tick" aria-hidden="true">{'✓'}</span>
              <h3>You're booked in.</h3>
              {slot && <p className="bk-when">{longFmt.format(new Date(slot))} at {timeFmt.format(new Date(slot))}, Irish time</p>}
              <p>We'll email the call link to <b>{form.email}</b>. If anything changes, reply to that email or write to contact@insova.ie.</p>
              <div className="bk-row">
                {slot && <a className="bk-btn" href={icsFor(slot, form)} download="insova-demo.ics">Add to my calendar</a>}
                <button type="button" className="bk-link" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {(state === 'ready' || state === 'sending') && step === 1 && (
            <>
              <h3 className="bk-h">Choose a day</h3>
              {!anyFree ? (
                <div className="bk-msg">
                  <p>There are no free times in the next three weeks.</p>
                  <a className="bk-btn" href={fallbackMail}>Email us instead</a>
                </div>
              ) : (
                <>
                  <div className="bk-days" role="listbox" aria-label="Days">
                    {days.map((d) => (
                      <button key={d.key} type="button" role="option" aria-selected={d.key === dayKey}
                        disabled={!d.slots.length}
                        className={'bk-day' + (d.key === dayKey ? ' on' : '')}
                        onClick={() => { setDayKey(d.key); setSlot(null); }}>
                        <span>{dayFmt.format(new Date(d.noon))}</span>
                        <b>{dateFmt.format(new Date(d.noon)).split(' ')[0]}</b>
                        <small>{dateFmt.format(new Date(d.noon)).split(' ')[1]}</small>
                      </button>
                    ))}
                  </div>

                  <h3 className="bk-h">{day ? longFmt.format(new Date(day.noon)) : 'Choose a time'}</h3>
                  <div className="bk-times">
                    {day && day.slots.map((t) => (
                      <button key={t} type="button" className={'bk-time' + (t === slot ? ' on' : '')} onClick={() => setSlot(t)}>
                        {timeFmt.format(new Date(t))}
                      </button>
                    ))}
                  </div>
                  {err && <p className="bk-err">{err}</p>}
                  <div className="bk-foot">
                    <span>All times are Irish time.</span>
                    <button type="button" className="bk-btn" disabled={!slot} onClick={() => { setErr(''); setStep(2); }}>
                      Next
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {(state === 'ready' || state === 'sending') && step === 2 && slot && (
            <form className="bk-form" onSubmit={submit}>
              <h3 className="bk-h">Your details</h3>
              <div className="bk-grid">
                <label>Your name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
                <label>Pharmacy<input required value={form.pharmacy} onChange={set('pharmacy')} autoComplete="organization" /></label>
                <label>Email<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
                <label><span>Phone <em>optional</em></span><input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
                <label className="wide"><span>Town <em>optional</em></span><input value={form.town} onChange={set('town')} autoComplete="address-level2" /></label>
                <label className="wide"><span>Anything we should know? <em>optional</em></span>
                  <textarea rows={3} maxLength={1500} value={form.notes} onChange={set('notes')}
                    placeholder="For example, how many branches, or the shortages that cause you the most trouble." />
                </label>
                <label className="bk-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
              </div>
              <p className="bk-small">
                We use these details only to arrange and hold your demo. No patient information, please.
                See our <a href="/privacy.html" target="_blank" rel="noreferrer">privacy notice</a>.
              </p>
              {err && <p className="bk-err">{err}</p>}
              <div className="bk-foot">
                <button type="button" className="bk-link" onClick={() => setStep(1)}>{'←'} Back</button>
                <button type="submit" className="bk-btn" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Booking…' : 'Book my demo'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}